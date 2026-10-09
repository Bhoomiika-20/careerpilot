import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { toolRegistry } from './registry.js';
import { authorizeWrite } from './capability.js';
import { safeError } from '../utils/errors.js';
export function createMcpServer(claims, registry = toolRegistry) {
  const server = new McpServer({ name: 'careerpilot-tools', version: '1.0.0' });
  let writeUsed = false;
  for (const tool of registry) {
    const base = tool.schema._def.schema || tool.schema;
    server.registerTool(tool.name, { description: tool.description, inputSchema: base.shape, annotations: { readOnlyHint: !tool.write, destructiveHint: false, openWorldHint: false } }, async args => {
      try {
        if (!claims.sub || claims.exp * 1000 < Date.now()) throw Object.assign(new Error('MCP context expired.'), { status: 401 });
        const parsed = tool.schema.parse(args);
        if (tool.write) { authorizeWrite(claims, tool.name, parsed); if (writeUsed) throw Object.assign(new Error('Confirmation already used.'), { status: 409 }); writeUsed = true; }
        const data = JSON.parse(JSON.stringify(await tool.run(claims.sub, parsed)));
        return { content: [{ type: 'text', text: JSON.stringify({ data }) }], structuredContent: { data } };
      } catch (error) { return { isError: true, content: [{ type: 'text', text: error.name === 'ZodError' ? 'Invalid tool arguments.' : safeError(error) }] }; }
    });
  }
  return server;
}
