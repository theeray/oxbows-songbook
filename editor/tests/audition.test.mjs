import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Player} from '../src/audio.js';

test('rapid pitch auditions start in the gesture, replace prior audio, and ignore stale play failures',async t=>{
  const previousDocument=globalThis.document,create=URL.createObjectURL,revoke=URL.revokeObjectURL,blobs=[],pending=[];let appended=0;
  const audio={src:'',paused:true,currentTime:0,setAttribute(){},pause(){this.paused=true;},play(){this.paused=false;return new Promise((resolve,reject)=>pending.push({resolve,reject}));}};
  globalThis.document={createElement(){return audio;},body:{appendChild(){appended++;}}};
  URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:test-'+blobs.length;};URL.revokeObjectURL=()=>{};
  const player=new Player();t.after(()=>{player.stop();globalThis.document=previousDocument;URL.createObjectURL=create;URL.revokeObjectURL=revoke;});
  const first=player.audition(60),second=player.audition(72);
  assert.equal(pending.length,2);assert.equal(appended,1);assert.equal(audio.src,'blob:test-2');assert.equal(audio.paused,false);assert.equal(player.playing,false);
  pending[0].reject(new Error('Interrupted'));pending[1].resolve();assert.equal(await first,false);assert.equal(await second,true);
  // The octave edit must double the actual synthesized frequency.
  const crossings=async blob=>{const view=new DataView(await blob.arrayBuffer());let count=0;for(let i=2205;i<6615;i++)if(view.getInt16(44+i*2,true)>0&&view.getInt16(44+(i-1)*2,true)<=0)count++;return count;};
  const low=await crossings(blobs[0]),high=await crossings(blobs[1]);assert.ok(Math.abs(high/low-2)<.05);
  await player.audition(null);assert.equal(audio.paused,true);assert.equal(blobs.length,2);
});
