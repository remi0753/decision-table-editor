import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv.js';

describe('parseCsv', () => {
  it('parses headers and rows, trimming unquoted cells', () => {
    const result = parseCsv('order_id, amount \n 123 , 45.5 \n456,10');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.headers).toEqual(['order_id', 'amount']);
    expect(result.data.rows).toEqual([
      { order_id: '123', amount: '45.5' },
      { order_id: '456', amount: '10' },
    ]);
  });

  it('preserves quoted cells verbatim and handles commas/newlines inside quotes', () => {
    const result = parseCsv('id,note\n1,"hello, world"\n2,"line1\nline2"');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rows[0]).toEqual({ id: '1', note: 'hello, world' });
    expect(result.data.rows[1]).toEqual({ id: '2', note: 'line1\nline2' });
  });

  it('handles escaped quotes and a leading BOM', () => {
    const result = parseCsv('﻿id,q\n1,"say ""hi"""');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.headers).toEqual(['id', 'q']);
    expect(result.data.rows[0]).toEqual({ id: '1', q: 'say "hi"' });
  });

  it('handles CRLF line endings', () => {
    const result = parseCsv('a,b\r\n1,2\r\n3,4');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rows).toHaveLength(2);
  });

  it('rejects duplicate headers after normalization', () => {
    const result = parseCsv('Order_ID,order_id\n1,2');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('duplicate_header');
  });

  it('rejects empty input', () => {
    expect(parseCsv('').ok).toBe(false);
  });
});
