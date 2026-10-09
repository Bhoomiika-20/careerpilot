import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { config } from '../../config/env.js';
import { contextToken } from '../capability.js';
import { AppError } from '../../utils/errors.js';
export async function connectMcp(userId, capability) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../server.js', import.meta.url))], env: { ...Object.fromEntries(Object.entries(config).map(([k, v]) => [k, String(v)])), PATH: process.env.PATH || '', MCP_CONTEXT: contextToken(userId, capability) }, stderr: 'pipe' });
  const client = new Client({ name: 'careerpilot-agent', version: '1.0.0' });
  try { await client.connect(transport, { timeout: 15000 }); } catch { await transport.close(); throw new AppError(503, 'MCP tool server could not start. Check the database connection.'); }
  return { client, close: () => client.close(), async invoke(name, args) {
    const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 100000 });
    if (result.isError) throw new AppError(400, result.content?.[0]?.text || 'Tool execution failed.');
    return result.structuredContent?.data ?? JSON.parse(result.content[0].text).data;
  } };
}
