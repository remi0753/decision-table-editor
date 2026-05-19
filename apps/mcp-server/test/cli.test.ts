import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/args.js';

const TSX_BIN = fileURLToPath(
  new URL('../node_modules/.bin/tsx', import.meta.url),
);
const CLI_ENTRY = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const PACKAGE_JSON = fileURLToPath(new URL('../package.json', import.meta.url));

interface CliRun {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

function runCli(args: string[]): Promise<CliRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(TSX_BIN, [CLI_ENTRY, ...args], { stdio: 'pipe' });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (c: Buffer) => stdout.push(c));
    child.stderr.on('data', (c: Buffer) => stderr.push(c));
    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        exitCode,
      });
    });
  });
}

describe('parseArgs', () => {
  it('returns help when no arguments are given', () => {
    expect(parseArgs([])).toEqual({ kind: 'help' });
  });

  it('returns help on --help / -h', () => {
    expect(parseArgs(['--help'])).toEqual({ kind: 'help' });
    expect(parseArgs(['-h'])).toEqual({ kind: 'help' });
  });

  it('returns version on --version / -v', () => {
    expect(parseArgs(['--version'])).toEqual({ kind: 'version' });
    expect(parseArgs(['-v'])).toEqual({ kind: 'version' });
  });

  it('parses `serve <path>` for files', () => {
    expect(parseArgs(['serve', './my-logic.json'])).toEqual({
      kind: 'serve',
      path: './my-logic.json',
      strict: false,
      watch: false,
    });
  });

  it('parses `serve <path>` for directories', () => {
    expect(parseArgs(['serve', './logics/'])).toEqual({
      kind: 'serve',
      path: './logics/',
      strict: false,
      watch: false,
    });
  });

  it('parses --strict and --watch in any order', () => {
    expect(parseArgs(['serve', './x.json', '--strict', '--watch'])).toEqual({
      kind: 'serve',
      path: './x.json',
      strict: true,
      watch: true,
    });
    expect(parseArgs(['serve', '--watch', './x', '--strict'])).toEqual({
      kind: 'serve',
      path: './x',
      strict: true,
      watch: true,
    });
  });

  it('errors on unknown subcommand', () => {
    const r = parseArgs(['bogus']);
    expect(r.kind).toBe('error');
    expect(r.message).toMatch(/Unknown command/);
  });

  it('errors on unknown flag', () => {
    const r = parseArgs(['serve', './x.json', '--frobnicate']);
    expect(r.kind).toBe('error');
    expect(r.message).toMatch(/Unknown flag/);
  });

  it('errors when serve is missing a path', () => {
    const r = parseArgs(['serve']);
    expect(r.kind).toBe('error');
    expect(r.message).toMatch(/requires a path/);
  });

  it('errors on a second positional argument', () => {
    const r = parseArgs(['serve', './a.json', './b.json']);
    expect(r.kind).toBe('error');
    expect(r.message).toMatch(/Unexpected extra argument/);
  });
});

// The parseArgs tests above cover the pure-function side. These exercise the
// CLI entrypoint as a real child process so we catch the serialize layer too:
// help text actually reaching stdout, --version surfacing the real package
// version (not "0.0.0" from a hardcoded stub), and error paths returning a
// non-zero exit code so MCP clients fail fast on misconfiguration.
describe('cli entrypoint (child process)', () => {
  it('prints help text to stdout with exit code 0 on --help', async () => {
    const r = await runCli(['--help']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('leverie-mcp');
    expect(r.stdout).toContain('Usage:');
    expect(r.stderr).toBe('');
  }, 15_000);

  it('prints the package.json version to stdout on --version', async () => {
    const pkg = JSON.parse(await readFile(PACKAGE_JSON, 'utf8')) as {
      version: string;
    };
    const r = await runCli(['--version']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe(pkg.version);
  }, 15_000);

  it('exits with a non-zero code and writes the error to stderr on unknown command', async () => {
    const r = await runCli(['bogus']);
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr).toMatch(/Unknown command/);
  }, 15_000);
});
