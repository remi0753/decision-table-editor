import { describe, expect, it } from 'vitest';
import {
  applyLoggingPolicy,
  maskString,
  resolveStoredValue,
} from './masking.js';

describe('maskString', () => {
  it('keeps the last 4 chars when longer than 8', () => {
    expect(maskString('4111111111119876')).toBe('••••9876');
  });
  it('uses a fixed dot run for short strings', () => {
    expect(maskString('1234')).toBe('••••');
    expect(maskString('12345678')).toBe('••••');
  });
});

describe('applyLoggingPolicy', () => {
  it('stores the raw value for full', async () => {
    expect(await applyLoggingPolicy('Gold', 'full')).toEqual({
      value: 'Gold',
      maskedValue: null,
    });
  });

  it('stores only a masked rendering for masked', async () => {
    expect(await applyLoggingPolicy('sensitive-1234567', 'masked')).toEqual({
      value: null,
      maskedValue: '••••4567',
    });
  });

  it('stores a keyed hash for hash and never the raw value', async () => {
    const r = await applyLoggingPolicy('secret', 'hash', 'ws1');
    expect(r.value).toBeNull();
    expect(r.maskedValue).toMatch(/^sha256:[0-9a-f]{64}$/);
    // Same key + value is deterministic; a different key changes the hash.
    const same = await applyLoggingPolicy('secret', 'hash', 'ws1');
    const other = await applyLoggingPolicy('secret', 'hash', 'ws2');
    expect(r.maskedValue).toBe(same.maskedValue);
    expect(r.maskedValue).not.toBe(other.maskedValue);
  });

  it('stores neither value nor masked for omit', async () => {
    expect(await applyLoggingPolicy('secret', 'omit')).toEqual({
      value: null,
      maskedValue: null,
    });
  });
});

describe('resolveStoredValue', () => {
  it('persists nothing when retention is no_store, ignoring logging policy', async () => {
    expect(
      await resolveStoredValue('Gold', {
        loggingPolicy: 'full',
        retentionPolicy: 'no_store',
      }),
    ).toEqual({ value: null, maskedValue: null });
  });

  it('falls back to the logging policy when retention allows storage', async () => {
    expect(
      await resolveStoredValue('Gold', {
        loggingPolicy: 'full',
        retentionPolicy: 'workspace_default',
      }),
    ).toEqual({ value: 'Gold', maskedValue: null });
  });
});
