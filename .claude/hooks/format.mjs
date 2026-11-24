// PostToolUse hook (Edit|Write): format the edited file: Rust with rustfmt, web/ and
// data/*.json with the repo's Prettier. Silent on success; never blocks. Other files are
// skipped.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

let file;
try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  file = input.tool_input?.file_path ?? input.tool_response?.filePath;
} catch {
  process.exit(0);
}
if (!file) process.exit(0);
const abs = path.resolve(file);

// The repo root is the checkout holding the edited file (a worktree or the main folder), not
// the one this script lives in, so worktree edits are formatted with that worktree's Prettier.
let root;
try {
  root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: path.dirname(abs),
    encoding: "utf8",
  }).trim();
} catch {
  process.exit(0);
}
const rel = path.relative(root, abs);

if (rel.startsWith(`solver${path.sep}`) && abs.endsWith(".rs")) {
  // rustup installs into ~/.cargo/bin, which the hook's shell may not have on its PATH.
  const rustfmt = path.join(os.homedir(), ".cargo", "bin", process.platform === "win32" ? "rustfmt.exe" : "rustfmt");
  try {
    // Edition and options come from solver/Cargo.toml's edition and solver/rustfmt.toml.
    execFileSync(existsSync(rustfmt) ? rustfmt : "rustfmt", ["--edition", "2024", abs], {
      cwd: path.join(root, "solver"),
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch {
    // A syntax error: clippy in the Stop hook will report it.
  }
  process.exit(0);
}

const web = path.join(root, "web");
const prettier = path.join(web, "node_modules", "prettier", "bin", "prettier.cjs");
if (!existsSync(prettier)) process.exit(0);
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
