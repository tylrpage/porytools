// Stop hook: when TypeScript in web/ has uncommitted changes, run the typecheck and lint.
// On failure, block the stop and hand the errors back so Claude fixes them.
// Costs nothing (no tokens, ~0s) when no TS changed and only ~6s when it did.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const web = path.join(root, "web");

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {}

const changed = execFileSync("git", ["status", "--porcelain", "--", "web"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .some((line) => /\.(ts|tsx|mts|cts)$/.test(line.trim()));
if (!changed) process.exit(0);

const bin = (name) => path.join(web, "node_modules", ...name);
const checks = [
  ["typecheck (tsc -b)", [bin(["typescript", "bin", "tsc"]), "-b", "--pretty", "false"]],
  // --deny-warnings: warnings (incl. jsx-a11y accessibility rules) must be fixed too.
  ["lint (oxlint)", [bin(["oxlint", "bin", "oxlint"]), "--deny-warnings"]],
];

const failures = [];
for (const [label, args] of checks) {
  try {
    execFileSync(process.execPath, args, { cwd: web, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    const out = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim();
    failures.push(`${label} failed:\n${out.slice(0, 4000)}`);
  }
}
if (failures.length === 0) process.exit(0);

const report = failures.join("\n\n");
if (input.stop_hook_active) {
  // Already blocked once this turn: don't loop, just tell the user.
  console.log(JSON.stringify({ systemMessage: `web checks still failing:\n${report}` }));
} else {
  console.log(JSON.stringify({ decision: "block", reason: `Fix these before finishing:\n${report}` }));
}
