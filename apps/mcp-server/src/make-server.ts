import type { Logic } from '@leverie/engine';
import {
  evaluateLogicByName,
  formatTrace,
  logicNameToToolSlug,
  logicToToolDescription,
  logicToZodInputShape,
  logicToZodOutputShape,
} from '@leverie/schema';
import {
  McpServer,
  type RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { PACKAGE_NAME, PACKAGE_VERSION } from './version.js';

const SERVER_INFO = { name: PACKAGE_NAME, version: PACKAGE_VERSION };

/**
 * Build an empty `McpServer`. Directory mode and `--watch` reloads need to
 * register tools onto a server they own, so the construction step is exposed
 * separately from the single-file convenience builder below.
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
 * Register a Logic as a tool on an existing `McpServer`. Returns the SDK's
 * `RegisteredTool` handle so callers can `.remove()` the tool on `--watch`
 * reloads.
 */
export function registerLogicTool(
  server: McpServer,
  logic: Logic,
): RegisteredTool {
  return server.registerTool(
    logicNameToToolSlug(logic.name),
    {
      title: logic.name,
      description: logicToToolDescription(logic),
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
      const trace = formatTrace(logic, result.trace);

      const structuredContent =
        result.status === 'ok'
          ? {
              status: 'ok' as const,
              outputs: result.outputs,
              trace,
            }
          : {
              status: 'no_match' as const,
              unmatchedTable:
                logic.tables[result.tableId]?.name ?? result.tableId,
              trace,
            };

      return {
        content: [
          { type: 'text', text: JSON.stringify(structuredContent, null, 2) },
        ],
        structuredContent,
      };
    },
  );
}
