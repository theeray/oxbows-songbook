import {measures,parts,parseChord,harmonyEvents} from './music.js';

export function playbackEvents(doc,tempo,volumes,chords,repeat=true,startAt=null){
  const ps=parts(doc),mel=measures(doc,ps[0].id);
  const order=[];let startRepeat=0,activeEnding=null;const endings=mel.map(m=>{const signs=Array.from(m.el.getElementsByTagName('ending'));for(const e of signs)if(e.getAttribute('type')==='start')activeEnding=e.getAttribute('number').split(/[, ]+/).map(Number);const here=activeEnding;if(signs.some(e=>['stop','discontinue'].includes(e.getAttribute('type'))))activeEnding=null;return here;});
  for(let i=0;i<mel.length;i++){
    if(mel[i].tuneStart)startRepeat=i;const signs=Array.from(mel[i].el.getElementsByTagName('repeat'));
    if(signs.some(r=>r.getAttribute('direction')==='forward'))startRepeat=i;
    order.push(i);
    if(repeat&&signs.some(r=>r.getAttribute('direction')==='backward')){
      for(let j=startRepeat;j<=i;j++){
        if(!endings[j]||endings[j].includes(2))order.push(j);
      }
      startRepeat=i+1;
    }
  }
  const beat=60/tempo,markers=[],events=[];let duration=0;
  for(const mi of order){markers.push({time:duration,index:mi,offset:0,duration:mel[mi].duration*beat});duration+=mel[mi].duration*beat;}
  if(duration>600)throw Error('Please use a selection of ten minutes or less for the audio preview.');
  for(const part of ps){
    const ms=measures(doc,part.id),volume=volumes.parts?.[part.id]??(part.id===ps[0].id?volumes.melody:/double bass|contrabass/i.test(part.name)?(volumes.doubleBass??.4):/cello/i.test(part.name)?(volumes.cello??.4):part.name.toLowerCase().includes('drone')?volumes.drone:part.name.toLowerCase().includes('fiddle')?(volumes.fiddle??volumes.harmony):volumes.harmony);
    let offset=0;const tied=new Map();
    for(const mi of order){
      for(const note of ms[mi]?.notes||[]){
        if(note.grace||note.midi===null||note.duration<=0||!volume)continue;
        const tieTypes=Array.from(note.el.getElementsByTagName('tie')).map(t=>t.getAttribute('type'));
        const key=note.voice+':'+note.soundingMidi,previous=tied.get(key),start=offset+note.start*beat,length=note.duration*beat;
        if(tieTypes.includes('stop')&&previous&&Math.abs(previous.start+previous.duration-start)<.002){previous.duration+=length;if(!tieTypes.includes('start'))tied.delete(key);continue;}
        const event={midi:note.soundingMidi,start,duration:length,volume,type:part.name.toLowerCase().includes('drone')?'sine':'strings'};events.push(event);
        if(tieTypes.includes('start'))tied.set(key,event);else tied.delete(key);
      }
      offset+=mel[mi].duration*beat;
    }
  }
  let offset=0,previousVoicing=[];
  for(const mi of order){
    const symbols=harmonyEvents(mel[mi]);
    const changes=Array.isArray(chords[mi])?chords[mi]:symbols.length?symbols:[{start:0,name:chords[mi]||''}];
    for(let i=0;i<changes.length;i++){
      const chord=parseChord(changes[i].name||'');if(!chord||!volumes.chords)continue;
      const start=changes[i].start*beat,end=Math.min(mel[mi].duration,changes[i+1]?.start??mel[mi].duration)*beat;
      if(end<=start)continue;
      const voiced=guitarVoicing(chord,previousVoicing);previousVoicing=voiced;
      voiced.forEach((midi,j)=>events.push({midi,start:offset+start+j*.014,duration:Math.max(.02,end-start-j*.014),volume:volumes.chords,type:'pluck'}));
    }
    offset+=mel[mi].duration*beat;
  }
  if(startAt){
    const index=markers.findIndex(m=>m.index===startAt.measure);
    if(index>=0){
      const offset=Math.max(0,Math.min(Number(startAt.offset)||0,mel[startAt.measure].duration));
      const cut=markers[index].time+offset*beat;
      // Retrigger any held harmony/drone/chord at the new start, with only its
      // remaining duration. This also handles starting inside a tied note.
      return {events:events.filter(e=>e.start+e.duration>cut+.000001).map(e=>({...e,start:Math.max(0,e.start-cut),duration:e.start+e.duration-Math.max(e.start,cut)})),markers:markers.slice(index).map((m,i)=>({...m,time:Math.max(0,m.time-cut),offset:i===0?offset:0})),beat,duration:Math.max(0,duration-cut)};
    }
  }
  return {events,markers,beat,duration};
}

export function playbackPosition(sequence,time){
  let marker;
  for(const item of sequence.markers){if(item.time>time)break;marker=item;}
  if(!marker)return null;
  return {measure:marker.index,offset:Math.min(marker.duration/sequence.beat,(marker.offset||0)+Math.max(0,time-marker.time)/sequence.beat)};
}

