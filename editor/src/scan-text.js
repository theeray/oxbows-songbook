import {findStaves} from './staff-geometry.js';
import {binary} from './image-preprocess.js';
import {components} from './scan-symbols.js';
import {printedChord} from './scan-text-analysis.js';
import {createWorker,PSM} from 'tesseract.js';

export async function readPageText(canvas,progress,signal,pdfWords=[]){
 const hasPdfText=pdfWords.filter(w=>/[A-Za-z]/.test(w.text)).length>=2;
 let worker;const aborted=()=>{void worker?.terminate();};signal?.addEventListener('abort',aborted,{once:true});
 try{
  if(signal?.aborted)throw Error('Scan cancelled.');
  progress('Reading tune names and printed chord symbols…');
  const base=new URL(import.meta.env.BASE_URL+'ocr/',location.href).href;
  worker=await createWorker('eng',1,{workerPath:base+'worker.min.js',corePath:base,langPath:base,workerBlobURL:false,logger:m=>{if(m.status==='recognizing text')progress('Reading printed text · '+Math.round(m.progress*100)+'%');}});
  if(signal?.aborted)throw Error('Scan cancelled.');
  await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT,preserve_interword_spaces:'1'});
  const {data}=hasPdfText?{data:{blocks:[]}}:await worker.recognize(canvas,{}, {text:true,blocks:true});
  const words=hasPdfText?[...pdfWords]:(data.blocks||[]).flatMap(b=>b.paragraphs||[]).flatMap(p=>p.lines||[]).flatMap(l=>l.words||[]).filter(w=>w.confidence>=30).map(w=>({text:w.text,confidence:w.confidence,x0:w.bbox.x0,y0:w.bbox.y0,x1:w.bbox.x1,y1:w.bbox.y1}));
  // Isolated chord letters are easily missed by full-page text OCR. Read
  // compact glyph groups above each staff again with a chord-only alphabet.
  const image=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height),staves=findStaves(image),bin=binary(image),blobs=components(bin,canvas.width,canvas.height);
  await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_LINE,tessedit_char_whitelist:'ABCDEFGabcdefg#bmjinsuadgoprtvM0123456789/()+-'});
  let total=0;
  for(const staff of staves){
   const g=staff.gap,candidates=blobs.filter(c=>c.minY>staff.lines[0]-g*5&&c.maxY<staff.lines[0]-g*.35&&c.height>g*.55&&c.height<g*2.4&&c.width<g*2.2&&c.minX>=staff.left&&c.maxX<=staff.right).sort((a,b)=>a.minX-b.minX),groups=[];
   for(const c of candidates){const group=groups.find(r=>c.minX-r.maxX<g*.8&&c.minX>=r.minX&&Math.abs((c.minY+c.maxY-r.minY-r.maxY)/2)<g*.9);if(group){group.maxX=Math.max(group.maxX,c.maxX);group.minY=Math.min(group.minY,c.minY);group.maxY=Math.max(group.maxY,c.maxY);}else groups.push({...c});}
   for(const region of groups){
    if(signal?.aborted)throw Error('Scan cancelled.');if(region.maxX-region.minX>g*7||++total>120)continue;
    const left=Math.max(0,region.minX-4),top=Math.max(0,region.minY-4),width=Math.min(canvas.width-left,region.maxX-region.minX+9),height=Math.min(canvas.height-top,region.maxY-region.minY+9);
    const crop=document.createElement('canvas'),zoom=Math.max(2,Math.ceil(48/height));crop.width=width*zoom+40;crop.height=height*zoom+40;const ctx=crop.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,crop.width,crop.height);ctx.drawImage(canvas,left,top,width,height,20,20,width*zoom,height*zoom);
    progress('Reading printed chord symbols…');const {data}=await worker.recognize(crop,{}, {text:true,blocks:true});
    const chord=printedChord(data.text.replace(/\s/g,''));if(chord&&data.confidence>=45){const value={text:chord.name,x0:region.minX,y0:region.minY,x1:region.maxX,y1:region.maxY,confidence:data.confidence};
     for(let i=words.length-1;i>=0;i--)if(words[i].x0<value.x1&&words[i].x1>value.x0&&words[i].y0<value.y1&&words[i].y1>value.y0)words.splice(i,1);words.push(value);
    }
   }
  }
  return {words,source:hasPdfText?'PDF text + chord OCR':'Text OCR',warnings:[]};
 }catch(e){if(signal?.aborted)throw Error('Scan cancelled.');return {words:pdfWords,source:'Manual review',warnings:['Printed-text recognition was unavailable. Enter tune names and chords manually.']};}
 finally{signal?.removeEventListener('abort',aborted);await worker?.terminate();}
}
