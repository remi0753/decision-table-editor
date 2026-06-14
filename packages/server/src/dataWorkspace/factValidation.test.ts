import type { FieldDef } from '@leverie/engine';
import { describe, expect, it } from 'vitest';
import {
  type BindingFactView,
  normalizeAlias,
  validateAliases,
  validateBindings,
  validateEnumValues,
  validateFactCreate,
} from './factValidation.js';

describe('normalizeAlias', () => {
  it('trims and case-folds', () => {
    expect(normalizeAlias('  Order ID ')).toBe('order id');
  });
});

describe('validateAliases', () => {
  it('returns empty list for null/undefined', () => {
    expect(validateAliases(undefined)).toEqual({ ok: true, aliases: [] });
    expect(validateAliases(null)).toEqual({ ok: true, aliases: [] });
  });

  it('drops blank entries and keeps trimmed originals', () => {
    const result = validateAliases(['  order_id ', '', '   ', 'PO#']);
    expect(result).toEqual({ ok: true, aliases: ['order_id', 'PO#'] });
  });

  it('rejects non-arrays', () => {
    const result = validateAliases('order_id');
    expect(result.ok).toBe(false);
  });

  it('rejects duplicates after normalization', () => {
    const result = validateAliases(['Order ID', 'order id']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('duplicate_alias');
  });

  it('rejects oversized lists', () => {
    const many = Array.from({ length: 51 }, (_, i) => `a${i}`);
    const result = validateAliases(many);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('too_many_aliases');
  });

  it('rejects oversized entries', () => {
    const result = validateAliases(['x'.repeat(121)]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('alias_too_long');
  });
});

describe('validateEnumValues', () => {
  it('requires non-empty values for enum facts', () => {
    expect(validateEnumValues('enum', []).ok).toBe(false);
    expect(validateEnumValues('enum', undefined).ok).toBe(false);
  });

  it('accepts and dedupes enum values', () => {
    const result = validateEnumValues('enum', ['Gold', 'Silver']);
    expect(result).toEqual({ ok: true, enumValues: ['Gold', 'Silver'] });
    expect(validateEnumValues('enum', ['Gold', 'Gold']).ok).toBe(false);
  });

  it('rejects enum values on non-enum facts but tolerates empty/null', () => {
    expect(validateEnumValues('string', ['x']).ok).toBe(false);
    expect(validateEnumValues('string', []).ok).toBe(true);
    expect(validateEnumValues('string', null).ok).toBe(true);
  });
});

describe('validateFactCreate', () => {
  it('requires a name', () => {
    const result = validateFactCreate({ type: 'string', kind: 'key' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_name');
  });

  it('rejects derived_fact in the MVP', () => {
    const result = validateFactCreate({
      name: 'X',
      type: 'string',
      kind: 'derived_fact',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('derived_fact_unsupported');
  });

  it('requires a question for active manual facts', () => {
    const result = validateFactCreate({
      name: 'Item opened',
      type: 'bool',
      kind: 'manual_fact',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('question_required');
  });

  it('accepts a manual fact with a question', () => {
    const result = validateFactCreate({
      name: 'Item opened',
      type: 'bool',
      kind: 'manual_fact',
      question: 'Was the item opened?',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.question).toBe('Was the item opened?');
  });

  it('defaults sensitive facts to masked logging', () => {
    const result = validateFactCreate({
      name: 'SSN',
      type: 'string',
      kind: 'key',
      sensitive: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.loggingPolicy).toBe('masked');
  });

  it('keeps an explicit logging policy on a sensitive fact', () => {
    const result = validateFactCreate({
      name: 'SSN',
      type: 'string',
      kind: 'key',
      sensitive: true,
      loggingPolicy: 'full',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.loggingPolicy).toBe('full');
  });

  it('validates type and kind', () => {
    expect(
      validateFactCreate({ name: 'X', type: 'money', kind: 'key' }).ok,
    ).toBe(false);
    expect(
      validateFactCreate({ name: 'X', type: 'string', kind: 'thing' }).ok,
    ).toBe(false);
  });
});

describe('validateBindings', () => {
  const fieldDefs: Record<string, FieldDef> = {
    f1: { id: 'f1', name: 'Order ID', type: 'string' },
    f2: { id: 'f2', name: 'Tier', type: 'enum', enumValues: ['Gold'] },
  };
  const facts: BindingFactView[] = [
    { id: 'fact1', type: 'string', status: 'active', enumValues: null },
    {
      id: 'fact2',
      type: 'enum',
      status: 'active',
      enumValues: ['Gold', 'Silver'],
    },
    { id: 'factDep', type: 'string', status: 'deprecated', enumValues: null },
    { id: 'factNum', type: 'number', status: 'active', enumValues: null },
  ];

  it('accepts valid bindings (enum fact is a superset)', () => {
    const result = validateBindings(fieldDefs, facts, [
      { fieldId: 'f1', factId: 'fact1' },
      { fieldId: 'f2', factId: 'fact2' },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.bindings).toHaveLength(2);
  });

  it('rejects unknown fields and facts', () => {
    expect(
      validateBindings(fieldDefs, facts, [{ fieldId: 'fX', factId: 'fact1' }])
        .ok,
    ).toBe(false);
    expect(
      validateBindings(fieldDefs, facts, [{ fieldId: 'f1', factId: 'nope' }])
        .ok,
    ).toBe(false);
  });

  it('rejects deprecated facts', () => {
    const result = validateBindings(fieldDefs, facts, [
      { fieldId: 'f1', factId: 'factDep' },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('deprecated_fact');
  });

  it('rejects type mismatch', () => {
    const result = validateBindings(fieldDefs, facts, [
      { fieldId: 'f1', factId: 'factNum' },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('type_mismatch');
  });

  it('rejects enum mismatch when the fact enum is not a superset', () => {
    const narrowFacts: BindingFactView[] = [
      { id: 'factE', type: 'enum', status: 'active', enumValues: ['Silver'] },
    ];
    const result = validateBindings(fieldDefs, narrowFacts, [
      { fieldId: 'f2', factId: 'factE' },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('enum_mismatch');
  });

  it('rejects duplicate field or fact bindings', () => {
    expect(
      validateBindings(fieldDefs, facts, [
        { fieldId: 'f1', factId: 'fact1' },
        { fieldId: 'f1', factId: 'factNum' },
      ]).ok,
    ).toBe(false);
    expect(
      validateBindings(fieldDefs, facts, [
        { fieldId: 'f1', factId: 'fact1' },
        { fieldId: 'f2', factId: 'fact1' },
      ]).ok,
    ).toBe(false);
  });
});
