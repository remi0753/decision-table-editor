import type { FieldDef } from '@leverie/engine';
import { describe, expect, it } from 'vitest';
import {
  checkDataReadiness,
  type ReadinessFact,
  type ReadinessInput,
} from './dataReadiness.js';

const fieldDefs: Record<string, FieldDef> = {
  f_order: { id: 'f_order', name: 'Order ID', type: 'string' },
  f_date: { id: 'f_date', name: 'Purchase date', type: 'date' },
  f_item: { id: 'f_item', name: 'Item opened', type: 'bool' },
};

const fact = (
  over: Partial<ReadinessFact> & { id: string },
): ReadinessFact => ({
  name: over.id,
  type: 'string',
  kind: 'system_fact',
  status: 'active',
  enumValues: null,
  question: null,
  sensitive: false,
  loggingPolicy: 'full',
  ...over,
});

function fullSetup(): ReadinessInput {
  return {
    fieldDefs,
    bindings: [
      { fieldId: 'f_order', factId: 'order' },
      { fieldId: 'f_date', factId: 'date' },
      { fieldId: 'f_item', factId: 'item' },
    ],
    facts: [
      fact({ id: 'order', kind: 'key', type: 'string' }),
      fact({ id: 'date', kind: 'system_fact', type: 'date' }),
      fact({
        id: 'item',
        kind: 'manual_fact',
        type: 'bool',
        question: 'Opened?',
      }),
    ],
    resolvers: [
      {
        id: 'r1',
        status: 'active',
        dataSourceId: 's1',
        inputFactIds: ['order'],
        outputFactIds: ['date'],
      },
    ],
    dataSources: [{ id: 's1', status: 'active' }],
    referenceTables: [{ dataSourceId: 's1', status: 'active', rowCount: 10 }],
  };
}

describe('checkDataReadiness', () => {
  it('passes a fully valid data-connected setup', () => {
    const r = checkDataReadiness(fullSetup());
    expect(r.dataConnected).toBe(true);
    expect(r.ok).toBe(true);
    expect(r.issues.filter((i) => i.severity === 'block')).toHaveLength(0);
  });

  it('treats a logic with no bindings as not data-connected', () => {
    const r = checkDataReadiness({ ...fullSetup(), bindings: [] });
    expect(r).toEqual({ ok: true, dataConnected: false, issues: [] });
  });

  it('blocks a system fact with no resolver', () => {
    const input = fullSetup();
    input.resolvers = [];
    const r = checkDataReadiness(input);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'no_resolver')).toBe(true);
  });

  it('blocks type and enum mismatches', () => {
    const input = fullSetup();
    input.facts = input.facts.map((f) =>
      f.id === 'date' ? { ...f, type: 'number' } : f,
    );
    const r = checkDataReadiness(input);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'type_mismatch')).toBe(true);
  });

  it('blocks a manual fact without a question', () => {
    const input = fullSetup();
    input.facts = input.facts.map((f) =>
      f.id === 'item' ? { ...f, question: '  ' } : f,
    );
    const r = checkDataReadiness(input);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'missing_question')).toBe(true);
  });

  it('blocks deprecated bound facts and derived facts', () => {
    const dep = fullSetup();
    dep.facts = dep.facts.map((f) =>
      f.id === 'date' ? { ...f, status: 'deprecated' } : f,
    );
    expect(
      checkDataReadiness(dep).issues.some((i) => i.code === 'inactive_fact'),
    ).toBe(true);

    const derived = fullSetup();
    derived.facts = derived.facts.map((f) =>
      f.id === 'date' ? { ...f, kind: 'derived_fact' } : f,
    );
    expect(
      checkDataReadiness(derived).issues.some(
        (i) => i.code === 'derived_unsupported',
      ),
    ).toBe(true);
  });

  it('blocks empty reference tables and inactive resolver sources', () => {
    const empty = fullSetup();
    empty.referenceTables = [
      { dataSourceId: 's1', status: 'active', rowCount: 0 },
    ];
    expect(
      checkDataReadiness(empty).issues.some(
        (i) => i.code === 'empty_reference_table',
      ),
    ).toBe(true);

    const inactive = fullSetup();
    inactive.dataSources = [{ id: 's1', status: 'disabled' }];
    expect(
      checkDataReadiness(inactive).issues.some(
        (i) => i.code === 'resolver_source_inactive',
      ),
    ).toBe(true);
  });

  it('warns but does not block on sensitive full logging', () => {
    const input = fullSetup();
    input.facts = input.facts.map((f) =>
      f.id === 'date' ? { ...f, sensitive: true, loggingPolicy: 'full' } : f,
    );
    const r = checkDataReadiness(input);
    expect(r.ok).toBe(true);
    expect(
      r.issues.some(
        (i) => i.code === 'sensitive_full_logging' && i.severity === 'warn',
      ),
    ).toBe(true);
  });

  it('warns when a sensitive fact is resolved from a copied reference table', () => {
    const input = fullSetup();
    input.dataSources = [
      { id: 's1', status: 'active', kind: 'reference_table' },
    ];
    input.facts = input.facts.map((f) =>
      f.id === 'date' ? { ...f, sensitive: true, loggingPolicy: 'masked' } : f,
    );
    const r = checkDataReadiness(input);
    expect(r.ok).toBe(true);
    expect(
      r.issues.some(
        (i) => i.code === 'sensitive_from_copy_source' && i.severity === 'warn',
      ),
    ).toBe(true);
  });

  it('does not require a reference table for a live (database) source', () => {
    const input = fullSetup();
    input.dataSources = [{ id: 's1', status: 'active', kind: 'database' }];
    input.referenceTables = [];
    const r = checkDataReadiness(input);
    expect(r.ok).toBe(true);
    expect(r.issues.some((i) => i.code === 'resolver_no_active_table')).toBe(
      false,
    );
  });
});
