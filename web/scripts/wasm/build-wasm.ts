// Builds the Rust solver crate (../solver) to WASM for the site: `npm run wasm`.
// Output: src/game/wasm/ (generated, not committed). `npm run build` runs this first.
//
// Locally this needs Rust (rustup) and wasm-pack installed. On CI and Cloudflare Pages
// (whose build image has no Rust) it installs both first: rustup's minimal profile and the
// prebuilt wasm-pack binary, about a minute.
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const WASM_PACK_VERSION = '0.15.1'
const web = path.resolve(import.meta.dirname, '..', '..')
const solver = path.resolve(web, '..', 'solver')
const cargoBin = path.join(os.homedir(), '.cargo', 'bin')
// Rust installs into ~/.cargo/bin, which a fresh shell may not have on its PATH yet.
process.env.PATH = `${cargoBin}${path.delimiter}${process.env.PATH}`
const automated = Boolean(process.env.CI || process.env.CF_PAGES)
const release = !process.argv.includes('--dev')

function has(cmd: string): boolean {
  try {
    execFileSync(cmd, ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function run(cmd: string, args: string[], cwd = web): void {
  execFileSync(cmd, args, { cwd, stdio: 'inherit' })
}

function sh(script: string): void {
  execFileSync('sh', ['-c', script], { stdio: 'inherit' })
}

if (!has('cargo')) {
  if (!automated) {
    console.error(
      'Rust is not installed: see https://rustup.rs (on Windows: winget install Rustlang.Rustup).',
    )
    process.exit(1)
  }
  console.log('Installing Rust…')
  sh(
    "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --no-modify-path",
  )
}
if (has('rustup')) run('rustup', ['target', 'add', 'wasm32-unknown-unknown'])

if (!has('wasm-pack')) {
  if (!automated) {
    console.error('wasm-pack is not installed: run `cargo install wasm-pack`.')
    process.exit(1)
  }
  console.log(`Installing wasm-pack ${WASM_PACK_VERSION}…`)
  const name = `wasm-pack-v${WASM_PACK_VERSION}-x86_64-unknown-linux-musl`
  const url = `https://github.com/wasm-bindgen/wasm-pack/releases/download/v${WASM_PACK_VERSION}/${name}.tar.gz`
  mkdirSync(cargoBin, { recursive: true })
  sh(`curl -sSfL ${url} | tar -xz -C "${cargoBin}" --strip-components=1 ${name}/wasm-pack`)
}
if (!has('wasm-pack')) {
  console.error('wasm-pack install failed')
  process.exit(1)
}

// --out-dir is relative to the crate. --no-pack: no package.json, the site imports the files.
run(
  'wasm-pack',
  [
    'build',
    '--target',
    'web',
    release ? '--release' : '--dev',
    '--no-pack',
    '--out-dir',
    path.relative(solver, path.join(web, 'src', 'game', 'wasm')),
  ],
  solver,
)
