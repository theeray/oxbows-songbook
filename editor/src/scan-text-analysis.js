import {parseChord} from './music.js';

export function transformWords(words,width,height,newWidth,newHeight,angle,scale){
 const r=-angle*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
 return words.map(word=>{const points=[[word.x0,word.y0],[word.x1,word.y0],[word.x0,word.y1],[word.x1,word.y1]].map(([x,y])=>({x:((x-width/2)*c-(y-height/2)*s+newWidth/2)*scale,y:((x-width/2)*s+(y-height/2)*c+newHeight/2)*scale}));return {...word,x0:Math.min(...points.map(p=>p.x)),x1:Math.max(...points.map(p=>p.x)),y0:Math.min(...points.map(p=>p.y)),y1:Math.max(...points.map(p=>p.y))};});
}
export function printedChord(text){return parseChord(String(text).replace(/[()\[\]]/g,'').replace(/[♯＃]/g,'#').replace(/♭/g,'b').replace(/min(?=\d|$)/,'m').replace(/−/g,'m').trim());}
export function textForStaff(words,staff,previousBottom=0){
 const g=staff.gap,top=staff.lines[0],lines=[];
 const nearby=words.filter(w=>w.x1>=staff.left&&w.x0<=staff.right&&w.y0>=previousBottom&&w.y1<top+g*.1).sort((a,b)=>a.y0-b.y0||a.x0-b.x0);
 for(const word of nearby){let line=lines.find(l=>Math.abs((l.y0+l.y1-word.y0-word.y1)/2)<g*.65);if(!line){line={words:[],y0:word.y0,y1:word.y1};lines.push(line);}line.words.push(word);line.y0=Math.min(line.y0,word.y0);line.y1=Math.max(line.y1,word.y1);}
 const chords=[],directions=[],endings=[];let title='';
 for(const line of lines){line.words.sort((a,b)=>a.x0-b.x0);const text=line.words.map(w=>w.text).join(' ').trim(),distance=top-line.y1;
  const chordWords=line.words.map(w=>({w,chord:printedChord(w.text)}));
  const isChordLine=chordWords.every(x=>x.chord)&&distance<g*5;
  if(isChordLine){for(const {w,chord} of chordWords)chords.push({x:(w.x0+w.x1)/2,name:chord.name,confidence:w.confidence??100});continue;}
  for(const w of line.words)if(/^[12][.,]?$/.test(w.text)&&distance<g*3)endings.push({x:w.x0,number:w.text[0]});
  if(/^(?:allegro|andante|moderato|largo|vivace|presto|rit\.?|rall\.?|a tempo|d\.?\s*[cs]\.?|fine|to coda|coda|segno|mf|mp|ff|pp|[fp])\b/i.test(text)){directions.push({x:line.words[0].x0,text});continue;}
  if(!title&&distance>g*1.5&&/[A-Za-z]{3}/.test(text)&&!/^\d+[.,]?$/.test(text)&&line.words[0].x0<staff.left+(staff.right-staff.left)*.7){title=text.slice(0,160);}
 }
 return {title,chords,directions,endings};
}
