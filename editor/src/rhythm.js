export function durationFor(n,bin,w,h,gap,staff){let stemX=-1,stemTop=0,stemBottom=0,best=0;for(let x=Math.round(n.x-gap);x<=n.x+gap;x++){if(x<0||x>=w)continue;let top=Math.max(0,Math.floor(n.y-gap*4.7)),bottom=Math.min(h-1,Math.ceil(n.y+gap*4.7));let run=0,start=top;for(let y=top;y<=bottom;y++){if(bin[y*w+x]){if(!run)start=y;run++;}else{if(run>best&&start<n.y+gap&&y>n.y-gap){best=run;stemX=x;stemTop=start;stemBottom=y;}run=0;}}}
let black=0,count=0;for(let dy=-gap*.2;dy<=gap*.2;dy++)for(let dx=-gap*.23;dx<=gap*.23;dx++){const x=Math.round(n.x+dx),y=Math.round(n.y+dy);if(x>=0&&y>=0&&x<w&&y<h){black+=bin[y*w+x];count++;}}const hollow=black/count<.42;const up=n.y-stemTop>stemBottom-n.y;const edge=up?stemTop:stemBottom;const scanTop=Math.max(0,Math.floor(edge-(up?0:gap*2.2))),scanBottom=Math.min(h-1,Math.ceil(edge+(up?gap*2.2:0)));let groups=0,inkRows=0,gapRows=0;
const finishGroup=()=>{if(inkRows>=Math.max(2,gap*.14))groups++;inkRows=0;gapRows=0;};
for(let y=scanTop;y<=scanBottom;y++){
  if(staff.lines.some(ln=>Math.abs(y-ln)<gap*.16))continue;
  let hits=0;for(let dx=gap*.3;dx<gap*1.05;dx++){const x=Math.round(stemX+dx);if(x>=0&&x<w)hits+=bin[y*w+x];}
  if(hits>gap*.14){inkRows++;gapRows=0;}else if(inkRows&&++gapRows>gap*.25)finishGroup();
}
finishGroup();
let duration=best<gap*1.8?(hollow?4:1):hollow?2:groups>=2?.25:groups===1?.5:1;
// A dot must form a small isolated component to the right of the notehead.
const x0=Math.round(n.x+gap*.8),x1=Math.round(n.x+gap*1.65),y0=Math.round(n.y-gap*.7),y1=Math.round(n.y+gap*.4);let dotPixels=0;for(let y=y0;y<=y1;y++){if(staff.lines.some(ln=>Math.abs(y-ln)<1.5))continue;for(let x=x0;x<=x1;x++)if(x>=0&&x<w&&y>=0&&y<h)dotPixels+=bin[y*w+x];}if(dotPixels>gap*gap*.025&&dotPixels<gap*gap*.17)duration*=1.5;return duration;}
