import {test} from 'node:test';
import assert from 'node:assert/strict';
import {packet,transferFile,readTransferFile,validatePacket} from '../src/transfer.js';
test('transfer files preserve source, arrangement choices, song linkage, and PDF bytes',async()=>{
  const xml='<score-partwise version="4.0"><part-list/></score-partwise>';
  const source=packet({kind:'score',title:'Voilà! & friends',xml,session:{version:1,sourceXml:xml,options:{drone:'moving'},generatedEdits:{VD:{}}},pdf:new Blob(['%PDF-1.7\nscore'],{type:'application/pdf'}),songId:'catalog:Parting Glass'});
  const restored=await readTransferFile(await transferFile(source));
  assert.equal(restored.xml,xml);assert.equal(restored.songId,source.songId);assert.deepEqual(restored.session,source.session);assert.equal(await restored.pdf.text(),await source.pdf.text());
});
test('invalid transfer versions, missing scores, and oversized attachments are rejected',()=>{
  assert.throws(()=>validatePacket({schema:'unknown',kind:'score'}));
  assert.throws(()=>packet({kind:'score',xml:'<html/>'}));
  assert.throws(()=>packet({kind:'scan',pdf:null}));
  assert.throws(()=>packet({kind:'scan',pdf:new Blob([new Uint8Array(30000001)])}));
});
