import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  serverExternalPackages: [
    "@corsair-dev/mcp",
    "express",
    "@modelcontextprotocol/sdk",
  ],
};

export default config;