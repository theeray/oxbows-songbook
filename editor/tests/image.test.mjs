import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLighting,estimateSkew,rhythmIssues} from '../src/image-preprocess.js';
function sheet(angle=0,shadow=false){
  const width=800,height=300,data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const offset=Math.tan(angle*Math.PI/180)*(x-width/2),line=[70,82,94,106,118,185,197,209,221,233].some(l=>Math.abs(y-l-offset)<.8)&&x>25&&x<775;
    const gray=line?20:shadow?Math.round(100+130*x/width):250,i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=gray;data[i+3]=255;
  }return {width,height,data};
}
test('normalization removes uneven shadows without erasing stafflines',()=>{
  const normalized=normalizeLighting(sheet(0,true));assert.ok(normalized.data[(40*800+50)*4]>220);assert.ok(normalized.data[(70*800+50)*4]<100);
});
test('deskew estimates positive, negative, and zero tilt',()=>{
  for(const angle of [-3,-1.5,0,1.25,3])assert.ok(Math.abs(estimateSkew(normalizeLighting(sheet(angle,true)))-angle)<.13,`angle ${angle}`);
});
test('review flags short/overfull measures and ambiguous notes without inventing rhythm',()=>{
  const draft=[[{duration:.5}],[{duration:4,review:'Uncertain notehead'}]],before=JSON.stringify(draft),issues=rhythmIssues(draft,6,8);
  assert.equal(issues.length,3);assert.ok(issues[0].message.includes('pickup'));assert.equal(JSON.stringify(draft),before);
});

test('engraved eighth-note flags survive staff intersections in both stem directions',async()=>{
  const {readFile}=await import('node:fs/promises');const {durationFor}=await import('../src/rhythm.js');
  const fixtures=JSON.parse(await readFile(new URL('./fixtures/rhythm.json',import.meta.url),'utf8'));
  for(const f of fixtures){const packed=Buffer.from(f.mask,'base64'),mask=new Uint8Array(f.width*f.height);for(let i=0;i<mask.length;i++)mask[i]=(packed[i>>3]>>(i%8))&1;assert.equal(durationFor(f.note,mask,f.width,f.height,f.staff.gap,f.staff),f.expected,f.name);}
});
