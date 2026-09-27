import {tonalSettings} from './score-structure.js';
import {addPart,direct,elem,measures,midi,noteXML,parseChord,scaleFor,txt} from './music.js';

const pc=n=>((n%12)+12)%12;
const configs=[
  {option:'cello',id:'VC',name:'Cello',minimum:36,maximum:60,center:48,writtenOffset:0,program:43},
  {option:'doubleBass',id:'VB',name:'Double bass',minimum:28,maximum:43,center:35,writtenOffset:12,program:44}
];
function tie(note,type){
  const doc=note.ownerDocument,element=elem(doc,'tie');element.setAttribute('type',type);note.insertBefore(element,direct(note,'type')[0]||null);
  let notation=direct(note,'notations')[0];if(!notation){notation=elem(doc,'notations');note.append(notation);}
  const tied=elem(doc,'tied');tied.setAttribute('type',type);notation.append(tied);
}
function repeatBoundary(previous,current){return !!current?.tuneStart||[previous?.el,current?.el].some(el=>el&&Array.from(el.getElementsByTagName('repeat')).length)||direct(previous?.el,'barline').some(b=>['light-light','light-heavy'].includes(txt(b,'bar-style')));}
function chordAt(events,time){let result=null;for(const event of events){if(event.start>time+.00001)break;result=event.name?parseChord(event.name):null;}return result;}

// Compose in sounding pitch. Only the double bass notation is raised an octave.
export function lowStringPattern(measure,settings,value,config,previousPitch=null){
  const style=settings[config.option],pulse=measure.beatType===8&&measure.beats>3&&measure.beats%3===0?1.5:4/measure.beatType;
  const events=Array.isArray(value)?value:[{start:0,name:value??settings.root+(settings.mode==='minor'||settings.mode==='dorian'?'m':'')}];
  const cuts=new Set([0,measure.duration]);
  if(style!=='sustained')for(let at=pulse;at<measure.duration-.00001;at+=pulse)cuts.add(Number(at.toFixed(6)));
  for(const event of events)if(event.start>0&&event.start<measure.duration)cuts.add(event.start);
  const starts=[...cuts].sort((a,b)=>a-b),result=[];
  starts.slice(0,-1).forEach((start,index)=>{
    const end=starts[index+1],chord=chordAt(events,start);
    const melody=measure.notes.filter(n=>n.midi!==null&&!n.grace&&n.start<end&&n.start+n.duration>start);
    let chosen=null;
    if(chord&&melody.length){
      const root=chord.bass?.pc??chord.pc,fifth=chord.triad[Math.min(2,chord.triad.length-1)];
      const change=events.some(e=>Math.abs(e.start-start)<.00001);
      const preferred=style==='sustained'||change||index===0?root:style==='pulse'?(index%2?fifth:root):[root,chord.triad[1],fifth,chord.triad[1]][index%4];
      const allowed=style==='moving'&&!change&&index>0?[...new Set([root,...chord.triad])]:[preferred];
      // Stay below the tune. If it drops below the instrument, leave space.
      const ceiling=Math.min(config.maximum,...melody.map(n=>n.midi-3));
      const candidates=[];
      for(let q=config.minimum;q<=ceiling;q++)if(allowed.includes(pc(q))){
        const leap=Math.abs(q-(previousPitch??config.center));
        const rub=melody.reduce((sum,n)=>sum+([1,6,11].includes(pc(n.midi-q))?Math.min(end,n.start+n.duration)-Math.max(start,n.start):0),0);
        const cost=(pc(q)===preferred?0:1.1)+leap*.09+Math.max(0,leap-7)*.2+Math.abs(q-config.center)*.025+rub/(end-start)*.4;
        candidates.push({q,cost});
      }
      candidates.sort((a,b)=>a.cost-b.cost);chosen=candidates[0]?.q??null;
    }
    result.push({start,duration:end-start,midi:chosen});if(chosen!==null)previousPitch=chosen;
  });
  return result;
}

export function addLowStrings(doc,melodyId,settings,chords,uniqueId){
  const bars=measures(doc,melodyId);
  for(const config of configs){
    const style=settings[config.option]||'off';if(style==='off')continue;
    const id=uniqueId(config.id),part=addPart(doc,id,config.name),definition=direct(direct(doc.documentElement,'part-list')[0],'score-part').find(p=>p.id===id);
    const instrument=elem(doc,'score-instrument');instrument.setAttribute('id',id+'-instrument');instrument.append(elem(doc,'instrument-name',config.name));definition.append(instrument);
    const playback=elem(doc,'midi-instrument');playback.setAttribute('id',id+'-instrument');playback.append(elem(doc,'midi-program',config.program));definition.append(playback);
    let previousPitch=null,previousNote=null;
    bars.forEach((bar,index)=>{
      const measure=elem(doc,'measure');measure.setAttribute('number',bar.number);
      if(bar.el.hasAttribute('implicit'))measure.setAttribute('implicit',bar.el.getAttribute('implicit'));
      const divisions=Math.max(480,bar.divisions)*4,attrs=elem(doc,'attributes');attrs.append(elem(doc,'divisions',divisions));
      if(!index||bar.fifths!==bars[index-1].fifths){const key=elem(doc,'key');key.append(elem(doc,'fifths',bar.fifths));attrs.append(key);}
      if(!index||bar.beats!==bars[index-1].beats||bar.beatType!==bars[index-1].beatType){const meter=elem(doc,'time');meter.append(elem(doc,'beats',bar.beats),elem(doc,'beat-type',bar.beatType));attrs.append(meter);}
      if(!index){
        const clef=elem(doc,'clef');clef.append(elem(doc,'sign','F'),elem(doc,'line',4));attrs.append(clef);
        if(config.writtenOffset){const transpose=elem(doc,'transpose');transpose.append(elem(doc,'diatonic',0),elem(doc,'chromatic',0),elem(doc,'octave-change',-1));attrs.append(transpose);}
      }
      measure.append(attrs);
      for(const barline of direct(bar.el,'barline').filter(b=>b.getAttribute('location')==='left'))measure.append(barline.cloneNode(true));
      const local=tonalSettings(bar,settings,bars[0]);const pattern=lowStringPattern(bar,local,chords[index],config,previousPitch);
      pattern.forEach((event,eventIndex)=>{
        let remaining=event.duration,segment=0;
        while(remaining>.00001){
          const duration=[4,3,2,1.5,1,.75,.5,.375,.25,.1875,.125,.0625].find(n=>n<=remaining+.00001)||remaining;
          const written=event.midi===null?null:event.midi+config.writtenOffset;
          const note=noteXML(doc,written,duration,divisions,local.root,local.mode);
          const atBoundary=eventIndex===0&&segment===0&&index>0;
          if(written!==null&&previousNote&&midi(previousNote)===written&&(segment>0||style==='sustained')&&!(atBoundary&&repeatBoundary(bars[index-1],bar))){tie(previousNote,'start');tie(note,'stop');}
          measure.append(note);previousNote=note;remaining-=duration;segment++;
        }
        if(event.midi!==null)previousPitch=event.midi;
      });
      for(const barline of direct(bar.el,'barline').filter(b=>b.getAttribute('location')!=='left'))measure.append(barline.cloneNode(true));
      part.append(measure);
    });
  }
  return doc;
}
