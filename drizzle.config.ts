import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  tablesFilter: "*",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});