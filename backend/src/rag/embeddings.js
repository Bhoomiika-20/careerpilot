import { aiRequest } from '../services/ai.js';
import { config } from '../config/env.js';
import { AppError } from '../utils/errors.js';
export async function embed(texts) {
  const result = await aiRequest('embeddings', { model: config.EMBEDDING_MODEL, input: texts });
  const vectors = result.data?.sort((a, b) => a.index - b.index).map(item => item.embedding);
  if (vectors?.length !== texts.length || vectors.some(v => !Array.isArray(v) || v.length !== config.EMBEDDING_DIMENSIONS || v.some(n => !Number.isFinite(n)))) throw new AppError(502, 'Embedding dimensions do not match server configuration.');
  return vectors;
}
