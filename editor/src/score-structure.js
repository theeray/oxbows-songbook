import {direct,elem,set,txt,measures,writePitch,steps,keyNames,fifthValues,scaleFor,pitch} from './music.js';

export const meters=['2/2','2/4','3/4','4/4','5/4','6/4','3/8','6/8','7/8','9/8','12/8'];
export const modeChoices=['major','minor','dorian','mixolydian'];
export function keyAlter(step,fifths){return fifths>0&&['F','C','G','D','A','E','B'].slice(0,fifths).includes(step)?1:fifths<0&&['B','E','A','D','G','C','F'].slice(0,-fifths).includes(step)?-1:0;}
export function tonalSettings(measure,settings,first){
  if(!first||((measure.fifths===first.fifths)&&(measure.mode===first.mode)&&!measure.tuneStart))return settings;
  const mode=modeChoices.includes(measure.mode)?measure.mode:settings.mode||'major',major=keyNames[fifthValues.indexOf(measure.fifths)]||'C';
  const q=scaleFor(major,'major')[0]+({major:0,minor:9,dorian:2,mixolydian:7}[mode]||0),p=pitch(60+q%12,measure.fifths<0);
  return {...settings,mode,root:p.step+(p.alter===1?'#':p.alter===-1?'b':'')};
}
export function structureOf(measure){
  const bars=direct(measure.el,'barline'),left=bars.find(b=>b.getAttribute('location')==='left'),right=bars.find(b=>b.getAttribute('location')!=='left');
  const endingStart=direct(left,'ending').find(e=>e.getAttribute('type')==='start'),endingEnd=direct(right,'ending').find(e=>['stop','discontinue'].includes(e.getAttribute('type')));
  return {fifths:measure.fifths,mode:measure.mode,clef:measure.clef,meter:measure.beats+'/'+measure.beatType,title:measure.tuneStart||'',repeatStart:direct(left,'repeat').some(r=>r.getAttribute('direction')==='forward'),repeatEnd:direct(right,'repeat').some(r=>r.getAttribute('direction')==='backward'),endingStart:endingStart?.getAttribute('number')||'',endingEnd:endingEnd?.getAttribute('number')||'',barStyle:txt(right,'bar-style','regular'),words:direct(measure.el,'direction').flatMap(d=>Array.from(d.getElementsByTagName('words'))).map(w=>w.textContent).join(' · ')};
}
export function writeBarline(measure,location,{repeat=false,ending='',endingType='start',style='regular'}={}){
  const d=measure.ownerDocument;direct(measure,'barline').filter(b=>(b.getAttribute('location')||'right')===location).forEach(b=>b.remove());
  if(!repeat&&!ending&&style==='regular')return;
  const b=elem(d,'barline');b.setAttribute('location',location);b.append(elem(d,'bar-style',repeat?(location==='left'?'heavy-light':'light-heavy'):style));
  if(ending){const e=elem(d,'ending',endingType==='start'?ending+'.':'');e.setAttribute('number',ending);e.setAttribute('type',endingType);b.append(e);}
  if(repeat){const r=elem(d,'repeat');r.setAttribute('direction',location==='left'?'forward':'backward');b.append(r);}
  if(location==='left')measure.insertBefore(b,direct(measure,'attributes')[0]?.nextSibling||measure.firstChild);else measure.append(b);
}
export function applyStructure(doc,id,index,value,adjustPitches=false){
  const ms=measures(doc,id),m=ms[index];if(!m)throw Error('Choose a measure.');
  const [beats,beatType]=String(value.meter).split('/').map(Number),fifths=Number(value.fifths);
  if(!Number.isInteger(fifths)||Math.abs(fifths)>7||!Number.isInteger(beats)||beats<1||beats>32||![1,2,4,8,16,32].includes(beatType))throw Error('Choose a valid key and time signature.');
  for(const key of ['endingStart','endingEnd'])if(value[key]&&!/^\d+(?:,\d+)*$/.test(value[key]))throw Error('Use ending numbers such as 1 or 1,2.');
  if(adjustPitches&&fifths!==m.fifths){
    for(let i=index;i<ms.length;i++){
      if(i>index&&direct(direct(ms[i].el,'attributes')[0],'key').length)break;
      for(const n of ms[i].notes){const p=direct(n.el,'pitch')[0];if(!p||direct(n.el,'accidental').length)continue;const step=txt(p,'step'),old=Number(txt(p,'alter',0));if(old===keyAlter(step,ms[i].fifths))writePitch(n.el,{step,octave:Number(txt(p,'octave')),alter:keyAlter(step,fifths)});}
    }
  }
  let a=direct(m.el,'attributes')[0];if(!a){a=elem(doc,'attributes');m.el.prepend(a);}
  for(const tag of ['key','time','clef'])direct(a,tag).forEach(e=>e.remove());
  const k=elem(doc,'key');k.append(elem(doc,'fifths',fifths),elem(doc,'mode',value.mode||'major'));
  const t=elem(doc,'time');t.append(elem(doc,'beats',beats),elem(doc,'beat-type',beatType));
  const c=elem(doc,'clef');c.append(elem(doc,'sign',value.clef==='bass'?'F':value.clef==='alto'?'C':'G'),elem(doc,'line',value.clef==='bass'?4:value.clef==='alto'?3:2));
  const before=direct(a,'staves')[0]||direct(a,'transpose')[0]||null;a.insertBefore(k,before);a.insertBefore(t,before);a.insertBefore(c,direct(a,'transpose')[0]||null);
  for(const d of direct(m.el,'direction'))if(d.getElementsByTagName('rehearsal').length||d.getElementsByTagName('words').length)d.remove();
  for(const [tag,text] of [['rehearsal',value.title],['words',value.words]])if(text?.trim()){
    const d=elem(doc,'direction'),type=elem(doc,'direction-type');d.setAttribute('placement','above');const label=elem(doc,tag,text.trim().slice(0,180));if(tag==='rehearsal'){label.setAttribute('enclosure','none');label.setAttribute('font-size','16');label.setAttribute('font-weight','bold');}type.append(label);d.append(type);m.el.insertBefore(d,direct(m.el,'note')[0]||null);
  }
  if(value.title?.trim()&&index>0){let print=direct(m.el,'print')[0];if(!print){print=elem(doc,'print');m.el.prepend(print);}print.setAttribute('new-system','yes');}
  writeBarline(m.el,'left',{repeat:value.repeatStart,ending:value.endingStart});
  writeBarline(m.el,'right',{repeat:value.repeatEnd,ending:value.endingEnd,endingType:value.repeatEnd?'stop':'discontinue',style:value.barStyle||'regular'});
  m.el.removeAttribute('data-structure-review');
  return doc;
}
