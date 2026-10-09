import { z } from 'zod';
import { AgentRun, ToolCall } from '../models/index.js';
import { completion } from '../services/ai.js';
import { retrieve } from '../rag/retriever.js';
import { connectMcp } from '../mcp/client/index.js';
import { findTool } from '../mcp/registry.js';
import { systemPrompt } from './prompts.js';
import { llmTools, activityLabels } from './tools.js';
import { safeError, AppError } from '../utils/errors.js';
export async function executeLoop({ messages, tools, callModel, execute, maxSteps = 8, maxCalls = 18, onActivity = () => {}, deadlineMs = 180000 }) {
  let calls = 0; const started = Date.now();
  for (let step = 0; step < maxSteps; step++) {
    if (Date.now() - started > deadlineMs) throw new AppError(504, 'Assistant time limit reached. Try a smaller request.');
    const answer = await callModel(messages, tools);
    messages.push(answer);
    if (!answer.tool_calls?.length) return answer.content || 'No answer was returned.';
    for (const call of answer.tool_calls) {
      if (++calls > maxCalls || Date.now() - started > deadlineMs) throw new AppError(429, 'Tool limit reached. Try a smaller request.');
      let result;
      onActivity({ tool: call.function.name, label: activityLabels[call.function.name] || call.function.name.replaceAll('_', ' '), state: 'running' });
      try { result = await execute(call.function.name, JSON.parse(call.function.arguments)); }
      catch (error) { result = { error: safeError(error) }; }
      onActivity({ tool: call.function.name, label: activityLabels[call.function.name] || call.function.name.replaceAll('_', ' '), state: result.error ? 'failed' : result.pendingConfirmation ? 'awaiting confirmation' : 'completed' });
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  throw new AppError(429, 'Assistant step limit reached. Please narrow your request.');
}
export async function runAgent(userId, sessionId, history, onActivity = () => {}) {
  const run = await AgentRun.create({ userId, sessionId, status: 'running' });
  let mcp; const citations = [], proposals = [], activity = [];
  try {
    mcp = await connectMcp(userId);
    const discovered = await mcp.client.listTools();
    const content = await executeLoop({ messages: [{ role: 'system', content: systemPrompt + '\nCurrent UTC time: ' + new Date().toISOString() }, ...history], tools: llmTools(discovered.tools), callModel: completion,
      onActivity: item => { activity.push(item); onActivity(item); },
      execute: async (name, args) => {
        if (name === 'retrieve_knowledge') {
          const parsed = z.object({ query: z.string().min(1).max(2000), kind: z.enum(['scholarship','job','guide','resume']).optional() }).strict().parse(args);
          const result = await retrieve(userId, parsed.query, { kind: parsed.kind }); citations.push(...result.chunks); return result;
        }
        const definition = findTool(name); if (!definition) throw new AppError(400, 'Unknown tool.');
        const parsed = definition.schema.parse(args);
        const record = await ToolCall.create({ userId, runId: run._id, name, args: parsed, status: definition.write ? 'pending' : 'executing', expiresAt: new Date(Date.now() + 15 * 60000) });
        if (definition.write) { const proposal = { id: String(record._id), name, args: parsed }; proposals.push(proposal); return { pendingConfirmation: true, ...proposal }; }
        try { const result = await mcp.invoke(name, parsed); record.status = 'completed'; await record.save(); return result; }
        catch (error) { record.status = 'failed'; await record.save(); throw error; }
      }
    });
    run.status = 'completed'; run.activities = activity; await run.save();
    const unique = [...new Map(citations.map(c => [c.citationId, c])).values()];
    const known = new Set(unique.map(c => c.citationId));
    const safeContent = content.replace(/\[source:([^\]]+)\]/g, (match, id) => known.has(id) ? match : '[unverified citation removed]');
    return { content: safeContent, citations: unique, proposals, activity };
  } catch (error) { run.status = 'failed'; run.error = safeError(error); run.activities = activity; await run.save(); throw error; }
  finally { await mcp?.close(); }
}
