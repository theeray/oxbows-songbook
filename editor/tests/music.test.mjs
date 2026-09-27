import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import * as M from '../src/music.js';
import * as A from '../src/accompaniment.js';
import {playbackEvents,playbackPosition,synthesizeWave,guitarVoicing} from '../src/audio.js';
import {printScore} from '../src/print-layout.js';
const probe=new DOMParser().parseFromString('<a/>','application/xml'),proto=Object.getPrototypeOf(probe.documentElement);
Object.defineProperty(proto,'children',{get(){return Array.from(this.childNodes).filter(n=>n.nodeType===1)}});
Object.defineProperty(proto,'id',{get(){return this.getAttribute('id')},set(v){this.setAttribute('id',v)}});
proto.remove=function(){this.parentNode?.removeChild(this)};proto.append=function(...es){es.forEach(e=>this.appendChild(e))};proto.prepend=function(e){this.insertBefore(e,this.firstChild)};proto.replaceChildren=function(...es){while(this.firstChild)this.removeChild(this.firstChild);this.append(...es)};
globalThis.DOMParser=DOMParser;globalThis.XMLSerializer=XMLSerializer;
const settings={root:'D',mode:'major',harmony:'smooth',drone:'adaptive',chords:true};
const tune=(bars,options={})=>M.fromDraft(bars.map(bar=>bar.map(midi=>({midi,duration:1}))),{beats:4,beatType:4,...options});
function barline(m,repeat,ending,type='start'){
  const b=M.elem(m.ownerDocument,'barline');b.setAttribute('location',repeat==='forward'?'left':'right');
  if(ending){const e=M.elem(m.ownerDocument,'ending');e.setAttribute('number',ending);e.setAttribute('type',type);b.append(e);}
  if(repeat){const r=M.elem(m.ownerDocument,'repeat');r.setAttribute('direction',repeat);b.append(r);}m.append(b);
}
test('clef preserves sound, all chromatic transpositions preserve exact pitches',()=>{
  const source=M.demo(),before=M.serialize(source),original=M.measures(source,'P1').flatMap(m=>m.notes.map(n=>n.midi));
  for(let semitones=-12;semitones<=12;semitones++)for(const octave of [-1,0,1]){
    const doc=M.makeMelody(source,'P1',{clef:'alto',semitones,octave});
    assert.deepEqual(M.measures(doc,'P1').flatMap(m=>m.notes.map(n=>n.midi)),original.map(n=>n+semitones+12*octave));
  }assert.equal(M.serialize(source),before);
});
test('diatonic chord suggestions distinguish major, minor, Dorian, and Mixolydian',()=>{
  for(const [root,mode,notes,chord] of [['D','major',[62,66,69,62],'D'],['A','minor',[69,72,76,69],'Am'],['D','dorian',[67,71,74,67],'G'],['D','mixolydian',[60,64,67,60],'C']]){
    const ms=M.measures(tune([notes]),'P1');assert.equal(A.suggestChords(ms,root,mode)[0],chord);
  }
});
test('imported changes and slash bass survive; a user override replaces only its bar',()=>{
  const doc=tune([[62,66,69,62],[69,73,76,69]]),ms=M.measures(doc,'P1');
  M.addChord(ms[0].el,'D/F#');const h=M.elem(doc,'harmony');h.append(M.elem(doc,'root'));M.set(h.firstChild,'root-step','A');h.append(M.elem(doc,'kind','major'));ms[0].el.insertBefore(h,ms[0].notes[2].el);
  assert.deepEqual(M.harmonyEvents(ms[0]).map(e=>[e.start,e.name]),[[0,'D/F#'],[2,'A']]);
  const before=M.serialize(doc),chords=A.suggestChords(M.measures(doc,'P1'),'D','major',{1:'Bm'});
  const arranged=A.arrange(doc,'P1',settings,chords,{1:'Bm'});
  assert.equal(M.direct(M.measures(arranged,'P1')[0].el,'harmony').length,2);
  assert.equal(chords[1],'Bm');assert.equal(A.suggestChords(M.measures(doc,'P1'),'D','major')[1],'A');assert.equal(M.serialize(doc),before);
  const replaced=A.arrange(doc,'P1',settings,{0:'',1:'Bm'},{0:''});
  assert.equal(M.direct(M.measures(replaced,'P1')[0].el,'harmony').length,0);
  assert.equal(guitarVoicing(M.parseChord('D/F#'))[0]%12,6);
});
test('smooth harmony stays below melody, in viola range, and uses chord tones on strong beats',()=>{
  const doc=tune([[62,66,69,66],[64,68,71,68],[61,64,69,64]]),chords={0:'D',1:'E',2:'A'};
  const arranged=A.arrange(doc,'P1',settings,chords),lead=M.measures(arranged,'P1'),harmony=M.measures(arranged,'VH');
  harmony.forEach((m,i)=>m.notes.forEach((n,j)=>{if(n.midi===null)return;assert.ok(n.midi>=48&&n.midi<lead[i].notes[j].midi);assert.ok(M.parseChord(chords[i]).triad.includes(n.midi%12));}));
  const low=A.arrange(tune([[48,49,50,51]]),'P1',settings,{0:'C'});
  assert.equal(M.measures(low,'VH')[0].notes[0].midi,null);assert.ok(M.measures(low,'VH')[0].notes.every((n,i)=>n.midi===null||(n.midi>=48&&n.midi<48+i)));
});
test('drone avoids semitone/tritone clashes and preserves exact compound-meter lengths',()=>{
  const conflict=M.measures(tune([[61,66,61,66]]),'P1')[0];assert.deepEqual(A.droneChoice(conflict,'C','major','C'),[]);
  const doc=M.demo(),arr=A.arrange(doc,'P1',{...settings,drone:'fifth'},A.suggestChords(M.measures(doc,'P1'),'D','major'));
  assert.ok(M.measures(arr,'VD').every(m=>m.duration===3));
  const notes=M.measures(arr,'VD')[0].notes;assert.equal(notes[0].duration,1.5);assert.ok(M.direct(notes[0].el,'tie').some(t=>t.getAttribute('type')==='start'));
  // MusicXML sound ties must precede note type.
  assert.ok([...notes[0].el.children].findIndex(e=>e.tagName==='tie')<[...notes[0].el.children].findIndex(e=>e.tagName==='type'));
});
test('repeat endings span multiple bars and ties merge into sustained media events',()=>{
  const doc=tune([[60],[62],[64],[65],[67]]),ms=M.measures(doc,'P1');barline(ms[0].el,'forward');barline(ms[1].el,null,'1');barline(ms[2].el,'backward','1','stop');barline(ms[3].el,null,'2');barline(ms[4].el,null,'2','discontinue');
  const seq=playbackEvents(doc,60,{melody:1,harmony:0,drone:0,chords:0},{});
  assert.deepEqual(seq.markers.map(m=>m.index),[0,1,2,0,3,4]);
  const drone=A.arrange(tune([[60,64,67,60],[60,64,67,60]]),'P1',{...settings,root:'C',harmony:'off',drone:'tonic'},{});
  const sound=playbackEvents(drone,60,{melody:0,drone:1},{});assert.equal(sound.events.length,1);assert.equal(sound.events[0].duration,8);
});
test('PCM preview contains nonzero, unclipped audio and valid WAV headers',()=>{
  const seq=playbackEvents(M.demo(),112,{melody:.75,harmony:.4,drone:.4,chords:.4},{0:'D/F#'}),wave=synthesizeWave(seq),data=new DataView(wave);
  assert.equal(new TextDecoder().decode(wave.slice(0,4)),'RIFF');assert.equal(data.getUint32(24,true),22050);
  let peak=0;for(let i=44;i<wave.byteLength;i+=2)peak=Math.max(peak,Math.abs(data.getInt16(i,true)));assert.ok(peak>1000&&peak<=29492);
});
test('print lines end on major repeats and do not change source notation',()=>{
  const doc=M.demo(),ms=M.measures(doc,'P1');barline(ms[2].el,'backward');barline(ms[6].el,'backward');
  const before=M.serialize(doc),printed=printScore(doc),starts=M.measures(printed,'P1').filter(m=>M.direct(m.el,'print').length).map(m=>m.index);
  assert.deepEqual(starts,[3,7]);assert.equal(M.serialize(doc),before);
});

