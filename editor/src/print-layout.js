import {direct,elem,txt} from './music.js';

export function printScore(source,maxBars=4){
  const doc=source.cloneNode(true),parts=direct(doc.documentElement,'part'),lead=direct(parts[0],'measure');
  const phraseEnds=new Set([lead.length-1]);
  lead.forEach((measure,i)=>{
    const backward=Array.from(measure.getElementsByTagName('repeat')).some(r=>r.getAttribute('direction')==='backward');
    const section=direct(measure,'barline').some(b=>b.getAttribute('location')!=='left'&&['light-light','light-heavy'].includes(txt(b,'bar-style')));
    if(backward||section)phraseEnds.add(i);if(i&&measure.getElementsByTagName('rehearsal').length)phraseEnds.add(i-1);
  });
  const lineStarts=new Set([0]);let start=0;
  for(const end of [...phraseEnds].sort((a,b)=>a-b)){
    const length=end-start+1,lines=Math.ceil(length/maxBars),perLine=Math.ceil(length/lines);
    for(let next=start+perLine;next<=end;next+=perLine)lineStarts.add(next);
    if(end+1<lead.length)lineStarts.add(end+1);start=end+1;
  }
  for(const part of parts)direct(part,'measure').forEach((measure,i)=>{
    measure.removeAttribute('width');direct(measure,'print').forEach(p=>p.remove());
    if(i>0&&lineStarts.has(i)){const p=elem(doc,'print');p.setAttribute('new-system','yes');measure.prepend(p);}
  });
  return doc;
}

