// Stop hook: when TypeScript in web/ has uncommitted changes, run the typecheck and lint;
// when Rust in solver/ does, run clippy (which also type-checks) with warnings as errors.
// On failure, block the stop and hand the errors back so Claude fixes them.
// Costs nothing (no tokens, ~0s) when nothing relevant changed, a few seconds when it did.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {}

// Check the checkout the session works in (its cwd), not the one this script lives in: a
// session that switched into a worktree still runs the main folder's copy of this hook, and
// checking the main folder would report another session's half-done files.
let root;
try {
  root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: input.cwd ?? process.cwd(),
    encoding: "utf8",
  }).trim();
} catch {
  root = path.resolve(import.meta.dirname, "..", "..");
}
const web = path.join(root, "web");
const solver = path.join(root, "solver");

// -uall lists each file in a new folder (plain status folds it into "?? web/src/odds/"), and
// -z with quotePath off prints paths raw, so non-ASCII names aren't quoted.
const changedIn = (dir, pattern) =>
  execFileSync("git", ["-c", "core.quotePath=false", "status", "--porcelain", "-uall", "-z", "--", dir], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .some((entry) => pattern.test(entry));

const checks = [];
if (changedIn("web", /\.(ts|tsx|mts|cts)$/)) {
  const bin = (name) => path.join(web, "node_modules", ...name);
  checks.push(
    ["typecheck (tsc -b)", process.execPath, [bin(["typescript", "bin", "tsc"]), "-b", "--pretty", "false"], web],
    // --deny-warnings: warnings (incl. jsx-a11y accessibility rules) must be fixed too.
    ["lint (oxlint)", process.execPath, [bin(["oxlint", "bin", "oxlint"]), "--deny-warnings"], web],
  );
}
if (existsSync(solver) && changedIn("solver", /(\.rs|Cargo\.toml)$/)) {
  // rustup installs into ~/.cargo/bin, which the hook's shell may not have on its PATH.
  const cargo = path.join(os.homedir(), ".cargo", "bin", process.platform === "win32" ? "cargo.exe" : "cargo");
  checks.push([
    "clippy (cargo clippy --all-targets)",
    existsSync(cargo) ? cargo : "cargo",
    ["clippy", "--all-targets", "--quiet", "--color", "never", "--", "-D", "warnings"],
    solver,
  ]);
}
if (checks.length === 0) process.exit(0);

const failures = [];
for (const [label, cmd, args, cwd] of checks) {
  try {
    execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    const out = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim();
    failures.push(`${label} failed:\n${out.slice(0, 4000)}`);
  }
}
if (failures.length === 0) process.exit(0);

const report = failures.join("\n\n");
if (input.stop_hook_active) {
  // Already blocked once this turn: don't loop, just tell the user.
  console.log(JSON.stringify({ systemMessage: `checks still failing:\n${report}` }));
} else {
  console.log(JSON.stringify({ decision: "block", reason: `Fix these before finishing:\n${report}` }));
}
