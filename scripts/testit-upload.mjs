import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(".env") });
loadEnv({ path: path.resolve(".env.local"), override: true });
const resultsDir = path.resolve("test-results");
const files = fs.existsSync(resultsDir) ? fs.readdirSync(resultsDir).filter((file) => file.endsWith(".xml")) : [];

if (files.length === 0) {
  throw new Error("No JUnit XML files found in test-results. Run npm run test:junit and npm run postman:test first.");
}

const args = [
  "results",
  "import",
  "--url",
  requireEnv("TMS_URL"),
  "--project-id",
  requireEnv("TMS_PROJECT_ID"),
  "--configuration-id",
  requireEnv("TMS_CONFIGURATION_ID"),
  "--testrun-name",
  process.env.TMS_TESTRUN_NAME ?? "SmartHome automated run",
  "--results",
  resultsDir
];

const result = spawnSync("testit", args, {
  stdio: "inherit",
  env: {
    ...process.env,
    TMS_TOKEN: requireEnv("TMS_TOKEN")
  }
});

if (result.error) {
  throw result.error;
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
