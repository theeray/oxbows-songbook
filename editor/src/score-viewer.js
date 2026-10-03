import {OpenSheetMusicDisplay} from 'opensheetmusicdisplay';
import {parse,parts,measures} from './music.js';
import {Player} from './audio.js';
import {openSheetReader} from './sheet-reader.js';
import {bindScoreNotes} from './score-selection.js';
import {createLocator} from './locator.js';
const $=id=>document.getElementById(id),player=new Player(),locator=createLocator($('notation'));
let doc,renderer,revision=0;
let selectedParts=new Set();
function refreshMix(){
 const ps=doc?parts(doc):[],count=selectedParts.size;
 $('play').disabled=!count;
 $('play').textContent=player.playing?'Stop playback':count===ps.length?'Play all parts':count===1?'Play selected part':'Play selected parts';
 $('partOptions').querySelectorAll('input').forEach(input=>input.checked=selectedParts.has(input.value));
 $('mixStatus').textContent=count===ps.length?'All parts together':count?ps.filter(p=>selectedParts.has(p.id)).map(p=>p.name).join(' + '):'Select at least one part.';
}
function renderPartOptions(){
 const ps=parts(doc);selectedParts=new Set(ps.map(p=>p.id));$('partOptions').replaceChildren();
 for(const part of ps){
  const group=document.createElement('span');group.className='partOption';
  const label=document.createElement('label'),checkbox=document.createElement('input');
  checkbox.type='checkbox';checkbox.value=part.id;checkbox.checked=true;
  checkbox.onchange=()=>{const checked=checkbox.checked;player.stop();if(checked)selectedParts.add(part.id);else selectedParts.delete(part.id);refreshMix();};
  label.append(checkbox,document.createTextNode(part.name));
  const solo=document.createElement('button');solo.type='button';solo.textContent='Solo';solo.setAttribute('aria-label','Play only '+part.name);
  solo.onclick=()=>{player.stop();selectedParts=new Set([part.id]);refreshMix();$('play').click();};
  group.append(label,solo);$('partOptions').append(group);
 }
 refreshMix();
}
$('allParts').onclick=()=>{player.stop();if(doc){selectedParts=new Set(parts(doc).map(p=>p.id));refreshMix();}};

player.onPosition=position=>locator.play(position);
player.onStop=()=>{refreshMix();locator.stop();};
window.addEventListener('message',async e=>{
 if(e.origin!==location.origin||e.source!==window.parent)return;
 if(e.data?.type==='open-sheet-reader'){$('full').click();return;}
 if(e.data?.type!=='oxbows-score'||typeof e.data.xml!=='string')return;
 const token=++revision;player.stop();$('play').disabled=true;
 try{doc=parse(e.data.xml);const tempo=Number(e.data.tempo);$('tempo').value=Number.isFinite(tempo)&&tempo>=30&&tempo<=240?tempo:64;
 renderer??=new OpenSheetMusicDisplay($('notation'),{autoResize:false,backend:'svg',drawTitle:true,drawComposer:true,drawPartNames:true});
 await renderer.load(doc);if(token!==revision)return;renderer.render();bindScoreNotes(renderer,$('notation'),doc,{onSelect:(part,measure,note)=>{locator.select(part,measure,note);player.audition(measures(doc,part)[measure].notes[note].soundingMidi).catch(e=>$('status').textContent=e.message);},melodyPart:parts(doc)[0].id,settings:{clef:'treble',rangeComfort:'extended'}});locator.bind(doc);
 renderPartOptions();$('status').textContent=parts(doc).length+' parts · '+measures(doc,parts(doc)[0].id).length+' measures';$('play').disabled=false;
 }catch(error){$('status').textContent='Unable to display score: '+error.message;}
});
$('play').onclick=async()=>{if(!doc)return;if(player.playing){player.stop();return;}const tempo=Number($('tempo').value);if(!Number.isFinite(tempo)||tempo<30||tempo>240){$('status').textContent='Choose a tempo from 30 to 240 BPM.';return;}try{await player.play(doc,tempo,{parts:Object.fromEntries(parts(doc).map(p=>[p.id,selectedParts.has(p.id)?.6:0])),melody:.6,harmony:.6,chords:0},{},i=>{$('status').textContent='Measure '+measures(doc,parts(doc)[0].id)[i].number;});refreshMix();}catch(error){$('status').textContent=error.message;}};
$('stop').onclick=()=>player.stop();$('tempo').onchange=()=>player.stop();
$('full').onclick=()=>{if(doc)openSheetReader($('score'),{key:'musicxml-score'});};
window.addEventListener('pagehide',()=>player.stop());
