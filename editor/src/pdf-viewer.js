import * as pdfjs from 'pdfjs-dist';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).href;
const style=document.createElement('style');style.textContent='*{box-sizing:border-box}body{margin:0;background:#eaf2f6;font:14px system-ui;color:#193b4c}#pdfControls{position:sticky;top:0;z-index:2;display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:#f6fbfe;padding:8px;border-bottom:1px solid #bed9e5}button{border:1px solid #b1d0df;background:white;color:#145676;border-radius:6px;padding:7px 12px;font:inherit;cursor:pointer}#pdfPages{padding:12px;overflow:auto}article{margin:0 auto 16px;background:white;box-shadow:0 2px 8px #193b4c22}canvas{display:block;width:100%}#pdfStatus{font-size:12px}';document.head.append(style);
let pdf,scale=1,revision=0;
const $=id=>document.getElementById(id);
async function render(){
  if(!pdf)return;
  const token=++revision;$('pdfPages').replaceChildren();$('pdfStatus').textContent=`${pdf.numPages} page${pdf.numPages===1?'':'s'}`;
  for(let i=1;i<=pdf.numPages;i++){
    const page=await pdf.getPage(i);if(token!==revision)return;
    const base=page.getViewport({scale:1}),width=Math.max(240,document.documentElement.clientWidth-26)*scale;
    const ratio=Math.min(devicePixelRatio||1,2),pixels=Math.min(width*ratio,Math.sqrt(5e6*base.width/base.height));
    const viewport=page.getViewport({scale:pixels/base.width});
    const article=document.createElement('article');article.style.width=width+'px';article.setAttribute('aria-label','PDF page '+i);
    const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;article.append(canvas);$('pdfPages').append(article);
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
  }
}
window.addEventListener('message',async event=>{
  if(event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='oxbows-pdf'||!(event.data.pdf instanceof Blob))return;
  try{pdf=await pdfjs.getDocument({data:await event.data.pdf.arrayBuffer(),isEvalSupported:false}).promise;await render();}catch(e){$('pdfStatus').textContent='Could not display PDF. Use Download PDF in Songbook to open it.';}
});
function zoom(value){scale=Math.max(.6,Math.min(2.5,value));$('zoomLabel').textContent=scale===1?'Fit width':Math.round(scale*100)+'%';void render();}
$('smaller').onclick=()=>zoom(scale-.15);$('larger').onclick=()=>zoom(scale+.15);$('fit').onclick=()=>zoom(1);
let resize;window.addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(()=>void render(),250);});
