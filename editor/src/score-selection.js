import {parts,measures,noteName} from './music.js';
import {rangeIssue,instrumentForPart,rangeProfile} from './ranges.js';

/** Bind the renderer's graphical notes to MusicXML timing and pitch identities. */
export function bindScoreNotes(osmd,container,doc,{onSelect,selectedPart,selectedMeasure,selectedNote,melodyPart,settings}){
  const definitions=parts(doc),records=new Map(definitions.map(p=>[p.id,measures(doc,p.id)])),hits=[];
  const used=new Map();
  for(const [mi,staves] of (osmd.GraphicSheet?.MeasureList||[]).entries())for(const [si,staff] of staves.entries()){
    if(!staff)continue;
    const instrument=staff.ParentStaff?.ParentInstrument,part=definitions.find(p=>p.id===instrument?.IdString)||definitions[si];if(!part)continue;
    const list=records.get(part.id)?.[mi]?.notes||[];
    for(const entry of staff.staffEntries||[])for(const voice of entry.graphicalVoiceEntries||[])for(const graphical of voice.notes||[]){
      const note=graphical.sourceNote;if(!note)continue;
      const onset=note.ParentVoiceEntry.Timestamp.RealValue*4,voiceId=String(note.ParentVoiceEntry.ParentVoice.VoiceId),key=part.id+':'+mi;
      const taken=used.get(key)||new Set();used.set(key,taken);
      // OSMD numbers C0 as 0; MIDI numbers C0 as 12.
      const isRest=note.isRest(),pitch=note.halfTone+12;
      let ni=list.findIndex((n,i)=>!taken.has(i)&&Math.abs(n.start-onset)<.0001&&n.voice===voiceId&&(isRest?n.midi===null:n.midi===pitch));
      if(ni<0)ni=list.findIndex((n,i)=>!taken.has(i)&&Math.abs(n.start-onset)<.0001&&(isRest?n.midi===null:n.midi===pitch));
      if(ni<0)continue;taken.add(ni);
      const heads=graphical.getNoteheadSVGs?.()||[],head=heads[graphical.vfnoteIndex]||heads[0]||graphical.getSVGGElement?.();if(!head||!container.contains(head))continue;
      const issue=rangeIssue(list[ni].midi,rangeProfile(instrumentForPart(part,melodyPart,settings),settings.rangeComfort));
      head.classList.add('score-note');if(issue){head.classList.add('range-'+issue.kind);head.dataset.rangeIssue=issue.kind;}head.dataset.scorePart=part.id;head.dataset.scoreMeasure=mi;head.dataset.scoreNote=ni;head.setAttribute('role','button');head.setAttribute('tabindex','-1');head.setAttribute('aria-label',`${part.name}, measure ${mi+1}, note ${ni+1}: ${noteName(list[ni].el)}${issue?', '+issue.message:''}`);
      if(part.id===selectedPart&&mi===selectedMeasure&&ni===selectedNote)head.classList.add('selected-score-note');
      hits.push({head,part:part.id,measure:mi,note:ni});
    }
  }
  container.onclick=event=>{
    let element=event.target.closest?.('[data-score-note]'),hit;
    if(element)hit=hits.find(h=>h.head===element);
    if(!hit){let distance=19;for(const candidate of hits){const b=candidate.head.getBoundingClientRect(),d=Math.hypot(event.clientX-b.x-b.width/2,event.clientY-b.y-b.height/2);if(d<distance){distance=d;hit=candidate;}}}
    if(hit){onSelect(hit.part,hit.measure,hit.note);container.focus({preventScroll:true});}
  };
  return hits.length;
}
export function highlightSelection(container,part,measure,note){
  for(const head of container.querySelectorAll('[data-score-note]'))head.classList.toggle('selected-score-note',head.dataset.scorePart===part&&Number(head.dataset.scoreMeasure)===measure&&Number(head.dataset.scoreNote)===note);
}
