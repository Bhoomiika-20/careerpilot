import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000), CLIENT_URL: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1), JWT_SECRET: z.string().min(32),
  OPENAI_API_KEY: z.string().default(''), OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_MODEL: z.string().default(''), EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536), VECTOR_INDEX: z.string().default('careerpilot_vector'),
  RETRIEVAL_THRESHOLD: z.coerce.number().min(0).max(1).default(0.65), AI_TIMEOUT_MS: z.coerce.number().positive().default(45000)
});
export function loadConfig() {
  const result = schema.safeParse(process.env);
  if (!result.success) throw new Error('Configuration missing or invalid: ' + result.error.issues.map(i => i.path.join('.')).join(', ') + '. See backend/.env.example.');
  return result.data;
}
export const config = loadConfig();
