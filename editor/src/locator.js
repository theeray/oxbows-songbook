import {parts,measures} from './music.js';

// DOM noteheads provide exact x coordinates at every zoom and page size.
// Audio time, rather than a CSS animation clock, drives interpolation.
export function createLocator(container){
  const line=document.createElement('div');line.className='score-locator';line.hidden=true;line.setAttribute('aria-hidden','true');
  let rows=[],heads=[],headsByMeasure=new Map(),sounding=new Set(),selection=null,lastPosition=null;
  function draw(x,row,playing=false){
    if(!row||!Number.isFinite(x)){line.hidden=true;return;}
    if(!line.isConnected)container.append(line);
    line.hidden=false;line.classList.toggle('playing',playing);line.style.transform=`translate(${x}px,${row.top}px)`;line.style.height=Math.max(56,row.bottom-row.top)+'px';
    line.dataset.measure=row.index;line.dataset.offset=String(lastPosition?.offset??'');
  }
  function clearPlaying(){for(const el of sounding)el.classList.remove('sounding-score-note');sounding.clear();}
  function selected(){
    lastPosition=null;clearPlaying();
    const h=heads.find(h=>h.part===selection?.part&&h.measure===selection.measure&&h.note===selection.note);
    if(h)draw(h.x,rows[h.measure]);else line.hidden=true;
  }
  return {
    bind(doc){
      const origin=container.getBoundingClientRect(),records=new Map(parts(doc).map(p=>[p.id,measures(doc,p.id)]));
      heads=[...container.querySelectorAll('[data-score-note]')].map(el=>{
        const part=el.dataset.scorePart,measure=Number(el.dataset.scoreMeasure),note=Number(el.dataset.scoreNote),n=records.get(part)?.[measure]?.notes[note],b=el.getBoundingClientRect();
        return {el,part,measure,note,start:n?.start||0,duration:n?.duration||0,x:b.left-origin.left+b.width/2,top:b.top-origin.top,bottom:b.bottom-origin.top};
      });
      clearPlaying();headsByMeasure=new Map();
      for(const head of heads){if(!headsByMeasure.has(head.measure))headsByMeasure.set(head.measure,[]);headsByMeasure.get(head.measure).push(head);}
      const lead=records.values().next().value||[];
      rows=lead.map((m,index)=>{
        const hh=headsByMeasure.get(index)||[],points=[];
        for(const start of [...new Set(hh.map(h=>h.start))].sort((a,b)=>a-b)){
          const group=hh.filter(h=>h.start===start),xs=group.map(h=>h.x).sort((a,b)=>a-b);points.push({offset:start,x:xs[Math.floor(xs.length/2)]});
        }
        return {index,duration:m.duration,points,top:Math.min(...hh.map(h=>h.top))-24,bottom:Math.max(...hh.map(h=>h.bottom))+24};
      });
      for(const row of rows){
        if(!row.points.length)continue;
        const next=rows[row.index+1],last=row.points.at(-1),sameLine=next?.points.length&&Math.abs(next.top-row.top)<35&&next.points[0].x>last.x;
        if(row.points[0].offset>0)row.points.unshift({offset:0,x:row.points[0].x-22});
        row.points.push({offset:row.duration,x:sameLine?next.points[0].x:Math.min(container.scrollWidth-12,last.x+45)});
      }
      if(lastPosition)this.play(lastPosition);else selected();
    },
    select(part,measure,note){selection={part,measure,note};selected();},
    play(position){
      lastPosition=position;
      const row=rows[position.measure];if(!row?.points.length){line.hidden=true;clearPlaying();return;}
      let left=row.points[0],right=row.points.at(-1);
      for(let i=0;i<row.points.length-1;i++)if(position.offset>=row.points[i].offset){left=row.points[i];right=row.points[i+1];}
      const fraction=Math.max(0,Math.min(1,(position.offset-left.offset)/(right.offset-left.offset||1)));
      draw(left.x+(right.x-left.x)*fraction,row,true);
      const next=new Set((headsByMeasure.get(position.measure)||[]).filter(h=>h.start<=position.offset+.002&&h.start+h.duration>position.offset+.002).map(h=>h.el));
      for(const el of sounding)if(!next.has(el))el.classList.remove('sounding-score-note');
      for(const el of next)if(!sounding.has(el))el.classList.add('sounding-score-note');
      sounding=next;
    },
    stop(){selected();}
  };
}
