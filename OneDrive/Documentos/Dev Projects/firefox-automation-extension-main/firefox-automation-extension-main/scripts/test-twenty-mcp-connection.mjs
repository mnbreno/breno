#!/usr/bin/env node
/**
 * Tests the Twenty CRM API connection (same as used by the MCP server).
 * Reads config from .cursor/mcp.json or uses env TWENTY_API_KEY, TWENTY_BASE_URL.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

let apiKey = process.env.TWENTY_API_KEY;
let baseUrl = process.env.TWENTY_BASE_URL || "https://api.twenty.com";

try {
  const mcpPath = join(projectRoot, ".cursor", "mcp.json");
  const mcp = JSON.parse(readFileSync(mcpPath, "utf8"));
  const twenty = mcp?.mcpServers?.["twenty-crm"];
  if (twenty?.env) {
    apiKey = apiKey || twenty.env.TWENTY_API_KEY;
    baseUrl = twenty.env.TWENTY_BASE_URL || baseUrl;
  }
} catch (e) {
  // ignore, use env only
}

if (!apiKey) {
  console.error("Error: TWENTY_API_KEY not set. Set it in .cursor/mcp.json or as env var.");
  process.exit(1);
}

const url = `${baseUrl.replace(/\/$/, "")}/rest/metadata/objects`;
console.log("Testing Twenty CRM connection...");
console.log("URL:", url);

try {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("API error:", res.status, res.statusText);
    console.error(text.slice(0, 500));
    process.exit(1);
  }

  const data = await res.json();
  const count = Array.isArray(data) ? data.length : (data?.objects?.length ?? "?");
  console.log("OK – Twenty CRM API is reachable. Metadata objects:", count);
} catch (err) {
  console.error("Connection failed:", err.message);
  process.exit(1);
}
