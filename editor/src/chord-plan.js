import {tonalSettings} from './score-structure.js';
import {chordCandidates,pulseLength,phraseEnd} from './accompaniment.js';
import {harmonyEvents,parseChord,scaleFor} from './music.js';

export function sliceMeasure(measure,start,end){
  const notes=measure.notes.filter(n=>n.start<end-.00001&&n.start+n.duration>start+.00001).map(n=>({...n,start:Math.max(start,n.start)-start,duration:Math.min(end,n.start+n.duration)-Math.max(start,n.start)}));
  return {...measure,notes,duration:end-start};
}
export function changeStarts(measure,frequency='bar'){
  const step=frequency==='pulse'?pulseLength(measure):frequency==='half'?Math.max(pulseLength(measure),Math.ceil(measure.beats/(measure.beatType===8&&measure.beats%3===0?3:1)/2)*pulseLength(measure)):measure.duration;
  const starts=[];for(let at=0;at<measure.duration-.00001;at+=step)starts.push(Number(at.toFixed(6)));return starts;
}
const overridesIn=(overrides,i)=>typeof overrides[i]==='string'?{0:overrides[i]}:overrides[i]||{};

/** A complete chord timeline, in quarter-note beats, for notation and audio. */
export function suggestChordPlan(ms,settings,overrides={}){
  const {root,mode}=settings,frequency=settings.chordFrequency||'bar',complexity=settings.chordComplexity||'standard';
  const units=[];let carried,previousPair=null;
  ms.forEach((m,i)=>{
    const local=tonalSettings(m,settings,ms[0]);if(i&&(m.tuneStart||m.fifths!==ms[i-1].fifths||m.mode!==ms[i-1].mode)){carried=undefined;previousPair=null;}const imported=harmonyEvents(m),manual=overridesIn(overrides,i);
    const anchored=imported.length>0||carried!==undefined;
    const starts=[...new Set([...(anchored?[0,...imported.map(e=>e.start)]:changeStarts(m,frequency)),...Object.keys(manual).map(Number)])].filter(t=>t>=0&&t<m.duration-.00001).sort((a,b)=>a-b);
    const thisUnits=[];
    for(let j=0;j<starts.length;j++){
      const start=starts[j],end=starts[j+1]??m.duration,events=imported.filter(e=>e.start<=start+.00001),event=events.at(-1);
      const anchoredName=event?event.name:carried;
      const locked=Object.hasOwn(manual,start)||anchored;
      const name=Object.hasOwn(manual,start)?manual[start]:anchoredName||'';
      const slice=sliceMeasure(m,start,end),slot={measure:i,start,duration:end-start,show:!anchored||Object.hasOwn(manual,start)||imported.some(e=>Math.abs(e.start-start)<.00001),locked,manual:Object.hasOwn(manual,start),imported:anchored};
      const unit={local,slice,slots:[slot],locked,name,endPhrase:(j===starts.length-1)&&(i===ms.length-1||phraseEnd(m)),weight:(end-start)/Math.max(.25,pulseLength(m))};
      thisUnits.push(unit);
    }
    if(imported.length)carried=imported.at(-1).name||'';
    const canPair=frequency==='two-bars'&&thisUnits.length===1&&!thisUnits[0].locked;
    if(canPair&&previousPair&&!previousPair.endPhrase&&ms[i-1].beats===m.beats&&ms[i-1].beatType===m.beatType){
      const next=thisUnits[0],base=previousPair.slice.duration;
      previousPair.slice={...previousPair.slice,notes:[...previousPair.slice.notes,...next.slice.notes.map(n=>({...n,start:n.start+base}))],duration:base+next.slice.duration};
      next.slots[0].show=false;previousPair.slots.push(...next.slots);previousPair.weight+=next.weight;previousPair.endPhrase=next.endPhrase;previousPair=null;
    }else{units.push(...thisUnits);previousPair=canPair?thisUnits[0]:null;}
  });
  const rows=units.map(u=>u.locked?[{...(parseChord(u.name)||{name:'',pc:null,triad:[]}),score:2}]:chordCandidates(u.slice,u.local.root,u.local.mode,complexity));
  const costs=[],parents=[];
  rows.forEach((row,i)=>{costs[i]=[];parents[i]=[];row.forEach((c,j)=>{
    const unit=units[i],last=unit.slice.notes.filter(n=>n.midi!==null&&!n.grace).at(-1);
    const tonic=scaleFor(unit.local.root,unit.local.mode)[0];const cadence=unit.endPhrase&&c.pc===tonic&&last&&last.midi%12===tonic?.5:0;
    let best=-Infinity,parent=0;if(!i)best=0;
    else rows[i-1].forEach((p,k)=>{
      let transition=c.name===p.name?.42:c.triad.filter(n=>p.triad.includes(n)).length*.08-.18;
      if(p.pc!==null&&c.pc!==null&&(c.pc-p.pc+12)%12===5)transition+=.16;
      if(units[i-1].endPhrase)transition*=.3;
      const value=costs[i-1][k]+transition;if(value>best){best=value;parent=k;}
    });costs[i][j]=best+c.score*Math.max(.5,unit.weight)+cadence;parents[i][j]=parent;
  });});
  const plan={};if(!rows.length)return plan;
  let chosen=costs.at(-1).indexOf(Math.max(...costs.at(-1)));
  for(let i=rows.length-1;i>=0;i--){for(const slot of units[i].slots)(plan[slot.measure]??=[]).push({...slot,name:rows[i][chosen].name});chosen=parents[i][chosen];}
  for(const slots of Object.values(plan)){slots.sort((a,b)=>a.start-b.start);slots.forEach((slot,i)=>{if(i&&!slot.manual&&!slot.imported&&slot.name===slots[i-1].name)slot.show=false;});}
  return plan;
}
