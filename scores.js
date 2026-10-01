import {openSheetReader,installSheetReaderHost} from './sheet-reader.js';
import {uniqueId,packet,validatePacket,launchTransfer,receiveTransfer,readTransferFile,transferFile,download,VOILA_URL} from './score-transfer.js';
const $=id=>document.getElementById(id);
$('voilaNav').href=VOILA_URL;
$('scoreView').add(new Option('Playable MusicXML','score'));
const records=new Map();
const updates=typeof BroadcastChannel==='function'?new BroadcastChannel('oxbowsScores'):null;
let db,activePDF=null,activePacket=null,editorNonce=null,editorSongId=null,editorDirty=false,viewToken=0,objectURL=null;
let selectedSheet='',display='pdf',nextView=null;
const preferenceKey='oxbowsScoreDisplay';
const status=message=>{$('scoreStatus').textContent=message;};
function defaultView(){try{return ['pdf','transposable','editor'].includes(localStorage.getItem(preferenceKey))?localStorage.getItem(preferenceKey):'pdf';}catch{return 'pdf';}}
function idFor(song){return M[song]?.scoreId||'catalog:'+song;}
function nameFor(id){return SONGS.find(name=>idFor(name)===id);}
function hasText(song){return ['editable','editable_source'].includes(M[song]?.type);}
function latest(song){return records.get(idFor(song))?.versions.at(-1);}
function attachRecord(record){
  records.set(record.id,record);
  if(!nameFor(record.id)){
    let name=record.libraryName||record.title||'Untitled tune',base=name,n=2;
    while(Object.hasOwn(M,name))name=base+' ('+n+++')';
    SONGS.push(name);M[name]={audio:[],sheets:[],type:'musicxml',note:'Saved on this device',scoreId:record.id};
  }
}
function requestDB(){return new Promise((resolve,reject)=>{
  const request=indexedDB.open('oxbowsScores',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('scores',{keyPath:'id'});
  request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);
});}
function transaction(mode,action){return new Promise((resolve,reject)=>{
  const tx=db.transaction('scores',mode),request=action(tx.objectStore('scores'));
  tx.oncomplete=()=>resolve(request.result);tx.onabort=tx.onerror=()=>reject(tx.error||request.error||Error('Could not save the score.'));
});}
async function saveScore(raw,forcedId=null){
  const data=validatePacket(raw);
  if(data.kind!=='score')throw Error('Scan the PDF in Voilà! and send back the edited score.');
  if(!db)throw Error('Score storage is unavailable. Download your MusicXML or transfer file before closing.');
  const linked=forcedId||data.songId;
  const id=linked&&nameFor(linked)?linked:'local:'+uniqueId();
  let record;
  try{await new Promise((resolve,reject)=>{
    const tx=db.transaction('scores','readwrite'),store=tx.objectStore('scores'),request=store.get(id);
    request.onsuccess=()=>{const old=request.result;record={id,title:data.title,libraryName:old?.libraryName||nameFor(id)||data.title,versions:[...(old?.versions||[]),{...data,songId:id,savedAt:new Date().toISOString()}]};store.put(record);};
    tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error);
  });}catch{throw Error('The browser could not save this score. Storage may be full or blocked. Download the score from Export before closing.');}
  updates?.postMessage(id);
  attachRecord(record);renderLibrary(search.value);renderSetCards();
  return record;
}
function setEditingControls(isText){transposeBox.style.display=isText?'flex':'none';for(const el of [minus,plus,boldBtn,colBtn])el.style.display=isText?'inline-block':'none';if(typeof syncFullscreenButton==='function')syncFullscreenButton();}
function sources(song){
  const versions=records.get(idFor(song))?.versions||[];
  return [...(M[song].musicxml?[{key:'catalog-xml',label:M[song].scoreLabel||'MusicXML score',xmlURL:'music/'+M[song].musicxml}]:[]),...versions.map((v,i)=>({key:'saved:'+i,label:`Edited score · version ${i+1}${i===versions.length-1?' (latest)':''}`,data:v})).reverse(),...(M[song].sheets||[]).map((f,i)=>({key:'original:'+i,label:M[song].sheetLabels?.[i]||`Original sheet${M[song].sheets.length>1?' '+(i+1):''}`,url:'music/'+f}))];
}
async function selectedData(){
  const item=sources(current).find(item=>item.key===selectedSheet);
  if(item?.data)return item.data;
  if(item?.xmlURL){const response=await fetch(item.xmlURL);if(!response.ok)throw Error('Could not load MusicXML score.');return packet({kind:'score',title:current,xml:await response.text(),songId:idFor(current)});}
  if(item?.url){const response=await fetch(item.url);if(!response.ok)throw Error('Could not load this sheet. Try its Open Sheet link.');return packet({kind:'scan',title:current,pdf:await response.blob(),songId:idFor(current)});}
  return latest(current)||null;
}
async function renderView(view=display){
  const token=++viewToken,song=current;
  display=view;window.SongbookScores.display=view;setEditingControls(view==='transposable'&&hasText(song));
  if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null;}
  $('scoreView').value=view;activePDF=null;activePacket=null;
  if(view==='transposable'&&hasText(song)){void selectedData().then(data=>{if(token!==viewToken)return;activePacket=data;activePDF=data?.pdf;$('editScore').disabled=!data?.xml;$('exportXML').disabled=!data?.xml;$('sendVoila').disabled=!data;$('downloadScorePDF').disabled=!activePDF;$('backupScore').disabled=!data;}).catch(e=>status(e.message));if(M[song].type==='editable')renderLight();else renderSourceEditable(song);return;}
  if(view==='editor'){
    const score=await selectedData();if(token!==viewToken||song!==current)return;
    if(score?.xml){await openEditor(score,null,idFor(song));return;}
    display='pdf';window.SongbookScores.display='pdf';$('scoreView').value='pdf';status('Import MusicXML or scan the PDF in Voilà! to edit the notes.');
  }
  content.innerHTML='<p class="placeholder">Loading sheet music…</p>';
  try{
    const data=await selectedData();if(token!==viewToken||song!==current)return;
    activePacket=data;activePDF=data?.pdf;titleEl.textContent=data?.kind==='score'?data.title:song;
    $('editScore').disabled=!data?.xml;$('exportXML').disabled=!data?.xml;$('sendVoila').disabled=!data;
    $('downloadScorePDF').disabled=!activePDF;$('backupScore').disabled=!data;
    if(data?.xml&&(view==='score'||!activePDF)){
      display='score';window.SongbookScores.display='score';$('scoreView').value='score';
      const frame=document.createElement('iframe');frame.className='scorePDF';frame.title='Playable MusicXML score';frame.src='editor/score.html';frame.allow='autoplay; fullscreen';
      frame.addEventListener('load',()=>frame.contentWindow.postMessage({type:'oxbows-score',xml:data.xml,tempo:M[song].scoreTempo||64},location.origin),{once:true});content.replaceChildren(frame);
    }else if(activePDF){
      display='pdf';window.SongbookScores.display='pdf';$('scoreView').value='pdf';
      objectURL=URL.createObjectURL(activePDF);
      const frame=document.createElement('iframe');frame.className='scorePDF';frame.title='Printable sheet music PDF';frame.src='editor/pdf.html';
      frame.addEventListener('load',()=>frame.contentWindow.postMessage({type:'oxbows-pdf',pdf:data.pdf},location.origin),{once:true});content.replaceChildren(frame);
    }else if(M[song].image){const image=document.createElement('img');image.className='notationImage';image.src='music/'+M[song].image;image.alt=song+' notation';content.replaceChildren(image);}
    else if(hasText(song)){
      display='transposable';window.SongbookScores.display=display;$('scoreView').value=display;setEditingControls(true);
      if(M[song].type==='editable')renderLight();else renderSourceEditable(song);status('No PDF is available for this song yet. Showing its transposable layout.');
    }else content.innerHTML='<div class="placeholder">Import a MusicXML score to edit and save a printable PDF for this song.</div>';
  }catch(e){if(token===viewToken){content.textContent=e.message;status(e.message);}}
}
function openSongScores(song){
  $('scoreToolbar').hidden=false;$('player').style.display=M[song].audio.length?'':'none';status('');activePacket=null;activePDF=null;for(const id of ['editScore','exportXML','sendVoila','downloadScorePDF','backupScore'])$(id).disabled=true;
  const choices=sources(song);selectedSheet=choices[0]?.key||'';
  $('scoreSheet').replaceChildren(...choices.map(item=>new Option(item.label,item.key)));$('scoreSheet').disabled=!choices.length;
  $('scoreView').querySelector('[value="transposable"]').disabled=!hasText(song);
  $('scoreView').querySelector('[value="editor"]').disabled=!(latest(song)?.xml||M[song].musicxml);
  let view=nextView||M[song].defaultScoreView||defaultView();nextView=null;if(view==='transposable'&&!hasText(song)||view==='editor'&&!(latest(song)?.xml||M[song].musicxml))view='pdf';
  void renderView(view);
}
async function openEditor(data=null,file=null,songId=null){
  audio.pause();if(typeof leaveFocusMode==='function')await leaveFocusMode();
  editorSongId=songId||data?.songId||null;editorNonce=uniqueId();editorDirty=true;
  status('');show('scoreWorkspace');$('workspaceStatus').textContent='Loading the Voilà! workspace…';
  const frame=$('scoreEditor');frame.src='editor/?songbook=1&session='+encodeURIComponent(editorNonce);
  const handler=async event=>{
    if(event.source!==frame.contentWindow||event.origin!==location.origin||event.data?.protocol!=='oxbows-editor-v1'||event.data.nonce!==editorNonce)return;
    const reply=(type,extra={})=>frame.contentWindow.postMessage({protocol:'oxbows-editor-v1',nonce:editorNonce,type,...extra},location.origin);
    try{
      if(event.data.type==='ready')reply('load',{data,file,songId:editorSongId});
      if(event.data.type==='loaded'){editorDirty=!data?.xml;$('workspaceStatus').textContent='Edit, play, then Save to Songbook. Each save keeps a new version.';}
      if(event.data.type==='save'){
        $('workspaceStatus').textContent='Saving score and printable PDF…';
        const record=await saveScore(event.data.data,editorSongId);editorSongId=record.id;editorDirty=false;
        reply('saved',{songId:record.id});$('workspaceStatus').textContent='Saved on this device. Download a transfer file to keep a backup or move it to another device.';
      }
      if(event.data.type==='dirty')editorDirty=true;
      if(event.data.type==='error')$('workspaceStatus').textContent=event.data.message;
    }catch(e){reply('error',{message:e.message});$('workspaceStatus').textContent=e.message;}
  };
  if(window.editorMessageHandler)window.removeEventListener('message',window.editorMessageHandler);
  window.editorMessageHandler=handler;window.addEventListener('message',handler);
}
$('closeWorkspace').onclick=()=>{
  if(editorDirty&&!confirm('Leave the editor? Changes since your last save will be lost.'))return;
  $('scoreEditor').src='about:blank';window.removeEventListener('message',window.editorMessageHandler);
  const song=nameFor(editorSongId);if(song){nextView='pdf';openSong(song);}else show('library');
};
$('defaultScoreView').value=defaultView();$('defaultScoreView').onchange=e=>{try{localStorage.setItem(preferenceKey,e.target.value);status('Default display saved for this browser.');}catch{status('Your browser could not save the display preference.');}};
$('scoreView').onchange=e=>{if(focusModeActive)void leaveFocusMode();void renderView(e.target.value);};
$('scoreSheet').onchange=e=>{selectedSheet=e.target.value;void renderView(display==='editor'?'pdf':display);};
$('editScore').onclick=()=>openEditor(activePacket,null,idFor(current));
$('sendVoila').onclick=()=>launchTransfer(VOILA_URL,selectedData,status);
$('exportXML').onclick=()=>{if(activePacket?.xml)download(new Blob([activePacket.xml],{type:'application/vnd.recordare.musicxml+xml'}),activePacket.title+'.musicxml');};
$('downloadScorePDF').onclick=()=>{if(activePDF)download(activePDF,(activePacket?.title||current)+'.pdf');};
$('backupScore').onclick=async()=>{try{const data=await selectedData();if(data)download(await transferFile(data),data.title+'.voila');}catch(e){status(e.message);}};
let importTarget=null;
$('importScore').onclick=()=>{importTarget=null;$('scoreImportFile').click();};
$('importForSong').onclick=()=>{importTarget=idFor(current);$('scoreImportFile').click();};
$('scoreImportFile').onchange=async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  try{
    if(file.name.toLowerCase().endsWith('.voila')){
      const data=await readTransferFile(file);
      if(data.kind==='score'&&data.pdf){const record=await saveScore(data,importTarget);openSong(nameFor(record.id));status('Imported from Voilà! Original sheets and earlier versions are still available.');}
      else await openEditor(data,null,importTarget);
    }else if(file.name.toLowerCase().endsWith('.pdf'))await openEditor(packet({kind:'scan',title:file.name.replace(/\.pdf$/i,''),pdf:file,songId:importTarget}),null,importTarget);
    else await openEditor(null,file,importTarget);
  }catch(e){status(e.message);}
};
window.SongbookScores={open:openSongScores,hasScore:song=>!!(latest(song)||M[song].musicxml),get display(){return display;},set display(value){display=value;}};
try{db=await requestDB();for(const record of await transaction('readonly',store=>store.getAll()))attachRecord(record);renderLibrary(search.value);}catch{status('Saved-score storage is unavailable in this browser. Export edits before closing.');}
if(updates)updates.onmessage=async event=>{if(!db)return;const record=await transaction('readonly',store=>store.get(event.data));if(record){attachRecord(record);renderLibrary(search.value);if(current&&idFor(current)===record.id&&$('song').classList.contains('on'))openSongScores(current);}};
receiveTransfer(async data=>{
  if(data.kind==='score'&&data.pdf){const record=await saveScore(data);openSong(nameFor(record.id));status('Received from Voilà! Your score and printable PDF are saved on this device.');}
  else await openEditor(data,null,data.songId);
},status);

installSheetReaderHost();
const readSheetButton=document.createElement('button');readSheetButton.className='ctl';readSheetButton.textContent='Full-screen sheet';document.getElementById('scoreToolbar').append(readSheetButton);
readSheetButton.onclick=()=>{const frame=content.querySelector('iframe.scorePDF');if(frame){frame.contentWindow.postMessage({type:'open-sheet-reader'},location.origin);}else if(content.firstElementChild){openSheetReader(content,{key:'song:'+current});}};
