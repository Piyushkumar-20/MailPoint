import { createBaseMcpServer } from "@corsair-dev/mcp";
import type { BaseMcpOptions } from "@corsair-dev/mcp";

type McpCorsair = BaseMcpOptions["corsair"];

export function createAgentMcpServer(corsair: McpCorsair) {
  return createBaseMcpServer({
    corsair,
  });
}