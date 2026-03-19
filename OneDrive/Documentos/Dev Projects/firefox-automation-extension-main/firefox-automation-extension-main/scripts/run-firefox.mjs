import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * web-ext's fx-runner looks for a binary named `firefox` on PATH. On many Linux
 * servers only `firefox-esr` exists, or Firefox is not installed at all.
 * On Windows, PATH often lacks `firefox`; check default install locations.
 */
function resolveFirefoxBinary() {
  const explicit = process.env.FIREFOX_BINARY?.trim();
  if (explicit) return explicit;

  if (process.platform === "win32") {
    const programFiles = process.env.ProgramFiles || "C:\\Program Files";
    const programFilesX86 =
      process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    const candidates = [
      path.join(programFiles, "Mozilla Firefox", "firefox.exe"),
      path.join(programFilesX86, "Mozilla Firefox", "firefox.exe"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  }

  const names = ["firefox", "firefox-esr"];
  for (const name of names) {
    try {
      const out = execSync(`command -v ${name}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (out) return out;
    } catch {
      /* try next */
    }
  }
  return null;
}

const args = [
  "run",
  "--source-dir",
  "dist",
  "--watch-file",
  "dist/manifest.json",
  "--devtools",
];

const firefoxBinary = resolveFirefoxBinary();
if (firefoxBinary) {
  args.push("--firefox", firefoxBinary);
} else {
  console.error(
    [
      "Firefox not found in PATH (tried: firefox, firefox-esr).",
      "Install Firefox (e.g. apt install firefox-esr) or set FIREFOX_BINARY to the full path to the browser binary.",
    ].join("\n"),
  );
  process.exit(1);
}

if (process.env.FIREFOX_PROFILE) {
  args.push("--firefox-profile", process.env.FIREFOX_PROFILE);
}

args.push(...process.argv.slice(2));

const webExtCli = path.join(__dirname, "..", "node_modules", "web-ext", "bin", "web-ext.js");
const child = spawn(process.execPath, [webExtCli, ...args], {
  stdio: "inherit",
  shell: false,
  windowsHide: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
