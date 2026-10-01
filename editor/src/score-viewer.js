import {OpenSheetMusicDisplay} from 'opensheetmusicdisplay';
import {parse,parts,measures} from './music.js';
import {Player} from './audio.js';
import {openSheetReader} from './sheet-reader.js';
import {bindScoreNotes} from './score-selection.js';
import {createLocator} from './locator.js';
const $=id=>document.getElementById(id),player=new Player(),locator=createLocator($('notation'));
let doc,renderer,revision=0;
player.onPosition=position=>locator.play(position);
player.onStop=()=>{$('play').textContent='Play score';locator.stop();};
window.addEventListener('message',async e=>{
 if(e.origin!==location.origin||e.source!==window.parent)return;
 if(e.data?.type==='open-sheet-reader'){$('full').click();return;}
 if(e.data?.type!=='oxbows-score'||typeof e.data.xml!=='string')return;
 const token=++revision;player.stop();$('play').disabled=true;
 try{doc=parse(e.data.xml);const tempo=Number(e.data.tempo);$('tempo').value=Number.isFinite(tempo)&&tempo>=30&&tempo<=240?tempo:64;
 renderer??=new OpenSheetMusicDisplay($('notation'),{autoResize:false,backend:'svg',drawTitle:true,drawComposer:true,drawPartNames:true});
 await renderer.load(doc);if(token!==revision)return;renderer.render();bindScoreNotes(renderer,$('notation'),doc,{onSelect:(part,measure,note)=>{locator.select(part,measure,note);player.audition(measures(doc,part)[measure].notes[note].soundingMidi).catch(e=>$('status').textContent=e.message);},melodyPart:parts(doc)[0].id,settings:{clef:'treble',rangeComfort:'extended'}});locator.bind(doc);
 $('status').textContent=parts(doc).length+' parts · '+measures(doc,parts(doc)[0].id).length+' measures';$('play').disabled=false;
 }catch(error){$('status').textContent='Unable to display score: '+error.message;}
});
$('play').onclick=async()=>{if(!doc)return;if(player.playing){player.stop();return;}const tempo=Number($('tempo').value);if(!Number.isFinite(tempo)||tempo<30||tempo>240){$('status').textContent='Choose a tempo from 30 to 240 BPM.';return;}try{await player.play(doc,tempo,{melody:.65,harmony:.55,fiddle:.55,cello:.55,doubleBass:.5,drone:.4,chords:0},{},i=>{$('status').textContent='Measure '+measures(doc,parts(doc)[0].id)[i].number;});$('play').textContent=player.playing?'Stop playback':'Play score';}catch(error){$('status').textContent=error.message;}};
$('stop').onclick=()=>player.stop();$('tempo').onchange=()=>player.stop();
$('full').onclick=()=>{if(doc)openSheetReader($('score'),{key:'musicxml-score'});};
window.addEventListener('pagehide',()=>player.stop());
