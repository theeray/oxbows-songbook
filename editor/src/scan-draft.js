import {steps,pitch,keyNames,fifthValues,scaleFor} from './music.js';
import {keyAlter} from './score-structure.js';
import {contextualizeDraft} from './scan-context.js';

export function staffPitch(position,clef,fifths,accidental){
 const base=clef==='bass'?2*7+4:clef==='alto'?3*7+3:4*7+2,d=base+Math.round(position),step=steps[((d%7)+7)%7],octave=Math.floor(d/7),alter=accidental??keyAlter(step,fifths);
 return {step,octave,alter};
}
export const pitchMidi=p=>12*(p.octave+1)+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[p.step]+p.alter;
export function composeScan(systems,{title='Scanned tunes',interpretation='context'}={}){
 const draft=[],issues=[];let carry={fifths:0,beats:4,beatType:4,clef:'treble',mode:'major'};
 for(const system of systems){
  const settings={...carry,...system.settings};if(system.title)settings.title=system.title;
  const chunk=[];
  system.measures.forEach((bar,index)=>{
   const local={...settings,...bar.settings},accidentals=new Map();
   const notes=bar.notes.map(note=>{
    if(note.midi===null)return {...note};
    const written=staffPitch(note.position,local.clef,local.fifths),key=written.step+written.octave;
    if(note.accidental!==undefined)accidentals.set(key,note.accidental);
    const p=staffPitch(note.position,local.clef,local.fifths,accidentals.get(key));
    return {...note,pitch:p,midi:pitchMidi(p)};
   });
   const value={...bar,...local,title:index===0?(system.title||''):(bar.title||''),notes,review:[...(system.warnings||[]),...(bar.warnings||[])].join(' ')};
   chunk.push(value);Object.assign(settings,bar.settings||{});
  });
  // Context is local to each signature region, never across another tune/key.
  let start=0;
  while(start<chunk.length){let end=start+1;while(end<chunk.length&&chunk[end].fifths===chunk[start].fifths&&chunk[end].mode===chunk[start].mode&&!chunk[end].title)end++;
   const local=chunk[start],major=keyNames[fifthValues.indexOf(local.fifths)]||'C',pc=scaleFor(major,'major')[0]+({major:0,minor:9,dorian:2,mixolydian:7}[local.mode]||0),p=pitch(60+pc%12,local.fifths<0),root=p.step+(p.alter===1?'#':p.alter===-1?'b':'');
   if(interpretation==='context'){const interpreted=contextualizeDraft(chunk.slice(start,end).map(b=>b.notes),{...local,root});interpreted.draft.forEach((notes,i)=>chunk[start+i].notes=notes);}
   start=end;
  }
  for(const bar of chunk){const duration=bar.notes.reduce((s,n)=>s+n.duration,0),expected=bar.beats*4/bar.beatType;if(Math.abs(duration-expected)>.02)issues.push({measure:draft.length+1,type:'rhythm',message:duration+' quarter-note beats; expected '+expected});if(bar.review)issues.push({measure:draft.length+1,type:'recognition',message:bar.review});draft.push(bar);}
  const last=chunk.at(-1)||settings;carry={fifths:last.fifths,beats:last.beats,beatType:last.beatType,clef:last.clef,mode:last.mode};
 }
 return {draft,issues,title:systems.filter(s=>s.title).length===1?systems.find(s=>s.title).title:title};
}
