import {OpenSheetMusicDisplay} from 'opensheetmusicdisplay';
import {parse,parts,measures} from './music.js';
import {Player,playbackEvents} from './audio.js';
import {openSheetReader} from './sheet-reader.js';
import {bindScoreNotes} from './score-selection.js';
import {createLocator} from './locator.js';
const $=id=>document.getElementById(id),player=new Player(),locator=createLocator($('notation'));
let doc,renderer,revision=0;
let selectedParts=new Set(),partDefinitions=[],partMeasures=new Map(),prepared=null,preparing=false,audioRevision=0,audioWorker=null;
const audioCache=new Map();
function mixKey(){return JSON.stringify([Number($('tempo').value),partDefinitions.filter(p=>selectedParts.has(p.id)).map(p=>p.id)]);}
function prepareAudio(){
 const token=++audioRevision;audioWorker?.terminate();audioWorker=null;prepared=null;preparing=false;
 if(!doc||!selectedParts.size){$('audioStatus').textContent='';refreshMix();return;}
 const tempo=Number($('tempo').value);
 if(!Number.isFinite(tempo)||tempo<30||tempo>240){$('audioStatus').textContent='Choose a tempo from 30 to 240 BPM.';refreshMix();return;}
 const key=mixKey();
 if(audioCache.has(key)){prepared=audioCache.get(key);$('audioStatus').textContent='Audio ready';refreshMix();return;}
 preparing=true;$('audioStatus').textContent='Preparing audio in the background…';refreshMix();
 try{
  const sequence=playbackEvents(doc,tempo,{parts:Object.fromEntries(partDefinitions.map(p=>[p.id,selectedParts.has(p.id)?.6:0])),melody:.6,harmony:.6,chords:0},{},true);
  audioWorker=new Worker(new URL('./score-audio-worker.js',import.meta.url),{type:'module'});
  audioWorker.onmessage=event=>{
   if(token!==audioRevision)return;
   audioWorker.terminate();audioWorker=null;preparing=false;
   if(event.data.error){$('audioStatus').textContent=event.data.error;refreshMix();return;}
   prepared={sequence,wave:event.data.wave};audioCache.set(key,prepared);
   // Keep only two mixes, bounding phone memory even after many solo/tempo changes.
   while(audioCache.size>2)audioCache.delete(audioCache.keys().next().value);
   $('audioStatus').textContent='Audio ready';refreshMix();
  };
  audioWorker.onerror=()=>{if(token!==audioRevision)return;audioWorker?.terminate();audioWorker=null;preparing=false;$('audioStatus').textContent='Audio preparation failed. Tap Retry audio.';refreshMix();};
  audioWorker.postMessage(sequence);
 }catch(error){preparing=false;audioWorker?.terminate();audioWorker=null;$('audioStatus').textContent=error.message;refreshMix();}
}

function refreshMix(){
 const ps=partDefinitions,count=selectedParts.size;
 $('play').disabled=!count||preparing;
 $('play').textContent=player.playing?'Stop playback':preparing?'Preparing audio…':!prepared?'Retry audio':count===ps.length?'Play all parts':count===1?'Play selected part':'Play selected parts';
 $('partOptions').querySelectorAll('input').forEach(input=>input.checked=selectedParts.has(input.value));
 $('mixStatus').textContent=count===ps.length?'All parts together':count?ps.filter(p=>selectedParts.has(p.id)).map(p=>p.name).join(' + '):'Select at least one part.';
}
function renderPartOptions(){
 const ps=partDefinitions;selectedParts=new Set(ps.map(p=>p.id));$('partOptions').replaceChildren();
 for(const part of ps){
  const group=document.createElement('span');group.className='partOption';
  const label=document.createElement('label'),checkbox=document.createElement('input');
  checkbox.type='checkbox';checkbox.value=part.id;checkbox.checked=true;
  checkbox.onchange=()=>{const checked=checkbox.checked;player.stop();if(checked)selectedParts.add(part.id);else selectedParts.delete(part.id);prepareAudio();};
  label.append(checkbox,document.createTextNode(part.name));
  const solo=document.createElement('button');solo.type='button';solo.textContent='Solo';solo.setAttribute('aria-label','Select only '+part.name);
  solo.onclick=()=>{player.stop();selectedParts=new Set([part.id]);prepareAudio();};
  group.append(label,solo);$('partOptions').append(group);
 }
 refreshMix();
}
$('allParts').onclick=()=>{player.stop();if(doc){selectedParts=new Set(partDefinitions.map(p=>p.id));prepareAudio();}};

player.onPosition=position=>locator.play(position);
player.onStop=()=>{refreshMix();locator.stop();};
window.addEventListener('message',async e=>{
 if(e.origin!==location.origin||e.source!==window.parent)return;
 if(e.data?.type==='open-sheet-reader'){$('full').click();return;}
 if(e.data?.type!=='oxbows-score'||typeof e.data.xml!=='string')return;
 const token=++revision;player.stop();++audioRevision;audioWorker?.terminate();audioWorker=null;audioCache.clear();prepared=null;preparing=false;$('play').disabled=true;
 try{doc=parse(e.data.xml);partDefinitions=parts(doc);partMeasures=new Map(partDefinitions.map(p=>[p.id,measures(doc,p.id)]));const tempo=Number(e.data.tempo);$('tempo').value=Number.isFinite(tempo)&&tempo>=30&&tempo<=240?tempo:64;
 renderPartOptions();prepareAudio();$('status').textContent='Laying out sheet music…';await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));if(token!==revision)return;
 renderer??=new OpenSheetMusicDisplay($('notation'),{autoResize:false,backend:'svg',drawTitle:true,drawComposer:true,drawPartNames:true});
 await renderer.load(doc);if(token!==revision)return;renderer.render();bindScoreNotes(renderer,$('notation'),doc,{onSelect:(part,measure,note)=>{locator.select(part,measure,note);player.audition(partMeasures.get(part)[measure].notes[note].soundingMidi).catch(e=>$('status').textContent=e.message);},melodyPart:parts(doc)[0].id,settings:{clef:'treble',rangeComfort:'extended'}});locator.bind(doc);
 $('status').textContent=partDefinitions.length+' parts · '+partMeasures.get(partDefinitions[0].id).length+' measures';refreshMix();
 }catch(error){$('status').textContent='Unable to display score: '+error.message;}
});
$('play').onclick=async()=>{
 if(!doc)return;if(player.playing){player.stop();return;}if(!prepared){prepareAudio();return;}
 try{await player.startSequence(prepared.sequence,i=>{$('status').textContent='Measure '+partMeasures.get(partDefinitions[0].id)[i].number;},false,prepared.wave);}catch(error){$('audioStatus').textContent=error.message;}refreshMix();
};
$('stop').onclick=()=>player.stop();$('tempo').onchange=()=>{player.stop();prepareAudio();};
$('full').onclick=()=>{if(doc)openSheetReader($('score'),{key:'musicxml-score'});};
window.addEventListener('pagehide',()=>{player.stop();++audioRevision;audioWorker?.terminate();});
