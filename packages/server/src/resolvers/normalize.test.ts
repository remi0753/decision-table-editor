import { describe, expect, it } from 'vitest';
import { normalizeFactValue } from './normalize.js';
import type { FactView } from './types.js';

const fact = (type: FactView['type'], enumValues?: string[]): FactView => ({
  id: 'f',
  type,
  enumValues: enumValues ?? null,
});

describe('normalizeFactValue', () => {
  it('treats empty values as unavailable', () => {
    const r = normalizeFactValue('  ', fact('string'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.state).toBe('unavailable');
  });

  it('trims strings', () => {
    expect(normalizeFactValue(' hi ', fact('string'))).toEqual({
      ok: true,
      value: 'hi',
    });
  });

  it('parses numbers and rejects junk', () => {
    expect(normalizeFactValue('1,234.5', fact('number'))).toEqual({
      ok: true,
      value: '1234.5',
    });
    const bad = normalizeFactValue('12x', fact('number'));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.state).toBe('invalid');
  });

  it('parses currency via normalizer kind', () => {
    expect(
      normalizeFactValue('$1,299.00', fact('number'), { kind: 'currency' }),
    ).toEqual({ ok: true, value: '1299' });
  });

  it('maps booleans', () => {
    expect(normalizeFactValue('YES', fact('bool'))).toEqual({
      ok: true,
      value: 'true',
    });
    expect(normalizeFactValue('0', fact('bool'))).toEqual({
      ok: true,
      value: 'false',
    });
    expect(normalizeFactValue('maybe', fact('bool')).ok).toBe(false);
  });

  it('resolves enums exact, case-insensitive, then mapping', () => {
    const f = fact('enum', ['Gold', 'Silver']);
    expect(normalizeFactValue('Gold', f)).toEqual({ ok: true, value: 'Gold' });
    expect(normalizeFactValue('gold', f)).toEqual({ ok: true, value: 'Gold' });
    expect(
      normalizeFactValue('G', f, { kind: 'enum', mapping: { G: 'Gold' } }),
    ).toEqual({ ok: true, value: 'Gold' });
    const bad = normalizeFactValue('Bronze', f);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.state).toBe('invalid');
  });

  it('normalizes dates and datetimes', () => {
    expect(normalizeFactValue('2026/05/28', fact('date'))).toEqual({
      ok: true,
      value: '2026-05-28',
    });
    const dt = normalizeFactValue('2026-05-28T10:00:00Z', fact('datetime'));
    expect(dt.ok).toBe(true);
    if (dt.ok) expect(dt.value).toBe('2026-05-28T10:00:00.000Z');
    expect(normalizeFactValue('not-a-date', fact('date')).ok).toBe(false);
  });
});
