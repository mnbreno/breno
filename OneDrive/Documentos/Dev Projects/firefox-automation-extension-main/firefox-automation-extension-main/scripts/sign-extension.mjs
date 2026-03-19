import { spawnSync } from "node:child_process";

const {
  AMO_JWT_ISSUER,
  AMO_JWT_SECRET,
  AMO_CHANNEL = "unlisted",
} = process.env;

if (!AMO_JWT_ISSUER || !AMO_JWT_SECRET) {
  console.error("Missing AMO_JWT_ISSUER or AMO_JWT_SECRET environment variables.");
  process.exit(1);
}

const sourceArchive = "web-ext-artifacts/source-code.zip";

const sourceBuild = spawnSync(
  "npx",
  [
    "web-ext",
    "build",
    "-s",
    ".",
    "-a",
    "web-ext-artifacts",
    "-n",
    "source-code.zip",
    "--overwrite-dest",
    "--ignore-files",
    "node_modules",
    "dist",
    "coverage",
    "web-ext-artifacts",
    ".git",
  ],
  { stdio: "inherit", shell: true },
);

if (sourceBuild.status !== 0) {
  process.exit(sourceBuild.status ?? 1);
}

const signResult = spawnSync(
  "npx",
  [
    "web-ext",
    "sign",
    "--source-dir",
    "dist",
    "--artifacts-dir",
    "web-ext-artifacts",
    "--channel",
    AMO_CHANNEL,
    "--api-key",
    AMO_JWT_ISSUER,
    "--api-secret",
    AMO_JWT_SECRET,
    "--upload-source-code",
    sourceArchive,
  ],
  { stdio: "inherit", shell: true },
);

process.exit(signResult.status ?? 0);
