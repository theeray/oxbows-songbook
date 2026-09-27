import {scaleFor,scaleSpell,pitch} from './music.js';
import {chordCandidates} from './accompaniment.js';
const pc=m=>(m%12+12)%12;
const label=p=>p.step+(p.alter===1?'♯':p.alter===-1?'♭':'')+p.octave;

/** Resolve ambiguous pitches only. Confident readings remain fixed anchors. */
export function contextualizeDraft(input,{root='D',mode='major',beats=4,beatType=4}={}){
  const draft=input.map(bar=>bar.map(n=>({...n,pitch:n.pitch?{...n.pitch}:n.midi===null?null:pitch(n.midi)}))),scale=scaleFor(root,mode),line=[],chords=[];
  draft.forEach((bar,mi)=>{let at=0;const notes=bar.map((n,ni)=>{const item={...n,start:at,mi,ni,uncertain:!!n.review};at+=n.duration;line.push(item);return item;});
    const anchors=notes.filter(n=>!n.uncertain);chords[mi]=anchors.length>=2?chordCandidates({notes:anchors,beats,beatType,duration:at},root,mode)[0]:null;
  });
  const motifVotes=item=>{
    const bar=draft[item.mi],votes=new Map();
    draft.forEach((other,mi)=>{if(mi===item.mi||other.length!==bar.length)return;let agreed=0,compared=0;
      for(let i=0;i<bar.length;i++)if(i!==item.ni&&!bar[i].review&&!other[i].review){compared++;if(bar[i].midi===other[i].midi&&Math.abs(bar[i].duration-other[i].duration)<.01)agreed++;}
      if(compared>=3&&agreed/compared>=.8&&!other[item.ni].review)votes.set(other[item.ni].midi,(votes.get(other[item.ni].midi)||0)+1);
    });return votes;
  };
  const motifs=line.map(motifVotes),rows=line.map((n,i)=>{
    const anchors=line.filter((other,j)=>Math.abs(j-i)<=6&&!other.uncertain&&other.midi!==null).length;
    if(!n.uncertain||anchors<2||n.midi===null)return [n.midi];
    return [...new Set([n.midi,...Array.from({length:5},(_,j)=>n.midi+j-2).filter(q=>scale.includes(pc(q)))])];
  });
  const local=(q,n,i)=>{
    if(q===null)return 0;
    const changed=q!==n.midi;
    return (changed?.18+Math.abs(q-n.midi)*.08:0)+(scale.includes(pc(q))?0:1.2)+(chords[n.mi]&&!chords[n.mi].triad.includes(pc(q))?(n.start<.001?.85:.35):0)-Math.min(2,motifs[i].get(q)||0)*1.1;
  };
  const transition=(a,b)=>a===null||b===null?0:Math.abs(a-b)*.06+Math.max(0,Math.abs(a-b)-4)*.17;
  const costs=[],parents=[];
  rows.forEach((row,i)=>{costs[i]=[];parents[i]=[];row.forEach((q,j)=>{let best=Infinity,parent=0;if(!i)best=0;else rows[i-1].forEach((p,k)=>{const value=costs[i-1][k]+transition(p,q);if(value<best){best=value;parent=k;}});costs[i][j]=best+local(q,line[i],i);parents[i][j]=parent;});});
  if(!rows.length)return {draft,corrections:[]};
  const chosen=[];let at=costs.at(-1).indexOf(Math.min(...costs.at(-1)));
  for(let i=line.length-1;i>=0;i--){chosen[i]=rows[i][at];at=parents[i][at];}
  const corrections=[];
  line.forEach((n,i)=>{
    const q=chosen[i];if(q===n.midi||q===null)return;
    const before=local(n.midi,n,i)+transition(chosen[i-1]??null,n.midi)+transition(n.midi,chosen[i+1]??null),after=local(q,n,i)+transition(chosen[i-1]??null,q)+transition(q,chosen[i+1]??null);
    if(before-after<.2)return;
    const target=draft[n.mi][n.ni],originalPitch={...target.pitch},next=scaleSpell(q,root,mode),reason=motifs[i].has(q)?'Matches a repeated phrase':'Fits the key, nearby notes, and implied chord';
    Object.assign(target,{midi:q,pitch:next,originalPitch,contextReason:reason,review:`Context suggestion: ${label(originalPitch)} → ${label(next)}. ${reason}.`});
    corrections.push({measure:n.mi+1,note:n.ni+1,from:n.midi,to:q,reason});
  });
  return {draft,corrections};
}
