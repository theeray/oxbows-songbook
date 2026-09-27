import {parts,measures} from './music.js';

export const RANGE_COLORS={high:'#38A9D6',low:'#C75462'};
const names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
export const pitchLabel=m=>names[(m%12+12)%12]+(Math.floor(m/12)-1);
// Standard tuning sets a physical lower bound. Upper values are adjustable
// practice guides, not claims about a player's or instrument's absolute limit.
export function rangeProfile(instrument='viola',comfort='session'){
  const fiddle=instrument==='fiddle',maximum={first:fiddle?83:76,session:fiddle?88:81,extended:fiddle?95:88}[comfort]??(fiddle?88:81);
  return {instrument,name:fiddle?'fiddle':'viola',minimum:fiddle?55:48,maximum};
}
export function instrumentForPart(part,melodyPart,settings){
  return part.id===melodyPart?(settings.clef==='treble'?'fiddle':'viola'):/fiddle|violin/i.test(part.name)?'fiddle':'viola';
}
export function rangeIssue(midi,profile){
  if(midi===null||!Number.isFinite(midi))return null;
  const {minimum,maximum,name}=profile,kind=midi<minimum?'low':midi>maximum?'high':null;
  if(!kind)return null;
  const alternatives=[];
  for(let shift=-7;shift<=7;shift++)if(shift&&midi+shift*12>=minimum&&midi+shift*12<=maximum)alternatives.push({midi:midi+shift*12,octaves:shift});
  alternatives.sort((a,b)=>Math.abs(a.octaves)-Math.abs(b.octaves));
  return {kind,midi,profile,alternatives:alternatives.slice(0,2),message:kind==='low'?`${pitchLabel(midi)} is below the ${name}’s lowest string, ${pitchLabel(minimum)}. It cannot be played in standard tuning.`:`${pitchLabel(midi)} is above your ${name} comfort limit of ${pitchLabel(maximum)}. It may need difficult high-position playing.`};
}
export function scoreRangeIssues(doc,melodyPart,settings){
  const result=[];
  for(const part of parts(doc)){const profile=rangeProfile(instrumentForPart(part,melodyPart,settings),settings.rangeComfort);
    for(const m of measures(doc,part.id))m.notes.forEach((n,i)=>{const issue=rangeIssue(n.midi,profile);if(issue)result.push({...issue,part:part.id,partName:part.name,measure:m.index,note:i});});
  }return result;
}
