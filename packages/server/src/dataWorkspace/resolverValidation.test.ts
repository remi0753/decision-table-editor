import { describe, expect, it } from 'vitest';
import {
  type ResolverFactView,
  type ResolverValidationContext,
  validateResolverRecipe,
} from './resolverValidation.js';

const facts = new Map<string, ResolverFactView>([
  ['fOrder', { kind: 'key', status: 'active' }],
  ['fDate', { kind: 'system_fact', status: 'active' }],
  ['fOld', { kind: 'system_fact', status: 'deprecated' }],
]);

const ctx: ResolverValidationContext = {
  facts,
  tableKeyColumns: ['order_id'],
  tableColumns: ['order_id', 'purchase_date'],
};

function validRecipe() {
  return {
    name: 'Resolve order facts',
    inputFactIds: ['fOrder'],
    operationRef: { kind: 'reference_table_lookup' },
    parameterMappings: {
      keyColumns: [{ columnName: 'order_id', factId: 'fOrder' }],
    },
    outputMappings: [{ columnName: 'purchase_date', factId: 'fDate' }],
  };
}

describe('validateResolverRecipe', () => {
  it('accepts a valid reference_table_lookup recipe', () => {
    const result = validateResolverRecipe(validRecipe(), ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.fallbackPolicy).toBe('ask_operator');
      expect(result.value.parameterMappings.keyColumns).toHaveLength(1);
    }
  });

  it('rejects unsupported operations', () => {
    const result = validateResolverRecipe(
      { ...validRecipe(), operationRef: { kind: 'http_get' } },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unsupported_operation');
  });

  it('requires at least one key fact in inputs', () => {
    const result = validateResolverRecipe(
      {
        ...validRecipe(),
        inputFactIds: ['fDate'],
        parameterMappings: {
          keyColumns: [{ columnName: 'order_id', factId: 'fDate' }],
        },
      },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('key_fact_required');
  });

  it('requires every table key column to be mapped', () => {
    const result = validateResolverRecipe(
      { ...validRecipe(), parameterMappings: { keyColumns: [] } },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('key_columns_required');
  });

  it('rejects output mappings to inactive facts and unknown columns', () => {
    const inactive = validateResolverRecipe(
      {
        ...validRecipe(),
        outputMappings: [{ columnName: 'purchase_date', factId: 'fOld' }],
      },
      ctx,
    );
    expect(inactive.ok).toBe(false);
    if (!inactive.ok) expect(inactive.error.code).toBe('unknown_output_fact');

    const unknownCol = validateResolverRecipe(
      {
        ...validRecipe(),
        outputMappings: [{ columnName: 'nope', factId: 'fDate' }],
      },
      ctx,
    );
    expect(unknownCol.ok).toBe(false);
    if (!unknownCol.ok)
      expect(unknownCol.error.code).toBe('unknown_output_column');
  });

  it('rejects invalid fallback policy', () => {
    const result = validateResolverRecipe(
      { ...validRecipe(), fallbackPolicy: 'escalate' },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_fallback_policy');
  });

  // Live sources need no table columns in the context (data is not copied in).
  const liveCtx: ResolverValidationContext = { facts };

  it('accepts a db_query recipe and normalizes its operation', () => {
    const result = validateResolverRecipe(
      {
        name: 'Resolve order facts (DB)',
        inputFactIds: ['fOrder'],
        operationRef: {
          kind: 'db_query',
          query: 'SELECT purchase_date FROM orders WHERE order_id = :order_id',
          params: [{ name: 'order_id', factId: 'fOrder' }],
        },
        outputMappings: [{ columnName: 'purchase_date', factId: 'fDate' }],
      },
      liveCtx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.operationRef.kind).toBe('db_query');
  });

  it('rejects a non-read-only db_query', () => {
    const result = validateResolverRecipe(
      {
        name: 'bad',
        inputFactIds: ['fOrder'],
        operationRef: {
          kind: 'db_query',
          query: 'UPDATE orders SET x = 1 WHERE order_id = :order_id',
          params: [{ name: 'order_id', factId: 'fOrder' }],
        },
        outputMappings: [{ columnName: 'purchase_date', factId: 'fDate' }],
      },
      liveCtx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unsafe_query');
  });

  it('accepts an http_operation recipe', () => {
    const result = validateResolverRecipe(
      {
        name: 'Resolve order facts (HTTP)',
        inputFactIds: ['fOrder'],
        operationRef: {
          kind: 'http_operation',
          method: 'GET',
          urlTemplate: 'https://api.shop.test/orders/{orderId}',
          params: [{ name: 'orderId', factId: 'fOrder' }],
          recordPath: 'order',
        },
        outputMappings: [{ columnName: 'created_at', factId: 'fDate' }],
      },
      liveCtx,
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value.operationRef.kind).toBe('http_operation');
  });

  it('rejects an http_operation with a non-http url', () => {
    const result = validateResolverRecipe(
      {
        name: 'bad',
        inputFactIds: ['fOrder'],
        operationRef: {
          kind: 'http_operation',
          urlTemplate: 'ftp://api.shop.test/{orderId}',
          params: [{ name: 'orderId', factId: 'fOrder' }],
        },
        outputMappings: [{ columnName: 'created_at', factId: 'fDate' }],
      },
      liveCtx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_url_template');
  });
});
