import "dotenv/config";
import { createCorsair } from "corsair";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { conn } from "./db";

export const corsair = createCorsair({
  kek: process.env.CORSAIR_KEK!,
  database: conn,

  hub: {
    projectApiKey: process.env.CORSAIR_DEV_API_KEY!,
    signingSecret: process.env.CORSAIR_DEV_SIGNING_SECRET!,
    allowWorkflowExecution: true,
  },

  plugins: [gmail(), googlecalendar()],
  multiTenancy: true,
});
