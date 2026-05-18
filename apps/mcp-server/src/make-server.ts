import type { Logic } from '@leverie/engine';
import {
  evaluateLogicByName,
  logicNameToToolSlug,
  logicToZodInputShape,
  logicToZodOutputShape,
} from '@leverie/schema';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PACKAGE_NAME, PACKAGE_VERSION } from './version.js';

const SERVER_INFO = { name: PACKAGE_NAME, version: PACKAGE_VERSION };

/**
 * Build an empty `McpServer` with no tools registered. Used when --strict is
 * off and the only loaded file failed validation; also the building block for
 * P1.3's directory mode.
 */
export function createServer(): McpServer {
  return new McpServer(SERVER_INFO, { capabilities: { tools: {} } });
}

/**
 * Build an `McpServer` that exposes a single Logic as one MCP tool.
 *
 * Zod shapes come from `@leverie/schema` so the SDK can JSON-Schema-ify the
 * tool definition and validate `structuredContent` against the declared
 * output shape. See `doc/investigation_p1_mcp_protocol.md` for the rationale.
 */
export function makeLogicServer(logic: Logic): McpServer {
  const server = createServer();
  registerLogicTool(server, logic);
  return server;
}

/**
 * Register a Logic as a tool on an existing `McpServer`. Extracted so P1.3
 * (directory mode) can mount multiple logics on one server.
 */
export function registerLogicTool(server: McpServer, logic: Logic): void {
  server.registerTool(
    logicNameToToolSlug(logic.name),
    {
      title: logic.name,
      description:
        logic.description ??
        `Evaluate the "${logic.name}" decision logic. Returns the matched conclusion or "no_match".`,
      inputSchema: logicToZodInputShape(logic),
      outputSchema: logicToZodOutputShape(logic),
    },
    async (args) => {
      const inputs: Record<string, string> = {};
      for (const [key, value] of Object.entries(args)) {
        if (value === null || value === undefined) continue;
        inputs[key] = String(value);
      }

      const result = evaluateLogicByName(logic, inputs);

      const structuredContent =
        result.status === 'ok'
          ? { status: 'ok' as const, outputs: result.outputs }
          : { status: 'no_match' as const, tableId: result.tableId };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent,
      };
    },
  );
}
