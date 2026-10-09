import { Document, DocumentChunk } from '../models/index.js';
import { chunkText } from './chunker.js';
import { embed } from './embeddings.js';
import { config } from '../config/env.js';
import { AppError } from '../utils/errors.js';
export function vectorPipeline(ownerKey, vector, { kind, documentId } = {}) {
  const filter = { ownerKey: { $in: [String(ownerKey), 'public'] }, embeddingModel: config.EMBEDDING_MODEL };
  if (kind) filter.kind = kind;
  if (documentId) filter.documentId = documentId;
  return [{ $vectorSearch: { index: config.VECTOR_INDEX, path: 'embedding', queryVector: vector, numCandidates: 100, limit: 6, filter } }, { $set: { score: { $meta: 'vectorSearchScore' } } }, { $match: { score: { $gte: config.RETRIEVAL_THRESHOLD } } }, { $project: { embedding: 0 } }];
}
export async function ingest({ ownerKey, pages, ...metadata }) {
  const doc = await Document.create({ ...metadata, ownerKey, status: 'processing' });
  try {
    const pieces = pages.flatMap(p => chunkText(p.text).map(text => ({ text, pageNumber: p.pageNumber })));
    if (!pieces.length) throw new AppError(400, 'Document has no readable text.');
    const vectors = [];
    for (let i = 0; i < pieces.length; i += 16) vectors.push(...await embed(pieces.slice(i, i + 16).map(p => p.text)));
    await DocumentChunk.insertMany(pieces.map((piece, index) => ({ ...piece, documentId: doc._id, ownerKey, kind: metadata.kind, title: metadata.title, sourceUrl: metadata.sourceUrl, originalFilename: metadata.originalFilename, isDemo: metadata.isDemo, chunkIndex: index, embedding: vectors[index], embeddingModel: config.EMBEDDING_MODEL })));
    doc.status = 'ready'; doc.chunkCount = pieces.length; await doc.save(); return doc;
  } catch (error) { await DocumentChunk.deleteMany({ documentId: doc._id }); doc.status = 'failed'; await doc.save(); throw error; }
}
export async function vectorSearch(ownerKey, vector, filters) {
  try { return await DocumentChunk.aggregate(vectorPipeline(ownerKey, vector, filters)).option({ maxTimeMS: 15000 }); }
  catch { throw new AppError(503, 'Atlas Vector Search is unavailable. Check the index, dimensions and database connection.'); }
}
