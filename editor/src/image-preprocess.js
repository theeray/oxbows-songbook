// Correct broad lighting gradients while preserving antialiased glyphs for the
// learned notehead model. Geometry analysis then uses the normalized luminance.
export function normalizeLighting(image){
  const {width:w,height:h,data}=image,gray=new Uint8Array(w*h),stride=w+1;
  const integral=new Float64Array((w+1)*(h+1));
  for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){
    const i=y*w+x,a=data[i*4+3]/255;
    const value=Math.round((data[i*4]*.2126+data[i*4+1]*.7152+data[i*4+2]*.0722)*a+255*(1-a));
    gray[i]=value;row+=value;integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+row;
  }}
  const output=new Uint8ClampedArray(data.length),radius=Math.max(20,Math.round(Math.min(w,h)/30));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const left=Math.max(0,x-radius),right=Math.min(w,x+radius+1),top=Math.max(0,y-radius),bottom=Math.min(h,y+radius+1);
    const mean=(integral[bottom*stride+right]-integral[top*stride+right]-integral[bottom*stride+left]+integral[top*stride+left])/((right-left)*(bottom-top));
    const value=Math.min(255,Math.round(gray[y*w+x]*245/Math.max(25,mean))),i=(y*w+x)*4;
    output[i]=output[i+1]=output[i+2]=value;output[i+3]=255;
  }
  return {width:w,height:h,data:output};
}
export function binary(image){
  const result=new Uint8Array(image.width*image.height);
  for(let i=0;i<result.length;i++)result[i]=image.data[i*4]<180?1:0;
  return result;
}
export function estimateSkew(image){
  const {width:w,height:h,data}=image,step=Math.max(1,Math.ceil(w/1000)),xs=[],ys=[];
  for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step)if(data[(y*w+x)*4]<160){xs.push((x-w/2)/step);ys.push(y/step);}
  if(xs.length<100)return 0;
  const bins=new Uint32Array(Math.ceil(h/step+w/step*.1)+8),pad=Math.ceil(w/step*.05)+3;
  const score=angle=>{bins.fill(0);const slope=Math.tan(angle*Math.PI/180);for(let i=0;i<xs.length;i++){const row=Math.round(ys[i]-slope*xs[i])+pad;if(row>=0&&row<bins.length)bins[row]++;}let sum=0;for(const n of bins)sum+=n*n;return sum;};
  const baseline=score(0);let best=baseline,angle=0;
  for(let a=-4;a<=4;a+=.25){const value=score(a);if(value>best){best=value;angle=a;}}
  const coarse=angle;for(let a=coarse-.25;a<=coarse+.25;a+=.025){const value=score(a);if(value>best){best=value;angle=a;}}
  return best>baseline*1.07&&Math.abs(angle)>=.08?angle:0;
}
const makeCanvas=(w,h)=>{const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):document.createElement('canvas');canvas.width=w;canvas.height=h;return canvas;};
export function prepareImage(canvas){
  if(canvas.width*canvas.height>12e6)throw Error('This image is too large. Crop to a few melody staves and try again.');
  let image=normalizeLighting(canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height));
  const clean=makeCanvas(image.width,image.height),ctx=clean.getContext('2d'),pixels=ctx.createImageData(image.width,image.height);pixels.data.set(image.data);ctx.putImageData(pixels,0,0);
  const angle=estimateSkew(image);
  if(!angle)return {canvas:clean,angle};
  const radians=-angle*Math.PI/180,c=Math.abs(Math.cos(radians)),s=Math.abs(Math.sin(radians));
  const rotated=makeCanvas(Math.ceil(clean.width*c+clean.height*s),Math.ceil(clean.height*c+clean.width*s)),out=rotated.getContext('2d');
  out.fillStyle='white';out.fillRect(0,0,rotated.width,rotated.height);out.translate(rotated.width/2,rotated.height/2);out.rotate(radians);out.drawImage(clean,-clean.width/2,-clean.height/2);
  return {canvas:rotated,angle};
}
export function rhythmIssues(draft,beats,beatType){
  const expected=beats*4/beatType,result=[];
  draft.forEach((notes,i)=>{
    const duration=notes.reduce((s,n)=>s+n.duration,0);
    if(Math.abs(duration-expected)>.02)result.push({measure:i+1,type:'rhythm',message:`${duration} quarter-note beats; expected ${expected}${i===0&&duration<expected?' (possibly a pickup)':''}`});
    const uncertain=notes.filter(n=>n.review).length;
    if(uncertain)result.push({measure:i+1,type:'recognition',message:`${uncertain} uncertain note${uncertain===1?'':'s'}`});
  });return result;
}
