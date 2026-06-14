// Value normalization for the resolver runtime (§6.3, §12.4). Pure and
// DB-free. Converts a raw source value into a canonical fact value string, or
// reports invalid / unavailable so the caller can apply the fallback policy.

import type { FactView, NormalizeResult, Normalizer } from './types.js';

function unavailable(message: string): NormalizeResult {
  return { ok: false, state: 'unavailable', message };
}
function invalid(message: string): NormalizeResult {
  return { ok: false, state: 'invalid', message };
}

// Empty value policy: blank / null / undefined means the source had no value.
function isEmpty(raw: unknown): boolean {
  return raw === null || raw === undefined || String(raw).trim() === '';
}

function normalizeNumber(raw: string, currency: boolean): NormalizeResult {
  // Strip thousands separators, currency symbols, and spaces.
  let cleaned = raw.trim().replace(/[\s,]/g, '');
  if (currency)
    cleaned = cleaned.replace(/^[^\d.+-]+/, '').replace(/[^\d.+-]/g, '');
  if (cleaned === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) {
    return invalid(`"${raw}" is not a valid number.`);
  }
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return invalid(`"${raw}" is not a valid number.`);
  return { ok: true, value: String(n) };
}

const TRUE_VALUES = new Set(['true', 't', 'yes', 'y', '1', 'on']);
const FALSE_VALUES = new Set(['false', 'f', 'no', 'n', '0', 'off']);

function normalizeBoolean(raw: string): NormalizeResult {
  const v = raw.trim().toLowerCase();
  if (TRUE_VALUES.has(v)) return { ok: true, value: 'true' };
  if (FALSE_VALUES.has(v)) return { ok: true, value: 'false' };
  return invalid(`"${raw}" is not a valid boolean.`);
}

// Enum resolution order (§6.3): exact match, then case-insensitive, then
// explicit mapping. Unknown becomes invalid (the caller may downgrade to
// needs_confirmation per fallback policy).
function normalizeEnum(
  raw: string,
  fact: FactView,
  normalizer?: Normalizer,
): NormalizeResult {
  const value = raw.trim();
  const allowed = fact.enumValues ?? [];
  if (allowed.includes(value)) return { ok: true, value };
  const lower = value.toLowerCase();
  const ci = allowed.find((a) => a.toLowerCase() === lower);
  if (ci) return { ok: true, value: ci };
  const mapped = normalizer?.mapping?.[value] ?? normalizer?.mapping?.[lower];
  if (mapped && allowed.includes(mapped)) return { ok: true, value: mapped };
  return invalid(`"${raw}" is not a valid value for this enum fact.`);
}

// Parse a date/datetime. Supports the common ISO and slash formats; the
// optional normalizer.format is advisory for display and is not a full parser
// in the MVP. Output is canonical: yyyy-mm-dd for date, ISO 8601 for datetime.
function normalizeDate(raw: string, withTime: boolean): NormalizeResult {
  const value = raw.trim();
  // yyyy-mm-dd or yyyy/mm/dd (optionally with time)
  const isoish = value.replace(/\//g, '-');
  const parsed = new Date(isoish);
  if (Number.isNaN(parsed.getTime())) {
    return invalid(
      `"${raw}" is not a valid ${withTime ? 'datetime' : 'date'}.`,
    );
  }
  if (withTime) return { ok: true, value: parsed.toISOString() };
  // date-only: keep the calendar date in UTC to avoid TZ drift.
  const yyyy = parsed.getUTCFullYear().toString().padStart(4, '0');
  const mm = (parsed.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = parsed.getUTCDate().toString().padStart(2, '0');
  return { ok: true, value: `${yyyy}-${mm}-${dd}` };
}

// Normalize a raw source value for the given fact. The normalizer.kind (when
// present) takes precedence over the fact type for the parse strategy, so a
// "currency" normalizer can feed a number fact.
export function normalizeFactValue(
  raw: unknown,
  fact: FactView,
  normalizer?: Normalizer,
): NormalizeResult {
  if (isEmpty(raw)) return unavailable('Source value is empty.');
  const value = String(raw);

  const kind = normalizer?.kind;
  if (kind === 'currency') return normalizeNumber(value, true);
  if (kind === 'number') return normalizeNumber(value, false);
  if (kind === 'boolean') return normalizeBoolean(value);
  if (kind === 'enum') return normalizeEnum(value, fact, normalizer);
  if (kind === 'date') return normalizeDate(value, false);
  if (kind === 'datetime') return normalizeDate(value, true);
  if (kind === 'string') return { ok: true, value: value.trim() };

  // No explicit normalizer kind: drive off the fact type.
  switch (fact.type) {
    case 'number':
      return normalizeNumber(value, false);
    case 'bool':
      return normalizeBoolean(value);
    case 'enum':
      return normalizeEnum(value, fact, normalizer);
    case 'date':
      return normalizeDate(value, false);
    case 'datetime':
      return normalizeDate(value, true);
    default:
      return { ok: true, value: value.trim() };
  }
}
