import {direct,elem,set,txt,steps,pitch,midi,writePitch,measures} from './music.js';
export function setScoreTitle(doc,value){
  const title=String(value).replace(/\s+/g,' ').trim().slice(0,160)||'Untitled tune',root=doc.documentElement;
  let work=direct(root,'work')[0];if(!work){work=elem(doc,'work');root.insertBefore(work,root.firstChild);}set(work,'work-title',title);
  for(const movement of direct(root,'movement-title'))movement.textContent=title;
  // Imported credit text can repeat the old title. The renderer now uses the
  // authoritative work/movement title; leave unrelated credits untouched.
  return title;
}
export function shiftedPitch(note,direction,{chromatic=false,octave=false,fifths=0}={}){
  const p=direct(note,'pitch')[0];if(!p)return null;
  if(octave)return {step:txt(p,'step'),alter:Number(txt(p,'alter',0)),octave:Number(txt(p,'octave'))+direction};
  if(chromatic)return pitch(midi(note)+direction,fifths<0);
  const number=Number(txt(p,'octave'))*7+steps.indexOf(txt(p,'step'))+direction,step=steps[(number%7+7)%7];
  const alter=fifths>0&&['F','C','G','D','A','E','B'].slice(0,fifths).includes(step)?1:fifths<0&&['B','E','A','D','G','C','F'].slice(0,-fifths).includes(step)?-1:0;
  return {step,alter,octave:Math.floor(number/7)};
}
export function tiedNotes(doc,part,measureIndex,noteIndex){
  const ms=measures(doc,part),selected=ms[measureIndex]?.notes[noteIndex];if(!selected)return [];
  const line=ms.flatMap(m=>m.notes.map((n,index)=>({...n,measure:m.index,index}))).filter(n=>n.voice===selected.voice&&n.midi===selected.midi),at=line.findIndex(n=>n.el===selected.el);
  const tie=(n,type)=>direct(n.el,'tie').some(t=>t.getAttribute('type')===type);let start=at,end=at;
  const absolute=ms.map((_,i)=>ms.slice(0,i).reduce((s,m)=>s+m.duration,0));
  const adjacent=(a,b)=>Math.abs(absolute[a.measure]+a.start+a.duration-absolute[b.measure]-b.start)<.00001;
  while(start>0&&tie(line[start],'stop')&&tie(line[start-1],'start')&&adjacent(line[start-1],line[start]))start--;
  while(end<line.length-1&&tie(line[end],'start')&&tie(line[end+1],'stop')&&adjacent(line[end],line[end+1]))end++;
  return line.slice(start,end+1);
}
export function editPitch(doc,part,measureIndex,noteIndex,value){
  const group=tiedNotes(doc,part,measureIndex,noteIndex);
  for(const n of group){
    if(value)writePitch(n.el,value);else{direct(n.el,'pitch').forEach(p=>p.remove());if(!direct(n.el,'rest').length)n.el.prepend(elem(doc,'rest'));for(const tag of ['tie','accidental'])direct(n.el,tag).forEach(t=>t.remove());for(const tied of Array.from(n.el.getElementsByTagName('tied')))tied.remove();}
    for(const key of ['data-review','data-scan-original','data-context-reason'])n.el.removeAttribute(key);n.el.removeAttribute('color');
  }return group;
}
export const editKey=(part,measure,index)=>`${part}:${measure}:${index}`;
export function applyGeneratedEdits(doc,edits){
  for(const part of direct(doc.documentElement,'part'))for(const m of measures(doc,part.id))m.notes.forEach((n,i)=>{const edit=edits[editKey(part.id,m.index,i)];if(!edit||Math.abs(edit.start-n.start)>.00001||Math.abs(edit.duration-n.duration)>.00001)return;if(edit.pitch)writePitch(n.el,edit.pitch);else{direct(n.el,'pitch').forEach(p=>p.remove());if(!direct(n.el,'rest').length)n.el.prepend(elem(doc,'rest'));for(const tie of direct(n.el,'tie'))tie.remove();for(const tied of Array.from(n.el.getElementsByTagName('tied')))tied.remove();}});
  return doc;
}

/** Convert an edited, displayed melody pitch back to the source register/key. */
export function sourcePitch(value,semitones=0,octaves=0,fifths=0){
  if(!value)return null;
  if(!semitones)return {...value,octave:value.octave-octaves};
  const natural={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  return pitch((value.octave+1)*12+natural[value.step]+(value.alter||0)-semitones-octaves*12,fifths<0);
}
