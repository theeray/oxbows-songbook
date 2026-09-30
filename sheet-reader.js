// Borderless reading surface: zoom is independent of engraving and remains fixed
// after a gesture or viewport resize. All document edges stay scrollable.
export const clampZoom=value=>Math.max(.15,Math.min(6,value));
export function zoomAnchor(scroll,point,before,after){return (scroll+point)*after/before-point;}
let activeClose;
function styles(){
 if(document.getElementById('sheetReaderStyle'))return;
 const style=document.createElement('style');style.id='sheetReaderStyle';style.textContent=`
 dialog.sheet-reader,dialog.sheet-reader-host{position:fixed;inset:0;width:100%;height:100%;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;border-radius:0;background:white;color:#193b4c;overflow:hidden;box-sizing:border-box}
 dialog.sheet-reader[open]{display:flex;flex-direction:column} .sheet-reader::backdrop,.sheet-reader-host::backdrop{background:white}
 .reader-tools{display:flex;align-items:center;justify-content:flex-end;gap:5px;flex-wrap:wrap;padding:3px max(4px,env(safe-area-inset-right)) 3px max(4px,env(safe-area-inset-left));padding-top:max(3px,env(safe-area-inset-top));background:#fff;flex:none;font:14px system-ui}
 .reader-tools button{font:14px system-ui;padding:7px 10px;min-height:36px;border:1px solid #c7dce6;border-radius:5px;background:#f4faff;color:#145676;cursor:pointer}.reader-tools output{min-width:45px;text-align:center}
 .reader-viewport{flex:1;min-height:0;overflow:auto;touch-action:none;overscroll-behavior:contain;background:white;padding-bottom:env(safe-area-inset-bottom)}
 .reader-size{position:relative;margin:0 auto}.reader-content{position:absolute;left:0;top:0;transform-origin:0 0;background:white;max-width:none!important;box-shadow:none!important;border:0!important;border-radius:0!important;pointer-events:none}
 .reader-content article{box-shadow:none!important;border:0!important}.reader-content canvas{display:block}.sheet-reader-host iframe{width:100%!important;height:100%!important;border:0!important;display:block;max-height:none!important}
 `;document.head.append(style);
}
function cloneSheet(source){
 const clone=source.cloneNode(true);clone.removeAttribute('id');
 clone.querySelectorAll('[id]').forEach(n=>{if(!n.closest('svg'))n.removeAttribute('id');});
 clone.querySelectorAll('[role=button],button,input,select,a').forEach(n=>{n.removeAttribute('role');n.setAttribute('tabindex','-1');});
 const original=[...(source.matches('canvas')?[source]:[]),...source.querySelectorAll('canvas')];
 const copies=[...(clone.matches('canvas')?[clone]:[]),...clone.querySelectorAll('canvas')];
 original.forEach((c,i)=>{copies[i].width=c.width;copies[i].height=c.height;copies[i].getContext('2d').drawImage(c,0,0);});
 return clone;
}
export function openSheetReader(source,{key='notation',width,height}={}){
 if(!source)return;activeClose?.();styles();
 const returnFocus=document.activeElement,dialog=document.createElement('dialog');dialog.className='sheet-reader';dialog.setAttribute('aria-label','Full-screen sheet music');
 dialog.innerHTML='<div class="reader-tools"><button data-action="out" aria-label="Zoom out">−</button><output aria-live="polite"></output><button data-action="in" aria-label="Zoom in">+</button><button data-action="width">Fit width</button><button data-action="page">Fit page</button><button data-action="close">Close</button></div><div class="reader-viewport" tabindex="0" aria-label="Sheet music. Pinch to zoom, drag or scroll to pan."><div class="reader-size"></div></div>';
 const viewport=dialog.querySelector('.reader-viewport'),size=dialog.querySelector('.reader-size'),content=cloneSheet(source);
 const baseWidth=width||Math.max(source.scrollWidth,source.getBoundingClientRect().width,1);
 content.classList.add('reader-content');content.style.width=baseWidth+'px';content.style.maxHeight='none';content.style.overflow='visible';content.style.padding='0';content.style.margin='0';
 size.append(content);document.body.append(dialog);dialog.showModal();
 const baseHeight=height||Math.max(content.scrollHeight,content.getBoundingClientRect().height,1);
 const first=content.querySelector('article,svg,canvas,img');const pageHeight=first?.getBoundingClientRect().height||baseHeight;
 let scale=Math.min(1,viewport.clientWidth/baseWidth),closed=false;
 const storageKey='oxbows-reader-zoom:'+key;
 try{const saved=Number(localStorage.getItem(storageKey));if(saved>0)scale=clampZoom(saved);}catch{}
 const paint=()=>{content.style.transform=`scale(${scale})`;size.style.width=baseWidth*scale+'px';size.style.height=baseHeight*scale+'px';dialog.querySelector('output').textContent=Math.round(scale*100)+'%';};
 const setZoom=(next,x=viewport.clientWidth/2,y=viewport.clientHeight/2)=>{
   const old=scale,left=viewport.scrollLeft,top=viewport.scrollTop,oldMargin=Math.max(0,(viewport.clientWidth-baseWidth*old)/2);
   scale=clampZoom(next);paint();const margin=Math.max(0,(viewport.clientWidth-baseWidth*scale)/2);
   viewport.scrollLeft=zoomAnchor(left,x-oldMargin,old,scale)+margin;viewport.scrollTop=zoomAnchor(top,y,old,scale);
   try{localStorage.setItem(storageKey,String(scale));}catch{}
 };
 paint();
 const close=()=>{if(closed)return;closed=true;window.removeEventListener('message',receive);document.removeEventListener('fullscreenchange',fullscreenChange);if(document.fullscreenElement===dialog)document.exitFullscreen?.().catch(()=>{});dialog.close();dialog.remove();if(window.parent!==window)window.parent.postMessage({type:'sheet-reader-state',open:false},location.origin);returnFocus?.focus?.({preventScroll:true});activeClose=null;};
 const fullscreenChange=()=>{if(!document.fullscreenElement&&wasFullscreen)close();else if(document.fullscreenElement===dialog)wasFullscreen=true;};let wasFullscreen=false;
 const receive=e=>{if(e.source===window.parent&&e.origin===location.origin&&e.data?.type==='close-sheet-reader')close();};
 window.addEventListener('message',receive);document.addEventListener('fullscreenchange',fullscreenChange);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.querySelector('.reader-tools').onclick=e=>{switch(e.target.dataset.action){case 'close':close();break;case 'in':setZoom(scale*1.2);break;case 'out':setZoom(scale/1.2);break;case 'width':setZoom(viewport.clientWidth/baseWidth,0,0);viewport.scrollLeft=0;break;case 'page':setZoom(Math.min(viewport.clientWidth/baseWidth,viewport.clientHeight/pageHeight),0,0);viewport.scrollLeft=viewport.scrollTop=0;}};
 const points=new Map();let previous;
 const gesture=()=>{const p=[...points.values()];return p.length>1?{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,d:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)}:p[0];};
 viewport.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;viewport.setPointerCapture(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});previous=gesture();});
 viewport.addEventListener('pointermove',e=>{if(!points.has(e.pointerId))return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});const now=gesture();if(previous&&now){if(now.d&&previous.d){const rect=viewport.getBoundingClientRect();setZoom(scale*now.d/Math.max(1,previous.d),previous.x-rect.left,previous.y-rect.top);}viewport.scrollLeft-=now.x-previous.x;viewport.scrollTop-=now.y-previous.y;}previous=now;});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,e=>{points.delete(e.pointerId);previous=gesture();});
 viewport.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();const r=viewport.getBoundingClientRect();setZoom(scale*Math.exp(-e.deltaY*.01),e.clientX-r.left,e.clientY-r.top);},{passive:false});
 activeClose=close;dialog.querySelector('[data-action="close"]').focus();
 if(window.parent!==window)window.parent.postMessage({type:'sheet-reader-state',open:true},location.origin);
 dialog.requestFullscreen?.().catch(()=>{});
 return {close};
}
// Expand only a known same-origin child frame, including on iPhones without
// element fullscreen. Keep it in place: moving an iframe reloads its document.
export function installSheetReaderHost(){
 styles();let frame,old,overflow;
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.data?.type!=='sheet-reader-state')return;
  const candidate=[...document.querySelectorAll('iframe')].find(f=>f.contentWindow===e.source);if(!candidate)return;
  if(e.data.open&&!frame){frame=candidate;old=frame.getAttribute('style');overflow=document.body.style.overflow;frame.style.cssText+=';position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;max-height:none!important;z-index:2147483647!important;border:0!important;background:white!important;';document.body.style.overflow='hidden';}
  else if(!e.data.open&&candidate===frame){if(old===null)frame.removeAttribute('style');else frame.setAttribute('style',old);document.body.style.overflow=overflow;frame=null;}
 });
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&frame)frame.contentWindow.postMessage({type:'close-sheet-reader'},location.origin);});
}
