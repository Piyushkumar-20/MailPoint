import "dotenv/config";
import { createCorsair } from "corsair";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { conn } from "./db";

const isProduction = process.env.NODE_ENV === "production";

const corsairApiKey = isProduction
  ? process.env.CORSAIR_PROD_API_KEY
  : process.env.CORSAIR_DEV_API_KEY;

const corsairSigningSecret = isProduction
  ? process.env.CORSAIR_PROD_SIGNING_SECRET
  : process.env.CORSAIR_DEV_SIGNING_SECRET;

if (!process.env.CORSAIR_KEK) {
  throw new Error("Missing CORSAIR_KEK environment variable.");
}

if (!corsairApiKey) {
  throw new Error(
    isProduction
      ? "Missing CORSAIR_PROD_API_KEY environment variable."
      : "Missing CORSAIR_DEV_API_KEY environment variable.",
  );
}

if (!corsairSigningSecret) {
  throw new Error(
    isProduction
      ? "Missing CORSAIR_PROD_SIGNING_SECRET environment variable."
      : "Missing CORSAIR_DEV_SIGNING_SECRET environment variable.",
  );
}

export const corsair = createCorsair({
  kek: process.env.CORSAIR_KEK,
  database: conn,

  hub: {
    projectApiKey: corsairApiKey,
    signingSecret: corsairSigningSecret,
    allowWorkflowExecution: true,
  },

  plugins: [
    gmail({
      permissions: {
        mode: "strict",
      },
    }),
    googlecalendar({
      permissions: {
        mode: "strict",
      },
    }),
  ],

  multiTenancy: true,
});