import * as P from '../src/chord-plan.js';
import * as E from '../src/editing.js';
import * as R from '../src/ranges.js';
import {contextualizeDraft} from '../src/scan-context.js';
test('chord timing supports simple/compound meters and two-bar phrases',()=>{
  const simple=M.measures(tune([[62,66,69,62],[64,67,71,64]]),'P1');
  assert.deepEqual(P.changeStarts(simple[0],'pulse'),[0,1,2,3]);assert.deepEqual(P.changeStarts(simple[0],'half'),[0,2]);
  const compound=M.measures(M.demo(),'P1');assert.deepEqual(P.changeStarts(compound[0],'pulse'),[0,1.5]);assert.deepEqual(P.changeStarts(compound[0],'half'),[0,1.5]);
  const paired=P.suggestChordPlan(simple,{...settings,chordFrequency:'two-bars'});assert.equal(paired[0][0].name,paired[1][0].name);assert.equal(paired[1][0].show,false);
  barline(simple[0].el,'backward');const separate=P.suggestChordPlan(simple,{...settings,chordFrequency:'two-bars'});assert.equal(separate[1][0].show,true);
});
test('chord complexity and within-bar edits survive notation and playback',()=>{
  const doc=tune([[62,66,69,73]]),m=M.measures(doc,'P1')[0];
  const simple=A.chordCandidates(m,'D','major','simple'),color=A.chordCandidates(m,'D','major','colorful');
  assert.ok(simple.every(c=>['D','G','A'].includes(c.name)));assert.ok(color.some(c=>c.name==='Dmaj7'));
  const config={...settings,harmony:'off',drone:'off',chordFrequency:'half'},manual={0:{0:'D',2:'A7'}},plan=P.suggestChordPlan([m],config,manual),arr=A.arrange(doc,'P1',config,plan,manual);
  assert.deepEqual(M.harmonyEvents(M.measures(arr,'P1')[0]).map(c=>[c.start,c.name]),[[0,'D'],[2,'A7']]);
  const events=playbackEvents(arr,60,{chords:1},plan,false).events;assert.equal(events.filter(e=>e.start>=2&&e.start<2.1).length,5);
  // Editing only a later imported change leaves the first slash chord intact.
  const imported=tune([[62,66,69,73]]),im=M.measures(imported,'P1')[0];M.addChord(im.el,'D/F#');M.addChord(im.el,'A',2,im.divisions);
  const p2=P.suggestChordPlan(M.measures(imported,'P1'),config,{0:{2:'Bm'}}),a2=A.arrange(imported,'P1',config,p2,{0:{2:'Bm'}});
  assert.deepEqual(M.harmonyEvents(M.measures(a2,'P1')[0]).map(c=>[c.start,c.name]),[[0,'D/F#'],[2,'Bm']]);
});
test('moving drones have increasing activity, varied pitches, and exact meter lengths',()=>{
  const doc=tune([[74,78,81,78],[76,79,83,79]]),ms=M.measures(doc,'P1'),counts=[];
  for(const motion of ['gentle','flowing','walking']){
    const config={...settings,harmony:'off',drone:'moving',droneMotion:motion,chordFrequency:'half'},plan=P.suggestChordPlan(ms,config),arr=A.arrange(doc,'P1',config,plan);
    const drone=M.measures(arr,'VD');assert.deepEqual(drone.map(m=>m.duration),[4,4]);
    const pitches=drone.flatMap(m=>m.notes.map(n=>n.midi)).filter(n=>n!==null);assert.ok(new Set(pitches).size>1);assert.ok(pitches.every(n=>n>=48&&n<=67));counts.push(drone[0].notes.length);
    const jig=A.arrange(M.demo(),'P1',config,{});assert.ok(M.measures(jig,'VD').every(m=>m.duration===3));
  }assert.ok(counts[0]<=counts[1]&&counts[1]<counts[2]);
});
test('fiddle and viola harmonies are independent editable staves with separate audio levels',()=>{
  const doc=tune([[69,73,76,73]]),before=M.serialize(doc),arr=A.arrange(doc,'P1',{...settings,drone:'off',fiddleHarmony:'smooth'},{0:'A'});
  assert.deepEqual(M.parts(arr).map(p=>p.id),['P1','VH','VF']);
  assert.equal(M.txt(M.measures(arr,'VF')[0].el,'sign'),'G');assert.equal(M.txt(M.measures(arr,'VH')[0].el,'sign'),'C');
  const lead=M.measures(arr,'P1')[0].notes;assert.ok(M.measures(arr,'VF')[0].notes.every((n,i)=>n.midi>lead[i].midi&&n.midi<=93));
  const sound=playbackEvents(arr,60,{melody:0,harmony:0,fiddle:1,drone:0,chords:0},{},false);assert.equal(sound.events.length,4);assert.equal(M.serialize(doc),before);
});
test('pitch editing respects the displayed key, octaves, transposition, and tied chains',()=>{
  const doc=tune([[64],[64]]),ms=M.measures(doc,'P1'),n=ms[0].notes[0].el;
  assert.deepEqual(E.shiftedPitch(n,1,{fifths:2}),{step:'F',alter:1,octave:4});assert.equal(E.shiftedPitch(n,1,{chromatic:true}).alter,0);assert.equal(E.shiftedPitch(n,-1,{octave:true}).octave,3);
  const displayed={step:'G',alter:1,octave:5};assert.deepEqual(E.sourcePitch(displayed,2,1,2),{step:'F',alter:1,octave:4});
  for(const [i,type] of [[0,'start'],[1,'stop']]){const tie=M.elem(doc,'tie');tie.setAttribute('type',type);ms[i].notes[0].el.append(tie);}
  assert.equal(E.editPitch(doc,'P1',1,0,{step:'F',alter:1,octave:4}).length,2);assert.deepEqual(M.measures(doc,'P1').map(m=>m.notes[0].midi),[66,66]);
  E.editPitch(doc,'P1',0,0,null);assert.ok(M.measures(doc,'P1').every(m=>m.notes[0].midi===null&&M.direct(m.notes[0].el,'tie').length===0));
});
test('generated pitch overrides persist on matching rhythms and title edits preserve source metadata',()=>{
  const doc=tune([[62,66,69,62]]),arr=A.arrange(doc,'P1',settings,{0:'D'}),n=M.measures(arr,'VH')[0].notes[0];
  const edits={[E.editKey('VH',0,0)]:{start:n.start,duration:n.duration,pitch:{step:'C',alter:0,octave:4}}};E.applyGeneratedEdits(arr,edits);assert.equal(M.measures(arr,'VH')[0].notes[0].midi,60);
  E.setScoreTitle(doc,'  The   Blue\nReel!  ');assert.equal(M.metadata(doc,'P1').title,'The Blue Reel!');assert.equal(M.metadata(printScore(doc),'P1').title,'The Blue Reel!');
});
test('uncertain scans use repeated musical context without changing confident chromatic notes',()=>{
  const draft=[[62,66,69,66],[62,65,69,66]].map(bar=>bar.map(midi=>({midi,duration:1,pitch:M.pitch(midi)})));draft[1][1].review='uncertain head';
  const original=JSON.stringify(draft),result=contextualizeDraft(draft,{root:'D',mode:'major'});
  assert.equal(result.draft[1][1].midi,66);assert.equal(result.draft[1][1].originalPitch.step,'F');assert.equal(result.draft[1][1].originalPitch.alter,0);assert.ok(result.draft[1][1].review.includes('Context suggestion'));assert.equal(JSON.stringify(draft),original);
  delete draft[1][1].review;assert.equal(contextualizeDraft(draft,{root:'D',mode:'major'}).draft[1][1].midi,65);
  const isolated=[[{midi:65,duration:1,review:'uncertain'}]];assert.equal(contextualizeDraft(isolated).draft[0][0].midi,65);
});
test('range guides mark standard-tuning lows and configurable highs with safe octave alternatives',()=>{
  const viola=R.rangeProfile('viola'),fiddle=R.rangeProfile('fiddle');assert.equal(R.rangeIssue(48,viola),null);assert.equal(R.rangeIssue(55,fiddle),null);
  for(const [midi,profile,kind] of [[47,viola,'low'],[54,fiddle,'low'],[89,fiddle,'high'],[82,viola,'high']]){const issue=R.rangeIssue(midi,profile);assert.equal(issue.kind,kind);assert.ok(issue.alternatives.length);assert.ok(issue.alternatives.every(a=>a.midi%12===midi%12&&a.midi>=profile.minimum&&a.midi<=profile.maximum));}
  assert.equal(R.rangeIssue(80,R.rangeProfile('viola','extended')),null);assert.equal(R.rangeIssue(80,R.rangeProfile('viola','first')).kind,'high');assert.equal(R.rangeIssue(null,viola),null);
  const original=tune([[50,54,57,50]]),shifted=M.makeMelody(original,'P1',{clef:'treble',octave:-1,semitones:0});assert.equal(R.scoreRangeIssues(shifted,'P1',{clef:'treble'}).length,4);
});
test('chord changes during held notes keep timing without altering melody duration',()=>{
  const doc=M.fromDraft([[{midi:62,duration:4}]],{beats:4,beatType:4}),m=M.measures(doc,'P1')[0];M.addChord(m.el,'D');M.addChord(m.el,'A7',2,m.divisions);
  assert.deepEqual(M.harmonyEvents(M.measures(doc,'P1')[0]).map(c=>[c.start,c.name]),[[0,'D'],[2,'A7']]);assert.equal(M.measures(doc,'P1')[0].duration,4);assert.equal(M.measures(doc,'P1')[0].notes.length,1);
});
test('generated smooth harmony sustains one pitch through tied chord changes',()=>{
  const doc=tune([[74],[74]]),ms=M.measures(doc,'P1');for(const [i,type]of [[0,'start'],[1,'stop']]){const tie=M.elem(doc,'tie');tie.setAttribute('type',type);ms[i].notes[0].el.append(tie);}
  const arr=A.arrange(doc,'P1',{...settings,drone:'off',fiddleHarmony:'smooth'},{0:'D',1:'G'});
  for(const id of ['VH','VF']){const notes=M.measures(arr,id).map(m=>m.notes[0]);assert.equal(notes[0].midi,notes[1].midi);}
});
test('playback starts at a clicked beat and synchronizes held drones and chords',()=>{
  const doc=tune([[60,64,67,60],[62,65,69,62]]),arr=A.arrange(doc,'P1',{...settings,root:'C',harmony:'off',drone:'tonic'},{0:'C',1:'Dm'});
  const cropped=playbackEvents(arr,60,{melody:1,drone:1,chords:1},{0:'C',1:'Dm'},false,{measure:1,offset:2});
  assert.equal(cropped.duration,2);assert.deepEqual(cropped.markers,[{time:0,index:1,offset:2,duration:4}]);
  assert.deepEqual(cropped.events.filter(e=>e.type==='strings').map(e=>[e.midi,e.start,e.duration]),[[69,0,1],[62,1,1]]);
  assert.ok(cropped.events.some(e=>e.type==='sine'&&e.start===0&&e.duration===2));
  assert.ok(cropped.events.filter(e=>e.type==='pluck').every(e=>e.start===0&&e.duration===2));
});
test('selected-note playback resumes tied notes and preserves subsequent repeats',()=>{
  const doc=tune([[60],[60],[64]]),ms=M.measures(doc,'P1');
  for(const [i,type]of [[0,'start'],[1,'stop']]){const tie=M.elem(doc,'tie');tie.setAttribute('type',type);ms[i].notes[0].el.append(tie);}
  barline(ms[0].el,'forward');barline(ms[2].el,'backward');
  const seq=playbackEvents(doc,120,{melody:1},{},true,{measure:1,offset:0});
  assert.deepEqual(seq.markers.map(m=>m.index),[1,2,0,1,2]);assert.equal(seq.events[0].midi,60);assert.equal(seq.events[0].start,0);assert.equal(seq.events[0].duration,.5);
  assert.equal(playbackEvents(doc,120,{melody:1},{},true,{measure:99,offset:0}).duration,3);
});

test('locator follows media time through partial measures and repeat jumps',()=>{
  const doc=tune([[60,62,64],[65,67,69],[71,72,74]]),ms=M.measures(doc,'P1');
  barline(ms[0].el,'forward');barline(ms[1].el,'backward');
  const sequence=playbackEvents(doc,120,{melody:1},{},true,{measure:1,offset:1});
  assert.deepEqual(playbackPosition(sequence,0),{measure:1,offset:1});
  assert.deepEqual(playbackPosition(sequence,.25),{measure:1,offset:1.5});
  assert.deepEqual(playbackPosition(sequence,1),{measure:0,offset:0});
  assert.deepEqual(playbackPosition(sequence,1.5),{measure:0,offset:1});
});