export function guitarVoicing(chord,previous=[]){
  const bassPc=chord.bass?.pc??chord.pc,bass=40+((bassPc-40)%12+12)%12;
  let best=[],bestCost=Infinity;
  for(let inversion=0;inversion<chord.triad.length;inversion++){
    const tones=chord.triad.slice(inversion).concat(chord.triad.slice(0,inversion));
    const voice=[bass];let floor=Math.max(48,bass+5);
    for(const pc of tones){const note=floor+((pc-floor)%12+12)%12;voice.push(note);floor=note+1;}
    const cost=voice.reduce((sum,n,i)=>sum+Math.abs(n-(previous[i]??[45,52,57,62,65][i])),0)+Math.max(0,voice.at(-1)-69)*3;
    if(cost<bestCost){best=voice;bestCost=cost;}
  }
  return best;
}

// Real PCM media gives iOS the same playback route as a music file, rather than
// routing oscillators through the ambient/silent-switch Web Audio category.
export function synthesizeWave(sequence,sampleRate=22050){
  const samples=new Float32Array(Math.ceil((sequence.duration+.12)*sampleRate));
  for(const event of sequence.events){
    const start=Math.round(event.start*sampleRate),length=Math.ceil(event.duration*sampleRate),frequency=440*2**((event.midi-69)/12);
    const attack=Math.min(.015,event.duration*.15),release=Math.min(.065,event.duration*.2);
    for(let j=0;j<length&&start+j<samples.length;j++){
      const t=j/sampleRate,phase=2*Math.PI*frequency*t;
      let envelope=Math.min(1,t/attack,(event.duration-t)/release);
      if(event.type==='pluck')envelope*=Math.exp(-2.4*t/Math.max(.4,event.duration));
      const wave=event.type==='sine'?Math.sin(phase):Math.sin(phase)+.25*Math.sin(phase*2)+.12*Math.sin(phase*3);
      samples[start+j]+=wave*envelope*event.volume*.27;
    }
  }
  let peak=0;for(const sample of samples)peak=Math.max(peak,Math.abs(sample));
  const gain=peak>.9?.9/peak:1,buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer);
  const text=(offset,s)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,36+samples.length*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++)view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,samples[i]*gain))*32767),true);
  return buffer;
}

export class Player{
  constructor(){this.audio=null;this.url=null;this.playing=false;this.timer=null;this.generation=0;}
  stop(){this.generation++;if(this.audio){this.audio.pause();this.audio.currentTime=0;}clearInterval(this.timer);if(this.frame)cancelAnimationFrame(this.frame);this.frame=null;this.playing=false;this.onStop?.();}
  play(doc,tempo,volumes,chords,onMeasure,repeat=true,startAt=null){
    const sequence=playbackEvents(doc,tempo,volumes,chords,repeat,startAt);
    if(!sequence.events.length){this.stop();throw Error('There are no audible notes. Turn up a part in the mixer.');}
    return this.startSequence(sequence,onMeasure,false);
  }
  audition(midi){
    if(midi===null||!Number.isFinite(midi)){this.stop();return Promise.resolve(false);}
    return this.startSequence({events:[{midi,start:0,duration:.45,volume:.65,type:'strings'}],markers:[],duration:.45},null,true);
  }
  async startSequence(sequence,onMeasure,audition){
    this.stop();const generation=this.generation;
    try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}
    if(!this.audio){this.audio=document.createElement('audio');this.audio.preload='auto';this.audio.setAttribute('playsinline','');this.audio.hidden=true;document.body.appendChild(this.audio);}
    this.audio.onended=()=>{if(generation===this.generation)this.stop();};
    if(this.url)URL.revokeObjectURL(this.url);
    this.url=URL.createObjectURL(new Blob([synthesizeWave(sequence)],{type:'audio/wav'}));
    this.audio.src=this.url;this.audio.muted=false;this.audio.volume=1;
    // Keep play() in the originating button gesture: no awaits before this call.
    this.playing=!audition;
    try{await this.audio.play();}catch(error){
      // Rapid clicks/arrow presses deliberately interrupt earlier previews.
      if(generation!==this.generation)return false;
      this.stop();throw Error(audition?'Note preview could not start. Tap the note again and check your device’s media volume.':'Audio could not start. Tap Play again and check your phone’s media volume or connected Bluetooth speaker.');
    }
    if(generation!==this.generation)return false;
    if(!audition){
      onMeasure?.(sequence.markers[0]?.index);
      const tick=()=>{
        if(generation!==this.generation||!this.playing)return;
        const position=playbackPosition(sequence,this.audio.currentTime);
        if(position)this.onPosition?.(position);
        this.frame=requestAnimationFrame(tick);
      };
      tick();
      this.timer=setInterval(()=>{let active;for(const marker of sequence.markers){if(marker.time>this.audio.currentTime)break;active=marker;}if(active)onMeasure?.(active.index);},100);
    }
    return true;
  }
}
