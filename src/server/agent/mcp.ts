import { buildCorsairToolDefs } from "@corsair-dev/mcp";

type McpCorsair = Parameters<typeof buildCorsairToolDefs>[0]["corsair"];

export function createAgentMcpTools(corsair: McpCorsair) {
  return buildCorsairToolDefs({ corsair });
}

export function createAgentRunScriptExecutor(corsair: McpCorsair) {
  const definitions = createAgentMcpTools(corsair);

  const runScriptDefinition = definitions.find(
    (definition) => definition.name === "run_script",
  );

  if (!runScriptDefinition) {
    throw new Error("Corsair run_script tool is unavailable.");
  }

  return async (code: string): Promise<string> => {
    const result = await runScriptDefinition.handler({ code });

    const text = result.content
      .filter(
        (item): item is Extract<typeof item, { type: "text" }> =>
          item.type === "text",
      )
      .map((item) => item.text)
      .join("\n");

    if (result.isError) {
      throw new Error(text || "Corsair run_script failed.");
    }

    return text;
  };
}
