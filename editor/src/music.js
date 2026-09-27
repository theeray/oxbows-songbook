export const steps=['C','D','E','F','G','A','B'];
const pcs=[0,2,4,5,7,9,11];
export const modes={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],mixolydian:[0,2,4,5,7,9,10]};
export const keyNames=['C','G','D','A','E','B','F#','C#','F','Bb','Eb','Ab','Db','Gb','Cb'];
export const fifthValues=[0,1,2,3,4,5,6,7,-1,-2,-3,-4,-5,-6,-7];
export const txt=(el,tag,fallback='')=>el?.getElementsByTagName(tag)[0]?.textContent??fallback;
export const direct=(el,tag)=>Array.from(el?.children??[]).filter(n=>n.tagName===tag);
export function parse(xml){if(xml.length>15e6)throw Error('This score is too large. Import a smaller selection.');const d=new DOMParser().parseFromString(xml,'application/xml');if(d.getElementsByTagName('parsererror').length||d.documentElement.tagName!=='score-partwise')throw Error('Please import a valid partwise MusicXML score (.musicxml, .xml, or .mxl).');if(!d.getElementsByTagName('note').length)throw Error('No notes were found in this score.');return d;}
export const serialize=d=>new XMLSerializer().serializeToString(d);
export const parts=d=>direct(d.documentElement,'part').map(p=>({id:p.id,name:txt(Array.from(d.getElementsByTagName('score-part')).find(s=>s.id===p.id),'part-name',p.id)}));
export function elem(d,tag,text){const e=d.createElement(tag);if(text!==undefined)e.textContent=String(text);return e;}
export function set(el,tag,text){let e=direct(el,tag)[0];if(!e){e=elem(el.ownerDocument,tag);el.appendChild(e);}e.textContent=String(text);return e;}
export function midi(n){const p=direct(n,'pitch')[0];return p?12*(Number(txt(p,'octave'))+1)+pcs[steps.indexOf(txt(p,'step'))]+Number(txt(p,'alter',0)):null;}
export function pitch(m,flats=false){const names=flats?['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']:['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];const name=names[((m%12)+12)%12];return {step:name[0],alter:name.length>1?(flats?-1:1):0,octave:Math.floor(m/12)-1};}
export function writePitch(n,p){direct(n,'rest').forEach(e=>e.remove());let pe=direct(n,'pitch')[0];if(!pe){pe=elem(n.ownerDocument,'pitch');const chord=direct(n,'chord')[0];n.insertBefore(pe,chord?chord.nextSibling:n.firstChild);}pe.replaceChildren(elem(n.ownerDocument,'step',p.step));if(p.alter)pe.appendChild(elem(n.ownerDocument,'alter',p.alter));pe.appendChild(elem(n.ownerDocument,'octave',p.octave));direct(n,'accidental').forEach(e=>e.remove());}
export const noteName=n=>{const m=midi(n);if(m===null)return 'Rest';const p=direct(n,'pitch')[0];const a=Number(txt(p,'alter',0));return txt(p,'step')+(a===1?'♯':a===-1?'♭':a===2?'𝄪':a===-2?'𝄫':'')+txt(p,'octave');};
export function metadata(doc,id){const p=direct(doc.documentElement,'part').find(p=>p.id===id)||direct(doc.documentElement,'part')[0];return {title:txt(doc,'work-title',txt(doc,'movement-title','Untitled tune')),fifths:Number(txt(p,'fifths',0)),mode:txt(p,'mode','major'),beats:Number(txt(p,'beats',4)),beatType:Number(txt(p,'beat-type',4)),clef:txt(p,'sign','G')==='C'?'alto':'treble'};}
export function measures(doc,id){const p=direct(doc.documentElement,'part').find(p=>p.id===id);let divisions=1,beats=4,beatType=4,fifths=0,soundOffset=0;return direct(p,'measure').map((m,i)=>{const attrs=direct(m,'attributes')[0];divisions=Number(txt(attrs,'divisions',divisions));beats=Number(txt(attrs,'beats',beats));beatType=Number(txt(attrs,'beat-type',beatType));fifths=Number(txt(attrs,'fifths',fifths));const transpose=direct(attrs,'transpose')[0];if(transpose)soundOffset=Number(txt(transpose,'chromatic',0))+12*Number(txt(transpose,'octave-change',0));let at=0,last=0,end=0;const notes=[];for(const child of m.children){if(child.tagName==='backup')at-=Number(txt(child,'duration',0))/divisions;if(child.tagName==='forward')at+=Number(txt(child,'duration',0))/divisions;if(child.tagName==='note'){const grace=!!direct(child,'grace').length;const duration=Number(txt(child,'duration',0))/divisions;const chord=!!direct(child,'chord').length;const start=chord?last:at;notes.push({el:child,midi:midi(child),soundingMidi:midi(child)===null?null:midi(child)+soundOffset,start,duration,grace,voice:txt(child,'voice','1')});if(!chord){last=at;at+=duration;}end=Math.max(end,start+duration);}}return {el:m,index:i,number:m.getAttribute('number')||String(i+1),notes,divisions,beats,beatType,fifths,soundOffset,duration:end||beats*4/beatType};});}
export function scaleFor(root,mode){const match=root.match(/^([A-G])([#b]?)$/);const pc=pcs[steps.indexOf(match?.[1]||'D')]+(match?.[2]==='#'?1:match?.[2]==='b'?-1:0);return (modes[mode]||modes.major).map(x=>(x+pc+12)%12);}
export function scaleSpell(m,root,mode){const sc=scaleFor(root,mode),i=sc.indexOf((m%12+12)%12);if(i<0)return pitch(m,root.includes('b'));const step=steps[(steps.indexOf(root[0])+i)%7],base=pcs[steps.indexOf(step)];let alter=((m%12)-base+12)%12;if(alter>6)alter-=12;return {step,alter,octave:(m-base-alter)/12-1};}
export function shiftedFifths(f,semi){let n=f+semi*7;while(n>6)n-=12;while(n< -5)n+=12;return n;}
export function transposePitch(p,semi,oldFifths,newFifths){if(!semi)return {step:txt(p,'step'),alter:Number(txt(p,'alter',0)),octave:Number(txt(p,'octave'))};const oldTonic=((oldFifths*4)%7+7)%7,newTonic=((newFifths*4)%7+7)%7;const ka=(f,step)=>f>0&&['F','C','G','D','A','E','B'].slice(0,f).includes(steps[step])?1:f<0&&['B','E','A','D','G','C','F'].slice(0,-f).includes(steps[step])?-1:0;const oldPc=pcs[oldTonic]+ka(oldFifths,oldTonic),newPc=pcs[newTonic]+ka(newFifths,newTonic);let diatonic=newTonic-oldTonic+7*Math.round((oldPc+semi-newPc)/12);const oldD=Number(txt(p,'octave'))*7+steps.indexOf(txt(p,'step'));const d=oldD+diatonic;const step=steps[((d%7)+7)%7],octave=Math.floor(d/7);const oldM=12*(Number(txt(p,'octave'))+1)+pcs[steps.indexOf(txt(p,'step'))]+Number(txt(p,'alter',0));return {step,octave,alter:oldM+semi-(12*(octave+1)+pcs[steps.indexOf(step)])};}
export function makeMelody(source,id,options){const doc=source.cloneNode(true),root=doc.documentElement;const part=direct(root,'part').find(p=>p.id===id);direct(root,'part').filter(p=>p!==part).forEach(p=>p.remove());const list=direct(root,'part-list')[0];for(const e of [...list.children])if(e.tagName!=='score-part'||e.id!==id)e.remove();const definition=direct(list,'score-part')[0];set(definition,'part-name',options.clef==='alto'?'Viola':'Fiddle');direct(part,'measure').forEach(m=>direct(m,'print').forEach(e=>e.remove()));let f=0;for(const m of direct(part,'measure')){let a=direct(m,'attributes')[0];if(a&&direct(a,'key')[0])f=Number(txt(a,'fifths',0));const nf=shiftedFifths(f,options.semitones);if(a){for(const key of direct(a,'key'))set(key,'fifths',nf);for(const clef of direct(a,'clef')){set(clef,'sign',options.clef==='alto'?'C':'G');set(clef,'line',options.clef==='alto'?3:2);direct(clef,'clef-octave-change').forEach(e=>e.remove());}direct(a,'transpose').forEach(e=>e.remove());}
for(const n of direct(m,'note')){const p=direct(n,'pitch')[0];if(p){const next=transposePitch(p,options.semitones,f,nf);next.octave+=options.octave;writePitch(n,next);}direct(n,'stem').forEach(e=>e.remove());}
for(const h of direct(m,'harmony')){for(const tag of ['root','bass']){const e=direct(h,tag)[0];if(e){const p=elem(doc,'pitch');p.append(elem(doc,'step',txt(e,tag+'-step')),elem(doc,'alter',txt(e,tag+'-alter',0)),elem(doc,'octave',4));const trans=transposePitch(p,options.semitones,f,nf);set(e,tag+'-step',trans.step);if(trans.alter||direct(e,tag+'-alter').length)set(e,tag+'-alter',trans.alter);}}}}
const first=direct(part,'measure')[0];let a=direct(first,'attributes')[0];if(!a){a=elem(doc,'attributes');first.prepend(a);}if(!direct(a,'clef').length){const c=elem(doc,'clef');c.append(elem(doc,'sign',options.clef==='alto'?'C':'G'),elem(doc,'line',options.clef==='alto'?3:2));a.append(c);}return doc;}
export function parseChord(name){
  const cleaned=String(name).trim().replace(/♯/g,'#').replace(/♭/g,'b');
  const m=cleaned.match(/^([A-G])([#b]?)(maj7|m7|m|dim|aug|sus2|sus4|7|6|m6|5)?(?:\/([A-G])([#b]?))?$/);
  if(!m)return null;
  const alter=a=>a==='#'?1:a==='b'?-1:0;
  const pc=(pcs[steps.indexOf(m[1])]+alter(m[2])+12)%12;
  const ints={m:[0,3,7],dim:[0,3,6],aug:[0,4,8],sus2:[0,2,7],sus4:[0,5,7],'7':[0,4,7,10],maj7:[0,4,7,11],m7:[0,3,7,10],'6':[0,4,7,9],m6:[0,3,7,9],'5':[0,7]}[m[3]]||[0,4,7];
  return {name:cleaned,pc,triad:ints.map(i=>(i+pc)%12),kind:({m:'minor',dim:'diminished',aug:'augmented',sus2:'suspended-second',sus4:'suspended-fourth','7':'dominant',maj7:'major-seventh',m7:'minor-seventh','6':'major-sixth',m6:'minor-sixth','5':'power'})[m[3]]||'major',step:m[1],alter:alter(m[2]),bass:m[4]?{step:m[4],alter:alter(m[5]),pc:(pcs[steps.indexOf(m[4])]+alter(m[5])+12)%12}:null};
}
export function chordName(h){
  const suffix={major:'',minor:'m',dominant:'7','major-seventh':'maj7','minor-seventh':'m7',diminished:'dim',augmented:'aug','suspended-fourth':'sus4','suspended-second':'sus2',power:'5','major-sixth':'6','minor-sixth':'m6'}[txt(h,'kind')];
  if(suffix===undefined)return null;
  const accidental=a=>a===1?'#':a===-1?'b':a===0?'':null;
  const root=txt(h,'root-step'),alt=accidental(Number(txt(h,'root-alter',0))),bass=txt(h,'bass-step'),balt=accidental(Number(txt(h,'bass-alter',0)));
  if(!root||alt===null||balt===null||h.getElementsByTagName('degree').length)return null;
  return root+alt+suffix+(bass?'/'+bass+balt:'');
}
export function harmonyEvents(measure){
  let at=0;const result=[];
  for(const child of measure.el.children){
    if(child.tagName==='backup')at-=Number(txt(child,'duration',0))/measure.divisions;
    if(child.tagName==='forward')at+=Number(txt(child,'duration',0))/measure.divisions;
    if(child.tagName==='note'&&!direct(child,'chord').length&&!direct(child,'grace').length)at+=Number(txt(child,'duration',0))/measure.divisions;
    if(child.tagName==='harmony')result.push({start:Math.max(0,at+Number(txt(child,'offset',0))/measure.divisions),name:chordName(child),el:child});
  }
  return result.sort((a,b)=>a.start-b.start);
}
export function addChord(m,name,start=0,divisions=1){
  const c=parseChord(name);if(!c)return;
  const d=m.ownerDocument,h=elem(d,'harmony'),r=elem(d,'root');r.append(elem(d,'root-step',c.step));if(c.alter)r.append(elem(d,'root-alter',c.alter));h.append(r,elem(d,'kind',c.kind));
  if(c.bass){const bass=elem(d,'bass');bass.append(elem(d,'bass-step',c.bass.step));if(c.bass.alter)bass.append(elem(d,'bass-alter',c.bass.alter));h.append(bass);}
  // Place harmony at its real cursor position; several renderers ignore offsets.
  let at=0,anchor=null;
  for(const child of m.children){
    if(child.tagName==='backup')at-=Number(txt(child,'duration',0))/divisions;
    if(child.tagName==='forward')at+=Number(txt(child,'duration',0))/divisions;
    if(child.tagName==='note'&&!direct(child,'chord').length&&!direct(child,'grace').length){if(Math.abs(at-start)<.00001){anchor=child;break;}at+=Number(txt(child,'duration',0))/divisions;}
  }
  if(anchor)m.insertBefore(h,anchor);
  else {const first=direct(m,'note')[0]||null;if(start){const forward=elem(d,'forward'),backup=elem(d,'backup');forward.append(elem(d,'duration',Math.round(start*divisions)));backup.append(elem(d,'duration',Math.round(start*divisions)));m.insertBefore(forward,first);m.insertBefore(h,first);m.insertBefore(backup,first);}else m.insertBefore(h,first);}

}
export function addPart(doc,id,name){const d=elem(doc,'score-part');d.id=id;d.append(elem(doc,'part-name',name));direct(doc.documentElement,'part-list')[0].append(d);const p=elem(doc,'part');p.id=id;doc.documentElement.append(p);return p;}
export function noteXML(d,m,duration,divisions,root,mode){const n=elem(d,'note');if(m===null)n.append(elem(d,'rest'));else writePitch(n,scaleSpell(m,root,mode));n.append(elem(d,'duration',Math.round(duration*divisions)));const values=[[4,'whole'],[3,'half'],[2,'half'],[1.5,'quarter'],[1,'quarter'],[.75,'eighth'],[.5,'eighth'],[.375,'16th'],[.25,'16th'],[.1875,'32nd'],[.125,'32nd'],[.0625,'64th']];const found=values.find(([q])=>Math.abs(duration-q)<.001);if(found){n.append(elem(d,'type',found[1]));if([3,1.5,.75,.375,.1875].includes(duration))n.append(elem(d,'dot'));}return n;}
export function fromDraft(draft,{title='Scanned tune',fifths=0,beats=4,beatType=4,clef='treble',mode='major'}={}){const d=new DOMParser().parseFromString('<score-partwise version="4.0"><work><work-title/></work><part-list><score-part id="P1"><part-name>Melody</part-name></score-part></part-list><part id="P1"/></score-partwise>','application/xml');set(d.getElementsByTagName('work')[0],'work-title',title);const part=direct(d.documentElement,'part')[0];draft.forEach((notes,i)=>{const m=elem(d,'measure');m.setAttribute('number',i+1);if(i===0){const a=elem(d,'attributes');a.append(elem(d,'divisions',480));const key=elem(d,'key');key.append(elem(d,'fifths',fifths),elem(d,'mode',mode));const time=elem(d,'time');time.append(elem(d,'beats',beats),elem(d,'beat-type',beatType));const c=elem(d,'clef');c.append(elem(d,'sign',clef==='alto'?'C':'G'),elem(d,'line',clef==='alto'?3:2));a.append(key,time,c);m.append(a);}for(const note of notes){const n=noteXML(d,note.midi,note.duration,480,'C','major');if(note.pitch)writePitch(n,note.pitch);if(note.review){n.setAttribute('data-review',note.review);n.setAttribute('color','#A76510');}if(note.originalPitch){n.setAttribute('data-scan-original',JSON.stringify(note.originalPitch));n.setAttribute('data-context-reason',note.contextReason||'Context suggestion');}m.append(n);}part.append(m);});return d;}
export function demo(){const phrases=[[74,78,81,78,76,74],[76,78,79,81,79,76],[74,78,81,83,81,78],[76,74,73,74,74,74],[81,83,81,78,81,78],[79,81,79,76,79,76],[78,79,81,83,81,78],[76,74,73,74,74,74]];const d=fromDraft(phrases.map(p=>p.map(m=>({midi:m-12,duration:.5}))),{title:'A little session tune',fifths:2,beats:6,beatType:8});d.getElementsByTagName('creator');return d;}
