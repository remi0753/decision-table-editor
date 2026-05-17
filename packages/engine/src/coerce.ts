import type { FieldType } from './types/logic.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/;

function parseDate(s: string): Date | null {
  if (!DATE_PATTERN.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateTime(s: string): Date | null {
  if (!DATETIME_PATTERN.test(s)) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type CoercedValue = number | string | boolean | Date | null;

export function coerce(
  s: string | null | undefined,
  fieldType: FieldType,
): CoercedValue {
  if (s == null || s === '') return null;
  switch (fieldType) {
    case 'number': {
      const n = Number(s);
      return Number.isNaN(n) ? null : n;
    }
    case 'bool':
      return s === 'true' ? true : s === 'false' ? false : null;
    case 'date':
      return parseDate(s);
    case 'datetime':
      return parseDateTime(s);
    default:
      return s;
  }
}

export function cmp(v: CoercedValue): number | string | boolean | null {
  if (v instanceof Date) return v.getTime();
  return v;
}

export function today(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
