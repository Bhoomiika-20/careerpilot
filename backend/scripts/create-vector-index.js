import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/database.js';
import { DocumentChunk } from '../src/models/index.js';
import { config } from '../src/config/env.js';
try {
  await connectDatabase(); await DocumentChunk.createCollection();
  const existing = await DocumentChunk.collection.listSearchIndexes(config.VECTOR_INDEX).toArray();
  if (existing.length) console.log('Index exists. Inspect dimensions in Atlas before changing models.');
  else {
    await DocumentChunk.collection.createSearchIndex({ name: config.VECTOR_INDEX, type: 'vectorSearch', definition: { fields: [{ type: 'vector', path: 'embedding', numDimensions: config.EMBEDDING_DIMENSIONS, similarity: 'cosine' }, ...['ownerKey','kind','documentId','embeddingModel'].map(path => ({ type: 'filter', path }))] } });
    console.log('Index creation requested. Wait for READY in Atlas before running live retrieval.');
  }
} catch { console.error('Vector index setup failed. Use an Atlas cluster with Vector Search and a database user permitted to create search indexes.'); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
