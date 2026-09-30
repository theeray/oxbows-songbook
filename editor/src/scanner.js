import {findStaves} from './staff-geometry.js';
export {findStaves} from './staff-geometry.js';
import wasmURL from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import mjsURL from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';
import {components,staffSymbols,readSignature,readBarlines,readAccidental,readRests} from './scan-symbols.js';
import {transformWords,textForStaff} from './scan-text-analysis.js';
import {composeScan} from './scan-draft.js';
import {pitchAmbiguity} from './scan-context.js';
import {durationFor} from './rhythm.js';
import {binary,prepareImage,rhythmIssues} from './image-preprocess.js';
let engine;
export async function loadEngine(progress){if(engine)return engine;progress('Loading note recognition model (38 MB, first use)…');const ort=await import('onnxruntime-web/wasm');ort.env.wasm.wasmPaths={wasm:new URL(wasmURL,location.href).href,mjs:new URL(mjsURL,location.href).href};ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;const chunks=await Promise.all(['00','01'].map(async n=>{const r=await fetch(import.meta.env.BASE_URL+'models/notes-'+n);if(!r.ok)throw Error('The recognition model could not be loaded. Please try again.');return new Uint8Array(await r.arrayBuffer());}));const data=new Uint8Array(chunks[0].length+chunks[1].length);data.set(chunks[0]);data.set(chunks[1],chunks[0].length);const session=await ort.InferenceSession.create(data,{executionProviders:['wasm'],graphOptimizationLevel:'all'});engine={ort,session};return engine;}
export async function recognize(canvas,options,progress,signal,inferenceEngine=loadEngine){progress('Straightening the page and balancing lighting…');const originalSize={width:canvas.width,height:canvas.height};const prepared=prepareImage(canvas);const preparedSize={width:prepared.canvas.width,height:prepared.canvas.height};canvas=prepared.canvas;let ctx=canvas.getContext('2d',{willReadFrequently:true}),image=ctx.getImageData(0,0,canvas.width,canvas.height);let staves=findStaves(image);if(!staves.length)throw Error('No straight five-line staves found. Crop to a clear printed melody, straighten the page, or import PlayScore MusicXML.');const avg=staves.reduce((s,a)=>s+a.gap,0)/staves.length,scale=12/avg;if(Math.abs(scale-1)>.08){const c=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(1,1):document.createElement('canvas');c.width=Math.round(canvas.width*scale);c.height=Math.round(canvas.height*scale);if(c.width*c.height>12e6)throw Error('This page is too dense. Crop to fewer systems and try again.');c.getContext('2d').drawImage(canvas,0,0,c.width,c.height);canvas=c;ctx=c.getContext('2d',{willReadFrequently:true});image=ctx.getImageData(0,0,c.width,c.height);staves=findStaves(image);}const {session,ort}=await inferenceEngine(progress);const w=canvas.width,h=canvas.height,bin=binary(image),systems=[],boxes=[],words=transformWords(options.textWords||[],originalSize.width,originalSize.height,preparedSize.width,preparedSize.height,prepared.angle,w/preparedSize.width);let previous=options.previousSettings||{};let total=staves.reduce((s,a)=>s+Math.ceil((a.right-a.left)/224),0),done=0;
for(let si=0;si<staves.length;si++){const staff=staves[si],g=staff.gap,stripTop=Math.max(0,Math.round(staff.lines[0]-g*5)),stripBottom=Math.min(h,Math.round(staff.lines[4]+g*5)),sh=stripBottom-stripTop,prob=new Float32Array(w*sh),counts=new Uint8Array(w*sh);for(let x0=Math.max(0,staff.left-20);x0<staff.right;x0+=224){if(signal?.aborted)throw Error('Scan cancelled.');progress(`Reading staff ${si+1} of ${staves.length} · ${Math.min(99,Math.round(done/total*100))}%`);await new Promise(r=>setTimeout(r,0));const y0=Math.round((staff.lines[0]+staff.lines[4])/2-144),input=new Uint8Array(288*288*3);input.fill(255);for(let yy=0;yy<288;yy++)for(let xx=0;xx<288;xx++){const x=x0+xx,y=y0+yy;if(x>=0&&y>=0&&x<w&&y<h){const pos=(y*w+x)*4,j=(yy*288+xx)*3;input[j]=image.data[pos+2];input[j+1]=image.data[pos+1];input[j+2]=image.data[pos];}}const tensor=new ort.Tensor('uint8',input,[1,288,288,3]);const outputs=await session.run({[session.inputNames[0]]:tensor});const out=outputs[session.outputNames[0]].data;for(let yy=0;yy<288;yy++){const y=y0+yy-stripTop;if(y<0||y>=sh)continue;for(let xx=0;xx<288;xx++){const x=x0+xx;if(x<0||x>=w)continue;const i=y*w+x;prob[i]+=out[(yy*288+xx)*4+2];counts[i]++;}}Object.values(outputs).forEach(t=>t.dispose());tensor.dispose();done++;}
const mask=new Uint8Array(prob.length);for(let i=0;i<mask.length;i++)mask[i]=prob[i]/(counts[i]||1)>.4?1:0;const found=components(mask,w,sh).filter(c=>c.area>g*g*.12&&c.area<g*g*2.2&&c.maxX-c.minX>g*.45&&c.maxX-c.minX<g*2.2&&c.maxY-c.minY<g*1.8).map(c=>({...c,y:c.y+stripTop})).sort((a,b)=>a.x-b.x);
const symbols=staffSymbols(bin,w,h,staff),firstNote=found.find(n=>n.x>staff.left+g*3),headerEnd=(firstNote?.x??staff.left+g*14)-g*.8;
const signature=readSignature(symbols,staff,staff.left,headerEnd,previous),warnings=[...(options.textWarnings||[]),...signature.review];
const settings={clef:'treble',fifths:0,beats:4,beatType:4,mode:options.mode==='auto'||!options.mode?'major':options.mode,...previous,...signature.detected};
if(options.mode&&options.mode!=='auto')settings.mode=options.mode;
for(const key of ['clef','fifths'])if(options[key]!==undefined&&options[key]!=='auto')settings[key]=key==='fifths'?Number(options[key]):options[key];
if(options.meter&&options.meter!=='auto')[settings.beats,settings.beatType]=options.meter.split('/').map(Number);
if(options.beats){settings.beats=options.beats;settings.beatType=options.beatType;}
if(!si&&!options.previousSettings){if(!signature.detected.clef&&(!options.clef||options.clef==='auto'))warnings.push('Clef unclear: treble is a provisional reading.');if(signature.detected.fifths===undefined&&(options.fifths===undefined||options.fifths==='auto'))warnings.push('Key unclear: no sharps/flats is provisional.');if(!signature.detected.beats&&(!options.meter||options.meter==='auto')&&!options.beats)warnings.push('Meter unclear: 4/4 is provisional.');}
const staffText=textForStaff(words,staff,si?staves[si-1].lines[4]+g*2:0);
const usable=found.filter(n=>n.x>staff.left+g*2&&!signature.used.some(c=>n.x>=c.minX-g*.4&&n.x<=c.maxX+g*.4));
const bars=readBarlines(bin,w,h,staff,usable).filter(b=>b.x>headerEnd||b.repeatStart),tokens=[];
for(const n of usable){
 const position=(staff.lines[4]-n.y)/(g/2),offset=Math.round(position),center=Math.round(n.y-stripTop)*w+Math.round(n.x),confidence=prob[center]/(counts[center]||1);
 const review=Math.abs(position-offset)>.28?'Pitch lies between staff positions':confidence<.68?'Uncertain notehead':null;
 tokens.push({x:n.x,position,confidence,pitchAmbiguous:pitchAmbiguity(position,confidence),midi:0,accidental:options.symbols===false?undefined:readAccidental(symbols,n,staff),duration:durationFor(n,bin,w,h,g,staff),review});boxes.push({x:n.x/scale,y:n.y/scale});
}
if(options.symbols!==false)tokens.push(...readRests(symbols,staff,usable,headerEnd,staff.right));tokens.sort((a,b)=>a.x-b.x);
const boundaries=[{x:Math.min(headerEnd,tokens[0]?.x-g||headerEnd),repeatStart:bars.some(b=>b.x<(tokens[0]?.x||0)&&b.repeatStart)},...bars.filter(b=>b.x>(tokens[0]?.x||headerEnd)),{x:staff.right+g}];
const measures=[];let local={...settings};
for(let i=0;i<boundaries.length-1;i++){
 const left=boundaries[i],right=boundaries[i+1],notes=tokens.filter(n=>n.x>left.x&&n.x<right.x);if(!notes.length)continue;
 let change={};if(i&&notes[0]){const next=readSignature(symbols,staff,left.x+g*.3,notes[0].x-g*.9,local);change=next.detected;for(const key of ['clef','fifths'])if(options[key]!==undefined&&options[key]!=='auto')delete change[key];if(options.meter&&options.meter!=='auto'){delete change.beats;delete change.beatType;}Object.assign(local,change);}
 const chords=[];if(options.chords!==false)for(const chord of staffText.chords.filter(c=>c.x>=left.x-g&&c.x<right.x-g*.15)){
  let nearest=0,best=Infinity;notes.forEach((n,j)=>{if(Math.abs(n.x-chord.x)<best){best=Math.abs(n.x-chord.x);nearest=j;}});const start=notes.slice(0,nearest).reduce((sum,n)=>sum+n.duration,0);if(!chords.some(c=>c.start===start))chords.push({name:chord.name,start});
 }
 const ending=options.repeats===false?null:staffText.endings.find(e=>e.x>=left.x-g&&e.x<right.x-g);
 const directions=staffText.directions.filter(d=>d.x>=left.x-g&&d.x<right.x).map(d=>d.text).join(' · ');
 measures.push({notes,settings:change,chords,repeatStart:options.repeats!==false&&!!left.repeatStart,repeatEnd:options.repeats!==false&&!!right.repeatEnd,barStyle:right.style||'regular',endingStart:ending?.number||'',words:directions});
}
// Close a detected ending at the repeat or at the end of the staff. The review
// controls allow extending it over several measures or systems.
let ending='';for(const bar of measures){if(bar.endingStart)ending=bar.endingStart;if(ending&&bar.repeatEnd){bar.endingEnd=ending;ending='';}}if(ending&&measures.length)measures.at(-1).endingEnd=ending;
if(measures.length){systems.push({page:options.page||1,staff:si+1,title:options.titles===false?'':staffText.title,settings,detected:signature.detected,warnings,measures});previous=local;}
}
if(!systems.length)throw Error('No readable noteheads found. Try a sharper, closer image or PlayScore MusicXML.');
const composed=composeScan(systems,options);return {...composed,systems,staves:systems.length,notes:systems.reduce((sum,s)=>sum+s.measures.reduce((a,m)=>a+m.notes.filter(n=>n.midi!==null).length,0),0),boxes,angle:prepared.angle};
}
