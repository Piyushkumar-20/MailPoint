import "dotenv/config";
import { createCorsair } from "corsair";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { conn } from "./db";

const gmailPlugin = gmail({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  permissions: {
    mode: "strict",
    overrides: {
      "messages.send": "allow", // explicit Send button in composer
      "messages.modify": "allow", // mark read/unread, star/unstar — explicit UI clicks
      "messages.trash": "allow", // move to trash — explicit UI click (+ window.confirm)
    },
  },
});

// Ensure full Gmail scope (https://mail.google.com/) is requested for permanent deletion
// while preserving all existing scopes
if (
  gmailPlugin.oauthConfig?.scopes &&
  !gmailPlugin.oauthConfig.scopes.includes("https://mail.google.com/")
) {
  gmailPlugin.oauthConfig.scopes = [
    ...gmailPlugin.oauthConfig.scopes,
    "https://mail.google.com/",
  ];
}

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
    gmailPlugin,

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
