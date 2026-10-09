import { config } from '../config/env.js';
import { AppError } from '../utils/errors.js';
export async function aiRequest(path, body) {
  if (!config.OPENAI_API_KEY) throw new AppError(503, 'AI is not configured. Set OPENAI_API_KEY on the server.');
  let response;
  try { response = await fetch(`${config.OPENAI_BASE_URL.replace(/\/$/, '')}/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(config.AI_TIMEOUT_MS) }); }
  catch { throw new AppError(503, 'AI provider timed out or could not be reached. Please retry.'); }
  if (!response.ok) throw new AppError(503, `AI provider rejected the request (HTTP ${response.status}). Check server configuration or quota.`);
  return response.json();
}
export async function completion(messages, tools) {
  if (!config.OPENAI_MODEL) throw new AppError(503, 'Set OPENAI_MODEL to a model supporting function calling.');
  const body = { model: config.OPENAI_MODEL, messages, ...(tools?.length ? { tools, tool_choice: 'auto' } : {}), max_completion_tokens: 2200 };
  const result = await aiRequest('chat/completions', body);
  if (!result.choices?.[0]?.message) throw new AppError(502, 'AI provider returned an invalid response.');
  return result.choices[0].message;
}
export async function structured(messages, schema) {
  if (!config.OPENAI_MODEL) throw new AppError(503, 'Set OPENAI_MODEL before using resume analysis.');
  const result = await aiRequest('chat/completions', { model: config.OPENAI_MODEL, messages, response_format: { type: 'json_object' }, max_completion_tokens: 2500 });
  try { return schema.parse(JSON.parse(result.choices[0].message.content)); }
  catch { throw new AppError(502, 'AI output failed validation. No unverified analysis was saved.'); }
}
