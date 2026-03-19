import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const manifestPath = path.join(distDir, "manifest.json");
const docsDir = path.join(rootDir, "docs");

function fail(message) {
  console.error(`Validation failed: ${message}`);
  process.exit(1);
}

function ensureFile(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    fail(`Missing required file: ${relativePath}`);
  }
}

if (!fs.existsSync(manifestPath)) {
  fail("Build output manifest was not found. Run `npm run build` first.");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (manifest.manifest_version !== 3) {
  fail("Manifest must use version 3.");
}

if (!manifest.background?.scripts?.length) {
  fail("Firefox MV3 build must declare background.scripts.");
}

if (!manifest.browser_specific_settings?.gecko?.id) {
  fail("Manifest should declare browser_specific_settings.gecko.id for AMO.");
}

for (const fileName of ["background.js", "content.js", "popup.js", "options.js", "popup.html", "options.html"]) {
  if (!fs.existsSync(path.join(distDir, fileName))) {
    fail(`Missing built artifact: ${fileName}`);
  }
}

for (const docFile of [
  "docs/README.md",
  "docs/api/webextensions-core.md",
  "docs/api/permissions-and-security.md",
  "docs/guides/content-scripts.md",
  "docs/guides/background-and-events.md",
  "docs/guides/testing-and-validation.md",
  "docs/guides/firefox-compatibility.md",
  "docs/troubleshooting/common-issues.md",
]) {
  ensureFile(docFile);
}

if (!fs.existsSync(docsDir)) {
  fail("Docs directory was not created.");
}

const bundledFiles = fs.readdirSync(distDir);
for (const file of bundledFiles) {
  const fullPath = path.join(distDir, file);
  if (!fs.statSync(fullPath).isFile()) {
    continue;
  }

  const contents = fs.readFileSync(fullPath, "utf8");
  if (/<script[^>]+src=["']https?:\/\//i.test(contents)) {
    fail(`Remote script reference detected in ${file}.`);
  }
}

if (Array.isArray(manifest.host_permissions) && manifest.host_permissions.includes("<all_urls>")) {
  console.warn("Warning: <all_urls> is enabled. Narrow host permissions before AMO submission if possible.");
}

console.log("Extension validation passed.");
