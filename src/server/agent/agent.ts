import { Agent, run, tool } from "@openai/agents";
import { buildCorsairToolDefs } from "@corsair-dev/mcp";
import type { BaseMcpOptions } from "@corsair-dev/mcp";
import { z } from "zod";

type McpCorsair = BaseMcpOptions["corsair"];

export function createMailPointAgent(corsair: McpCorsair) {
  const definitions = buildCorsairToolDefs({
    corsair,
  });

  const tools = definitions.map((definition) =>
    tool({
      name: definition.name,
      description: definition.description,
      parameters: z.object(definition.shape),
      execute: async (args) => {
        const result = await definition.handler(
          args,
        );

        if (result.isError) {
          const message = result.content
            .filter((item) => item.type === "text")
            .map((item) => ("text" in item ? item.text : ""))
            .join("\n");

          throw new Error(message);
        }

        return result.content
          .filter((item) => item.type === "text")
          .map((item) => ("text" in item ? item.text : ""))
          .join("\n");
      },
    }),
  );

  return new Agent({
    name: "MailPoint Agent",
    instructions: `
You are the MailPoint AI agent.

You help the authenticated user work with their Gmail and Google Calendar.

Use the available tools to retrieve information or perform requested actions.

Never claim an action succeeded unless the tool confirms it.
If an operation fails, clearly explain the failure.
`,
    tools,
  });
}

export async function runMailPointAgent(
  corsair: McpCorsair,
  input: string,
) {
  const agent = createMailPointAgent(corsair);

  return run(agent, input);
}