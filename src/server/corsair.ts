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
    // projectApiKey: process.env.CORSAIR_PROD_API_KEY!,
    // signingSecret: process.env.CORSAIR_PROD_SIGNING_SECRET!,
    allowWorkflowExecution: true,
  },

  plugins: [
    gmail({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      permissions: {
        mode: "strict",
      },
    }),

    googlecalendar({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      permissions: {
        mode: "strict",
      },
    }),
  ],

  multiTenancy: true,
});
