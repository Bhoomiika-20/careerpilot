import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDatabase } from '../../src/config/database.js';
import { ingest } from '../../src/rag/vectorStore.js';
import { retrieve } from '../../src/rag/retriever.js';
import { Document, DocumentChunk } from '../../src/models/index.js';
const enabled = process.env.RUN_LIVE_TESTS === '1';
test('LIVE: embeddings ingestion and Atlas semantic retrieval enforce private ownership', {skip:!enabled,timeout:120000},async () => {
  await connectDatabase();const owner=new mongoose.Types.ObjectId().toString();let document;
  try {document=await ingest({ownerKey:owner,title:'Live retrieval test',kind:'guide',originalFilename:'live-test.txt',isDemo:true,pages:[{text:'The fictional Orbit research award requires a minimum CGPA of 8.7 and a portfolio of astronomy projects. This is a disposable integration test document.',pageNumber:1}]});
    let found=[];
    for(let i=0;i<12;i++){const result=await retrieve(owner,'What academic grade is required for the Orbit research award?',{kind:'guide'});found=result.chunks.filter(c=>c.documentId===String(document._id));if(found.length)break;await new Promise(r=>setTimeout(r,2500));}
    assert.ok(found.length,'Document was not retrieved; inspect index readiness and relevance threshold');
    const other=await retrieve(new mongoose.Types.ObjectId().toString(),'Orbit research award',{kind:'guide'});assert.ok(!other.chunks.some(c=>c.documentId===String(document._id)));
  } finally {if(document){await DocumentChunk.deleteMany({documentId:document._id});await Document.deleteOne({_id:document._id});}await mongoose.disconnect();}
});
