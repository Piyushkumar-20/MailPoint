import {
  GoogleGenAI,
  type Content,
  type FunctionDeclaration,
  type Part,
} from "@google/genai";
import {
  buildCorsairToolDefs,
  type CorsairToolDef,
} from "@corsair-dev/mcp";
import * as z4mini from "zod/v4-mini";
import { z } from "zod";

const MODEL = "gemini-3.6-flash";

type MailPointCorsair =
  Parameters<typeof buildCorsairToolDefs>[0]["corsair"];

function createFunctionDeclarations(
  definitions: CorsairToolDef[],
): FunctionDeclaration[] {
  return definitions.map((definition) => ({
    name: definition.name,
    description: definition.description,
    parametersJsonSchema: z4mini.toJSONSchema(
      z.object(definition.shape),
      {
        target: "draft-7",
        io: "input",
      },
    ),
  }));
}

function createToolExecutor(
  definitions: CorsairToolDef[],
) {
  const definitionMap = new Map(
    definitions.map((definition) => [
      definition.name,
      definition,
    ]),
  );

  return async (
    name: string,
    args: Record<string, unknown>,
  ): Promise<string> => {
    const definition = definitionMap.get(name);

    if (!definition) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const result = await definition.handler(args);

    const text = result.content
      .filter((item) => item.type === "text")
      .map((item) => ("text" in item ? item.text : ""))
      .join("\n");

    if (result.isError) {
      throw new Error(text);
    }

    return text;
  };
}

export function createMailPointAgent(
  corsair: MailPointCorsair,
) {
  const definitions = buildCorsairToolDefs({
    corsair,
  });

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const functionDeclarations =
    createFunctionDeclarations(definitions);

  const executeTool = createToolExecutor(definitions);

  return {
    async run(input: string) {
      const contents: Content[] = [
        {
          role: "user",
          parts: [
            {
              text: input,
            },
          ],
        },
      ];

      for (let iteration = 0; iteration < 10; iteration++) {
        const response = await ai.models.generateContent({
          model: MODEL,
          contents,
          config: {
            systemInstruction: `
You are the MailPoint AI agent.

You help the authenticated user work with their Gmail
and Google Calendar.

Use the available tools when necessary.

Never claim an action succeeded unless the tool confirms it.

If a tool fails, clearly explain the failure to the user.

For read operations, use the available tools to retrieve
the actual information instead of guessing.

Keep responses concise and useful.
`,
            tools: [
              {
                functionDeclarations,
              },
            ],
          },
        });

        const candidate = response.candidates?.[0];

        if (!candidate?.content) {
          throw new Error("Gemini returned no response.");
        }

        /*
         * IMPORTANT:
         *
         * Preserve Gemini's complete model Content object.
         *
         * Do NOT reconstruct functionCall parts manually.
         *
         * Gemini 3 attaches thoughtSignature to functionCall
         * parts and requires that signature to be returned
         * unchanged on the next request.
         */
        const modelContent = candidate.content;

        contents.push(modelContent);

        const functionCalls = modelContent.parts
          ?.filter(
            (
              part,
            ): part is Part & {
              functionCall: NonNullable<Part["functionCall"]>;
            } => part.functionCall !== undefined,
          )
          .map((part) => part.functionCall);

        if (!functionCalls || functionCalls.length === 0) {
          return response.text ?? "";
        }

        const functionResponses: Part[] = [];

        for (const functionCall of functionCalls) {
          if (!functionCall.name) {
            continue;
          }

          const args = functionCall.args ?? {};

          try {
            const result = await executeTool(
              functionCall.name,
              args,
            );

            functionResponses.push({
              functionResponse: {
                name: functionCall.name,
                response: {
                  output: result,
                },
                ...(functionCall.id
                  ? { id: functionCall.id }
                  : {}),
              },
            });
          } catch (error) {
            functionResponses.push({
              functionResponse: {
                name: functionCall.name,
                response: {
                  error:
                    error instanceof Error
                      ? error.message
                      : String(error),
                },
                ...(functionCall.id
                  ? { id: functionCall.id }
                  : {}),
              },
            });
          }
        }

        if (functionResponses.length === 0) {
          throw new Error(
            "Gemini requested a tool call without a valid function name.",
          );
        }

        contents.push({
          role: "user",
          parts: functionResponses,
        });
      }

      throw new Error(
        "Agent exceeded the maximum tool iterations.",
      );
    },
  };
}

export async function runMailPointAgent(
  corsair: MailPointCorsair,
  input: string,
) {
  const agent = createMailPointAgent(corsair);

  const finalOutput = await agent.run(input);

  return {
    finalOutput,
  };
}