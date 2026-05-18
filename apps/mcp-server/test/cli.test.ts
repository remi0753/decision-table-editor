import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/args.js';

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

  it('parses `serve <file>`', () => {
    expect(parseArgs(['serve', './my-logic.json'])).toEqual({
      kind: 'serve',
      filePath: './my-logic.json',
      strict: false,
    });
  });

  it('parses `serve <file> --strict`', () => {
    expect(parseArgs(['serve', './x.json', '--strict'])).toEqual({
      kind: 'serve',
      filePath: './x.json',
      strict: true,
    });
  });

  it('accepts --strict before the file path', () => {
    expect(parseArgs(['serve', '--strict', './x.json'])).toEqual({
      kind: 'serve',
      filePath: './x.json',
      strict: true,
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

  it('errors when serve is missing a file path', () => {
    const r = parseArgs(['serve']);
    expect(r.kind).toBe('error');
    expect(r.message).toMatch(/requires a Logic JSON file path/);
  });

  it('errors on a second positional argument (multi-logic comes in P1.3)', () => {
    const r = parseArgs(['serve', './a.json', './b.json']);
    expect(r.kind).toBe('error');
    expect(r.message).toMatch(/Unexpected extra argument/);
  });
});
