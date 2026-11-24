// PostToolUse hook (Edit|Write): format the edited file with the repo's Prettier.
// Silent on success; never blocks. Files Prettier doesn't handle are skipped.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const web = path.join(root, "web");
const prettier = path.join(web, "node_modules", "prettier", "bin", "prettier.cjs");

let file;
try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  file = input.tool_input?.file_path ?? input.tool_response?.filePath;
} catch {
  process.exit(0);
}
if (!file || !existsSync(prettier)) process.exit(0);

const abs = path.resolve(file);
const rel = path.relative(root, abs);
// Only files Prettier owns in this repo: web/** and data/*.json (see `npm run format`).
const owned =
  rel.startsWith(`web${path.sep}`) || (rel.startsWith(`data${path.sep}`) && rel.endsWith(".json"));
if (!owned || rel.includes("node_modules")) process.exit(0);

try {
  execFileSync(process.execPath, [prettier, "--write", "--ignore-unknown", "--log-level", "warn", abs], {
    cwd: web,
    stdio: ["ignore", "ignore", "pipe"],
  });
} catch {
  // A syntax error means Prettier can't parse yet; tsc in the Stop hook will report it.
}
