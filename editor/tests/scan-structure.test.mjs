import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import * as M from '../src/music.js';
import {composeScan} from '../src/scan-draft.js';
import {applyStructure,structureOf} from '../src/score-structure.js';
import {suggestChordPlan} from '../src/chord-plan.js';
import {arrange} from '../src/accompaniment.js';
import {playbackEvents} from '../src/audio.js';
import {textForStaff,printedChord,transformWords} from '../src/scan-text-analysis.js';
import {staffSymbols,readSignature,readBarlines,readAccidental} from '../src/scan-symbols.js';
import glyphs from '../src/scan-glyphs.json' with {type:'json'};
const proto=Object.getPrototypeOf(new DOMParser().parseFromString('<a/>','application/xml').documentElement);
Object.defineProperty(proto,'children',{get(){return Array.from(this.childNodes).filter(n=>n.nodeType===1)}});Object.defineProperty(proto,'id',{get(){return this.getAttribute('id')},set(v){this.setAttribute('id',v)}});
proto.remove=function(){this.parentNode?.removeChild(this)};proto.append=function(...es){es.forEach(e=>this.appendChild(e))};proto.prepend=function(e){this.insertBefore(e,this.firstChild)};proto.replaceChildren=function(...es){while(this.firstChild)this.removeChild(this.firstChild);this.append(...es)};
globalThis.DOMParser=DOMParser;globalThis.XMLSerializer=XMLSerializer;
const settings={root:'D',mode:'major',harmony:'thirds',fiddleHarmony:'off',drone:'tonic',cello:'sustained',doubleBass:'pulse',chords:true};
const note=(position,duration=1,extra={})=>({position,duration,midi:0,...extra});
function medley(){return composeScan([
 {title:'First jig',settings:{clef:'treble',fifths:2,beats:6,beatType:8,mode:'major'},warnings:[],measures:[{notes:[note(-1),note(1),note(3)],repeatStart:true,chords:[{start:0,name:'D/F#'}]},{notes:[note(-1),note(1),note(3)],repeatEnd:true}]},
 {title:'Second reel',settings:{clef:'treble',fifths:1,beats:4,beatType:4,mode:'major'},warnings:[],measures:[{notes:[note(2),note(4),note(6),note(2)]},{notes:[note(2),note(4),note(6),note(2)],repeatEnd:true}]}
],{interpretation:'visual',title:'Practice set'});}
test('multiple scanned tunes retain local signatures, names, chords and repeat boundaries through MusicXML',()=>{
 const result=medley(),doc=M.fromDraft(result.draft,{title:result.title}),read=M.parse(M.serialize(doc)),ms=M.measures(read,'P1');
 assert.deepEqual(ms.map(m=>[m.fifths,m.beats,m.beatType,m.tuneStart]),[[2,6,8,'First jig'],[2,6,8,''],[1,4,4,'Second reel'],[1,4,4,'']]);assert.equal(M.harmonyEvents(ms[0])[0].name,'D/F#');assert.equal(ms[0].notes[1].midi,66);assert.equal(ms[2].notes[0].midi,67);
 assert.deepEqual(playbackEvents(read,60,{melody:1,chords:0},{},true).markers.map(m=>m.index),[0,1,0,1,2,3,2,3]);
 const plan=suggestChordPlan(ms,settings),arr=arrange(read,'P1',settings,plan);assert.equal(plan[2][0].name,'G');assert.equal(M.measures(arr,'VD')[2].notes[0].midi,55);assert.equal(M.measures(arr,'VC')[2].fifths,1);assert.equal(M.measures(arr,'VB')[2].beats,4);
});
test('manual signature corrections change only affected pitches and leave explicit accidentals and next tune intact',()=>{
 const result=medley();result.draft[0].notes[1].accidental=1;const doc=M.fromDraft(result.draft),original=M.measures(doc,'P1')[2].notes.map(n=>n.midi);
 applyStructure(doc,'P1',0,{fifths:-1,mode:'major',clef:'treble',meter:'3/4',title:'Renamed waltz',repeatStart:true,endingStart:'1',endingEnd:'1',barStyle:'light-light',words:'Moderato'},true);
 const ms=M.measures(doc,'P1');assert.equal(ms[0].notes[1].midi,66);assert.deepEqual(ms[2].notes.map(n=>n.midi),original);assert.equal(ms[2].fifths,1);assert.equal(structureOf(ms[0]).title,'Renamed waltz');assert.equal(structureOf(ms[0]).endingStart,'1');assert.equal(structureOf(ms[0]).words,'Moderato');
});
test('scan pitch spelling carries printed accidentals within a bar and resets at barlines',()=>{
 const result=composeScan([{title:'Accidentals',settings:{clef:'treble',fifths:2,beats:2,beatType:4,mode:'major'},measures:[{notes:[note(1,1,{accidental:0}),note(1)]},{notes:[note(1),note(1)]}]}],{interpretation:'visual'});
 assert.deepEqual(result.draft.flatMap(m=>m.notes.map(n=>n.midi)),[65,65,66,66]);
});
test('text detection separates a title, slash chords, numbered endings and instructions',()=>{
 const staff={left:20,right:600,gap:12,lines:[150,162,174,186,198]};
 const word=(text,x,y,width=40)=>({text,x0:x,y0:y,x1:x+width,y1:y+15,confidence:98});
 const found=textForStaff([word('The Kesh Jig',200,30,180),word('D',90,115),word('A7',220,115),word('D/F#',350,115,60),word('1.',80,104),word('D.C. al Fine',450,65,120)],staff);
 assert.equal(found.title,'The Kesh Jig');assert.deepEqual(found.chords.map(c=>c.name),['D','A7','D/F#']);assert.equal(found.endings[0].number,'1');assert.ok(found.directions.some(d=>d.text==='D.C. al Fine'));assert.equal(printedChord('(Bbmaj7)').name,'Bbmaj7');assert.equal(printedChord('not music'),null);
 const mapped=transformWords([word('D',10,20)],100,100,100,100,0,2)[0];assert.equal(mapped.x0,20);assert.equal(mapped.y0,40);
});
function raster(){const w=700,h=240,bin=new Uint8Array(w*h),staff={gap:12,left:15,right:680,lines:[90,102,114,126,138]};for(const y of staff.lines)for(let x=15;x<681;x++)bin[y*w+x]=1;
 const stamp=(name,x,y)=>{const t=glyphs[name];t.rows.forEach((row,dy)=>[...row].forEach((v,dx)=>{if(v==='1')bin[(y+dy)*w+x+dx]=1;}));};return {w,h,bin,staff,stamp};}
test('engraved signature shapes are detected after staff removal',()=>{
 const {w,h,bin,staff,stamp}=raster();stamp('gClef',22,66);stamp('accidentalSharp',65,76);stamp('accidentalSharp',84,94);stamp('timeSig6',111,89);stamp('timeSig8',111,114);
 const symbols=staffSymbols(bin,w,h,staff),result=readSignature(symbols,staff,15,142,{});
 assert.equal(result.detected.clef,'treble');assert.equal(result.detected.fifths,2);assert.equal(result.detected.beats,6);assert.equal(result.detected.beatType,8);
});
test('repeat dots require both spaces and correctly distinguish start and end repeats',()=>{
 const {w,h,bin,staff}=raster();for(const x of [190,193,195,490,493,495])for(let y=90;y<=138;y++)bin[y*w+x]=1;
 for(const x of [203,480])for(const y of [108,120])for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)bin[(y+dy)*w+x+dx]=1;
 const bars=readBarlines(bin,w,h,staff,[]);assert.equal(bars.find(b=>b.x>185&&b.x<200).repeatStart,true);assert.equal(bars.find(b=>b.x>485&&b.x<500).repeatEnd,true);
});
