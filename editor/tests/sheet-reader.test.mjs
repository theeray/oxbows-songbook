import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clampZoom,zoomAnchor} from '../src/sheet-reader.js';
test('zoom preserves the document point under the pinch center and has finite bounds',()=>{
 for(const [scroll,point,before,after] of [[200,100,1,2],[500,80,2,.5],[0,160,.5,3]]){
  const next=zoomAnchor(scroll,point,before,after);
  assert.equal((next+point)/after,(scroll+point)/before);
 }
 assert.equal(clampZoom(.01),.15);assert.equal(clampZoom(20),6);assert.equal(clampZoom(1.37),1.37);
});
