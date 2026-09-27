// Shared by Voilà! and Oxbows Songbook. Scores travel only to the selected app.
const preview=typeof location!=='undefined'&&location.hostname==='terminal.local';
export const SONGBOOK_URL=preview?location.origin+'/oxbows-songbook/':'https://theeray.github.io/oxbows-songbook/';
export const VOILA_URL=preview?location.origin+'/':'https://voila-fiddle.the-eray.chatgpt.site/';
const protocol='oxbows-voila-v1';
export function uniqueId(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('');}
const trusted=new Set([new URL(SONGBOOK_URL).origin,new URL(VOILA_URL).origin]);
export function trustedOrigin(origin){return trusted.has(origin)||origin===location.origin;}
export function validatePacket(value){
  if(!value||value.schema!==protocol||!['score','scan'].includes(value.kind))throw Error('This is not a Voilà! score transfer.');
  const title=String(value.title||'Untitled tune').slice(0,200);
  if(value.kind==='score'&&(typeof value.xml!=='string'||value.xml.length>20e6||!value.xml.includes('<score-partwise')))throw Error('The transfer does not contain a supported MusicXML score.');
  if(value.pdf!=null&&(!(value.pdf instanceof Blob)||value.pdf.size>30e6))throw Error('Choose a PDF smaller than 30 MB.');
  if(value.kind==='scan'&&!value.pdf)throw Error('The transfer is missing its PDF.');
  let session=null;
  if(value.session!=null){
    if(JSON.stringify(value.session).length>22e6||typeof value.session.sourceXml!=='string')throw Error('The saved editing session is invalid.');
    session=value.session;
  }
  return {schema:protocol,kind:value.kind,title,xml:value.kind==='score'?value.xml:null,pdf:value.pdf||null,session,songId:typeof value.songId==='string'?value.songId.slice(0,500):null};
}
export function packet(data){return validatePacket({schema:protocol,...data});}
export function launchTransfer(destination,build,onStatus=()=>{}){
  const url=new URL(destination),nonce=uniqueId();
  if(!trustedOrigin(url.origin))throw Error('Unknown score destination.');
  url.hash=new URLSearchParams({'score-transfer':nonce,from:location.origin}).toString();
  // Open during the click gesture, before generating a PDF or reading a file.
  const target=window.open(url.href,'_blank');
  if(!target){onStatus('Allow this app to open a tab, or download a Voilà! transfer file and import it in the other app.');return;}
  let data,ready=false,sent=false,finished=false;
  const cleanup=()=>{finished=true;clearTimeout(timeout);window.removeEventListener('message',receive);};
  const send=()=>{if(ready&&data&&!sent){sent=true;target.postMessage({protocol,type:'offer',nonce,data},url.origin);onStatus('Sending score…');}};
  const receive=event=>{
    if(event.source!==target||event.origin!==url.origin||event.data?.protocol!==protocol||event.data?.nonce!==nonce)return;
    if(event.data.type==='ready'){ready=true;send();}
    if(event.data.type==='received'){cleanup();onStatus('Score received by the other app.');}
    if(event.data.type==='error'){cleanup();onStatus('Transfer failed: '+String(event.data.message||'Please use a transfer file.'));}
  };
  const timeout=setTimeout(()=>{cleanup();onStatus('The other tab did not connect. After signing in, use Download transfer file here and Import in the other app.');},90000);
  window.addEventListener('message',receive);
  onStatus('Preparing score. Keep this tab open while the other app connects…');
  Promise.resolve().then(build).then(value=>{if(!finished){data=validatePacket(value);send();}}).catch(error=>{cleanup();onStatus(error.message);});
}
export function receiveTransfer(accept,onStatus=()=>{}){
  const params=new URLSearchParams(location.hash.slice(1)),nonce=params.get('score-transfer'),origin=params.get('from');
  if(!nonce)return;
  history.replaceState(null,'',location.pathname+location.search);
  if(!window.opener||!trustedOrigin(origin)){onStatus('Import a Voilà! transfer file to receive the score. The browser could not connect the tabs.');return;}
  let busy=false;
  const send=(type,extra={})=>window.opener?.postMessage({protocol,type,nonce,...extra},origin);
  const timer=setInterval(()=>send('ready'),700);
  const expire=setTimeout(()=>{clearInterval(timer);window.removeEventListener('message',receive);if(!busy)onStatus('No score arrived. You can import a Voilà! transfer file instead.');},90000);
  const receive=async event=>{
    if(busy||event.source!==window.opener||event.origin!==origin||event.data?.protocol!==protocol||event.data.nonce!==nonce||event.data.type!=='offer')return;
    busy=true;clearInterval(timer);clearTimeout(expire);window.removeEventListener('message',receive);
    try{await accept(validatePacket(event.data.data));send('received');}catch(error){send('error',{message:error.message});onStatus(error.message);}
  };
  window.addEventListener('message',receive);send('ready');
}
export async function transferFile(data){
  data=validatePacket(data);
  let pdfBase64=null;
  if(data.pdf){const bytes=new Uint8Array(await data.pdf.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));pdfBase64=btoa(binary);}
  return new Blob([JSON.stringify({...data,pdf:undefined,pdfBase64})],{type:'application/json'});
}
export async function readTransferFile(file){
  if(file.size>65e6)throw Error('Choose a transfer file smaller than 65 MB.');
  const data=JSON.parse(await file.text());
  if(data.pdfBase64){if(typeof data.pdfBase64!=='string'||data.pdfBase64.length>40e6)throw Error('The PDF is too large.');const binary=atob(data.pdfBase64);data.pdf=new Blob([Uint8Array.from(binary,c=>c.charCodeAt(0))],{type:'application/pdf'});}
  return validatePacket(data);
}
let downloadURL=null;
export function download(blob,name){
  if(downloadURL)URL.revokeObjectURL(downloadURL);
  document.getElementById('fileDownloadReady')?.remove();
  downloadURL=URL.createObjectURL(blob);
  const a=document.createElement('a');a.id='fileDownloadReady';a.className='download-ready';a.href=downloadURL;a.download=name.replace(/[\\/:*?"<>|]/g,'-');a.textContent='Save '+a.download;
  // Keep a real link available when mobile browsers block an async download.
  const host=document.querySelector('dialog[open]')||document.getElementById('scoreToolbar')||document.body;
  host.append(a);a.click();
}
