import glyphs from './scan-glyphs.json' with {type:'json'};

export function components(mask,w,h){
 const seen=new Uint8Array(mask.length),result=[],queue=new Int32Array(mask.length);
 for(let i=0;i<mask.length;i++){
  if(!mask[i]||seen[i])continue;let head=0,tail=1;queue[0]=i;seen[i]=1;let minX=w,maxX=0,minY=h,maxY=0,sx=0,sy=0;
  while(head<tail){const k=queue[head++],x=k%w,y=Math.floor(k/w);minX=Math.min(x,minX);maxX=Math.max(x,maxX);minY=Math.min(y,minY);maxY=Math.max(y,maxY);sx+=x;sy+=y;
   for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]){const xx=x+dx,yy=y+dy,j=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&!seen[j]&&mask[j]){seen[j]=1;queue[tail++]=j;}}
  }result.push({x:sx/tail,y:sy/tail,minX,maxX,minY,maxY,area:tail,width:maxX-minX+1,height:maxY-minY+1});
 }return result;
}
export function withoutStaff(bin,w,h,staff){
 const g=staff.gap,top=Math.max(0,Math.floor(staff.lines[0]-g*4)),bottom=Math.min(h,Math.ceil(staff.lines[4]+g*4)),mask=bin.slice(top*w,bottom*w);
 for(const line of staff.lines){const y=Math.round(line),r=Math.max(1,Math.round(g*.1));for(let x=Math.max(0,Math.floor(staff.left));x<=Math.min(w-1,staff.right);x++){
  // Keep vertical strokes crossing a staff line, erase only horizontal runs.
  if(bin[Math.max(0,y-r-1)*w+x]&&bin[Math.min(h-1,y+r+1)*w+x])continue;
  for(let yy=y-r;yy<=y+r;yy++)if(yy>=top&&yy<bottom)mask[(yy-top)*w+x]=0;
 }}return {mask,top,height:bottom-top};
}
export function matchGlyph(component,mask,w,top,names){
 const c=component,cw=c.maxX-c.minX+1,ch=c.maxY-c.minY+1;let best={name:null,score:0};
 for(const name of names){const t=glyphs[name];if(!t)continue;const ratio=(cw/ch)/(t.width/t.height);if(ratio<.48||ratio>2)continue;
  let overlap=0,ink=0,reference=0;
  for(let y=0;y<32;y++)for(let x=0;x<24;x++){
   const a=mask[(Math.min(c.maxY,Math.floor(c.minY+(y+.5)*ch/32))-top)*w+Math.min(c.maxX,Math.floor(c.minX+(x+.5)*cw/24))]||0;
   const b=t.rows[Math.min(t.height-1,Math.floor((y+.5)*t.height/32))][Math.min(t.width-1,Math.floor((x+.5)*t.width/24))]==='1'?1:0;
   ink+=a;reference+=b;overlap+=a*b;
  }
  const score=2*overlap/Math.max(1,ink+reference)-Math.abs(Math.log(ratio))*.12;
  if(score>best.score)best={name,score};
 }return best;
}
const accidentalNames=['accidentalSharp','accidentalFlat','accidentalNatural'];
const digitNames=Array.from({length:10},(_,i)=>'timeSig'+i);
export function staffSymbols(bin,w,h,staff){
 const clean=withoutStaff(bin,w,h,staff),g=staff.gap;
 const found=components(clean.mask,w,clean.height).filter(c=>c.area>g*g*.018).map(c=>({...c,y:c.y+clean.top,minY:c.minY+clean.top,maxY:c.maxY+clean.top}));
 // Staff removal can separate a small serif from a time-signature digit.
 // Rejoin only nearby fragments with strong horizontal overlap.
 for(let i=found.length-1;i>=0;i--){const c=found[i];if(c.height>g*.65)continue;
  const target=found.find((d,j)=>j!==i&&d.height>g*.9&&Math.min(c.maxX,d.maxX)-Math.max(c.minX,d.minX)+1>Math.min(c.width,d.width)*.55&&Math.min(Math.abs(c.minY-d.maxY),Math.abs(d.minY-c.maxY))<g*.45);
  if(target){target.minX=Math.min(target.minX,c.minX);target.maxX=Math.max(target.maxX,c.maxX);target.minY=Math.min(target.minY,c.minY);target.maxY=Math.max(target.maxY,c.maxY);target.width=target.maxX-target.minX+1;target.height=target.maxY-target.minY+1;target.x=(target.x*target.area+c.x*c.area)/(target.area+c.area);target.y=(target.y*target.area+c.y*c.area)/(target.area+c.area);target.area+=c.area;found.splice(i,1);}
 }

 return {...clean,components:found,match:(c,names)=>matchGlyph(c,clean.mask,w,clean.top,names)};
}
export function readSignature(symbols,staff,start,end,previous={}){
 const g=staff.gap,items=symbols.components.filter(c=>c.minX>=start-g*.2&&c.maxX<=end&&c.minY>=staff.lines[0]-g*3.5&&c.maxY<staff.lines[4]+g*2.5).sort((a,b)=>a.minX-b.minX),detected={},used=[],review=[];
 let after=start;
 const clefs=items.filter(c=>c.height>g*2.5&&c.width>g*.6&&c.width<g*3.5).map(c=>({c,...symbols.match(c,['gClef','cClef','fClef'])})).filter(x=>x.score>.63).sort((a,b)=>b.score-a.score);
 if(clefs.length){const best=clefs[0];detected.clef={gClef:'treble',cClef:'alto',fClef:'bass'}[best.name];used.push(best.c);after=best.c.maxX;}
 const accidentals=items.filter(c=>c.minX>after&&c.height>g*1.15&&c.height<g*3.7&&c.width>g*.2&&c.width<g*1.5).map(c=>({c,...symbols.match(c,accidentalNames)})).filter(x=>x.score>.67);
 const sharps=accidentals.filter(a=>a.name==='accidentalSharp'),flats=accidentals.filter(a=>a.name==='accidentalFlat'),naturals=accidentals.filter(a=>a.name==='accidentalNatural');
 if(sharps.length&&!flats.length){detected.fifths=Math.min(7,sharps.length);used.push(...sharps.map(a=>a.c));}
 else if(flats.length&&!sharps.length){detected.fifths=-Math.min(7,flats.length);used.push(...flats.map(a=>a.c));}
 else if(naturals.length&&!sharps.length&&!flats.length){detected.fifths=0;used.push(...naturals.map(a=>a.c));}
 if(sharps.length&&flats.length)review.push('Mixed signature symbols: check the key.');
 const last=used.reduce((x,c)=>Math.max(x,c.maxX),after);
 const timeItems=items.filter(c=>c.minX>last+g*.12&&c.height>g*1.15&&c.height<g*4.3&&c.width>g*.35),firstUpper=timeItems.filter(c=>c.y<staff.lines[2]).sort((a,b)=>a.minX-b.minX)[0];
 const times=timeItems.map(c=>({c,...symbols.match(c,[...(c===firstUpper?digitNames.slice(1):digitNames),'timeSigCommon','timeSigCutCommon'])})).filter(x=>x.score>.66);
 const common=times.find(x=>x.name==='timeSigCommon'||x.name==='timeSigCutCommon');
 if(common){detected.beats=common.name==='timeSigCommon'?4:2;detected.beatType=common.name==='timeSigCommon'?4:2;used.push(common.c);}
 else {
  const upper=times.filter(x=>x.c.y<staff.lines[2]&&x.name.startsWith('timeSig')&&/\d$/.test(x.name)).sort((a,b)=>a.c.x-b.c.x);
  const lower=times.filter(x=>x.c.y>=staff.lines[2]&&x.name.startsWith('timeSig')&&/\d$/.test(x.name)).sort((a,b)=>a.c.x-b.c.x);
  if(upper.length&&lower.length&&Math.abs(upper[0].c.minX-lower[0].c.minX)<g){const beats=Number(upper.map(x=>x.name.at(-1)).join('')),beatType=Number(lower.map(x=>x.name.at(-1)).join(''));if(beats>0&&beats<=32&&[1,2,4,8,16,32].includes(beatType)){Object.assign(detected,{beats,beatType});used.push(...upper.map(x=>x.c),...lower.map(x=>x.c));}}
 }
 // No signature following a recognized clef is evidence of zero sharps/flats
 // only at the first staff. Later systems may omit the key entirely.
 if(detected.clef&&detected.fifths===undefined&&previous.fifths===undefined&&end-after>g*1.6&&!items.some(c=>c.minX>after&&!used.includes(c)&&c.height>g*.7&&c.area>g*g*.15))detected.fifths=0;
 return {detected,used,review};
}
export function readBarlines(bin,w,h,staff,notes){
 const g=staff.gap,columns=[];
 for(let x=Math.max(0,Math.round(staff.left));x<=Math.min(w-1,staff.right);x++){
  let hits=0;for(let y=Math.round(staff.lines[0]);y<=staff.lines[4];y++)hits+=bin[y*w+x];
  if(hits>g*3.7&&!notes.some(n=>Math.abs(n.x-x)<g*.9))columns.push(x);
 }
 const strokes=[];for(const x of columns){if(strokes.length&&x-strokes.at(-1).right<=2)strokes.at(-1).right=x;else strokes.push({left:x,right:x});}
 const groups=[];for(const s of strokes){if(groups.length&&s.left-groups.at(-1).right<g*.65){groups.at(-1).right=s.right;groups.at(-1).strokes++;}else groups.push({...s,strokes:1});}
 const dot=(x,y)=>{let ink=0,total=0;for(let dy=-g*.12;dy<=g*.12;dy++)for(let dx=-g*.12;dx<=g*.12;dx++){const xx=Math.round(x+dx),yy=Math.round(y+dy);if(xx>=0&&xx<w&&yy>=0&&yy<h){ink+=bin[yy*w+xx];total++;}}return ink/Math.max(1,total)>.65;};
 const dots=(left,right)=>{for(let x=Math.max(0,Math.floor(left));x<=Math.min(w-1,right);x++)if(dot(x,staff.lines[1]+g*.5)&&dot(x,staff.lines[2]+g*.5))return true;return false;};
 return groups.map(b=>({...b,x:(b.left+b.right)/2,repeatEnd:dots(b.left-g*1.1,b.left-g*.3),repeatStart:dots(b.right+g*.3,b.right+g*1.1),style:b.strokes>1?'light-light':b.right-b.left>g*.22?'light-heavy':'regular'}));
}
export function readAccidental(symbols,note,staff){
 const g=staff.gap;
 const options=symbols.components.filter(c=>c.maxX<note.x-g*.45&&c.maxX>note.x-g*2.1&&Math.abs(c.y-note.y)<g*1.3&&c.height>g*1.2&&c.height<g*3.6&&c.width<g*1.45).map(c=>({c,...symbols.match(c,accidentalNames)})).filter(x=>x.score>.72).sort((a,b)=>b.score-a.score);
 if(!options.length)return undefined;return {accidentalSharp:1,accidentalFlat:-1,accidentalNatural:0}[options[0].name];
}
export function readRests(symbols,staff,notes,start,end){
 const g=staff.gap,names=['restQuarter','rest8th','rest16th'],length={restQuarter:1,rest8th:.5,rest16th:.25};
 return symbols.components.filter(c=>c.minX>start&&c.maxX<end&&c.minY>=staff.lines[0]-g*.3&&c.maxY<=staff.lines[4]+g*.3&&c.height>g*1.1&&c.height<g*3.4&&c.width>g*.45&&c.width<g*1.8&&!notes.some(n=>Math.abs(n.x-c.x)<g*1.6)).map(c=>({...c,...symbols.match(c,names)})).filter(c=>c.score>.77).map(c=>({x:c.x,midi:null,duration:length[c.name],review:'Check detected rest and length.'}));
}
