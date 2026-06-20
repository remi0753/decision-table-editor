// Publish readiness checks for the data-connected layer (§7.6, §8.4). Pure and
// DB-free: the publish route gathers the data layer and calls this. A logic
// with no fact bindings is treated as not data-connected and passes trivially,
// preserving the existing (non-data-connected) publish behavior (§15).

import type { FieldDef } from '@leverie/engine';

export interface ReadinessFact {
  id: string;
  name: string;
  type: string;
  kind: string;
  status: string;
  enumValues: string[] | null;
  question: string | null;
  sensitive: boolean;
  loggingPolicy: string;
}

export interface ReadinessResolver {
  id: string;
  status: string;
  dataSourceId: string;
  inputFactIds: string[];
  outputFactIds: string[];
}

export interface ReadinessDataSource {
  id: string;
  status: string;
  kind?: string;
}

export interface ReadinessReferenceTable {
  dataSourceId: string;
  status: string;
  rowCount: number;
}

export interface ReadinessBinding {
  fieldId: string;
  factId: string;
}

export interface ReadinessInput {
  fieldDefs: Record<string, FieldDef>;
  bindings: ReadinessBinding[];
  facts: ReadinessFact[];
  resolvers: ReadinessResolver[];
  dataSources: ReadinessDataSource[];
  referenceTables: ReadinessReferenceTable[];
}

export interface ReadinessIssue {
  code: string;
  severity: 'block' | 'warn';
  message: string;
  fieldId?: string;
  factId?: string;
}

export interface ReadinessResult {
  ok: boolean;
  dataConnected: boolean;
  issues: ReadinessIssue[];
}

export function checkDataReadiness(input: ReadinessInput): ReadinessResult {
  const issues: ReadinessIssue[] = [];
  const dataConnected = input.bindings.length > 0;
  if (!dataConnected) return { ok: true, dataConnected: false, issues };

  const factById = new Map(input.facts.map((f) => [f.id, f]));
  const sourceById = new Map(input.dataSources.map((s) => [s.id, s]));
  const activeTableBySource = new Map<string, ReadinessReferenceTable>();
  for (const t of input.referenceTables) {
    if (t.status === 'active') activeTableBySource.set(t.dataSourceId, t);
  }
  const activeResolvers = input.resolvers.filter((r) => r.status === 'active');
  const boundFactIds = new Set(input.bindings.map((b) => b.factId));

  // Which facts can an active resolver produce?
  const resolversProducingFact = new Map<string, ReadinessResolver[]>();
  for (const r of activeResolvers) {
    for (const fid of r.outputFactIds) {
      const list = resolversProducingFact.get(fid) ?? [];
      list.push(r);
      resolversProducingFact.set(fid, list);
    }
  }

  for (const binding of input.bindings) {
    const fact = factById.get(binding.factId);
    if (!fact) {
      issues.push({
        code: 'unknown_fact',
        severity: 'block',
        message: `Field "${binding.fieldId}" is bound to a fact that no longer exists.`,
        fieldId: binding.fieldId,
        factId: binding.factId,
      });
      continue;
    }
    if (fact.status !== 'active') {
      issues.push({
        code: 'inactive_fact',
        severity: 'block',
        message: `Fact "${fact.name}" is ${fact.status} but is bound to field "${binding.fieldId}".`,
        fieldId: binding.fieldId,
        factId: fact.id,
      });
    }

    const field = input.fieldDefs[binding.fieldId];
    if (!field) {
      issues.push({
        code: 'unknown_field',
        severity: 'block',
        message: `Binding references field "${binding.fieldId}" which is not in the logic.`,
        fieldId: binding.fieldId,
        factId: fact.id,
      });
    } else {
      if (field.type !== fact.type) {
        issues.push({
          code: 'type_mismatch',
          severity: 'block',
          message: `Field "${binding.fieldId}" type (${field.type}) does not match fact "${fact.name}" type (${fact.type}).`,
          fieldId: binding.fieldId,
          factId: fact.id,
        });
      }
      if (field.type === 'enum') {
        const factEnum = new Set(fact.enumValues ?? []);
        for (const value of field.enumValues ?? []) {
          if (!factEnum.has(value)) {
            issues.push({
              code: 'enum_mismatch',
              severity: 'block',
              message: `Field "${binding.fieldId}" enum value "${value}" is not allowed by fact "${fact.name}".`,
              fieldId: binding.fieldId,
              factId: fact.id,
            });
          }
        }
      }
    }

    // Kind-specific value-source checks.
    if (fact.kind === 'manual_fact') {
      if (!fact.question?.trim()) {
        issues.push({
          code: 'missing_question',
          severity: 'block',
          message: `Manual fact "${fact.name}" needs an operator question.`,
          factId: fact.id,
        });
      }
    } else if (fact.kind === 'derived_fact') {
      issues.push({
        code: 'derived_unsupported',
        severity: 'block',
        message: `Derived fact "${fact.name}" has no computation engine in this release.`,
        factId: fact.id,
      });
    } else if (fact.kind === 'system_fact' || fact.kind === 'internal_fact') {
      if (!resolversProducingFact.has(fact.id)) {
        issues.push({
          code: 'no_resolver',
          severity: 'block',
          message: `${fact.kind === 'system_fact' ? 'System' : 'Internal'} fact "${fact.name}" has no active resolver.`,
          factId: fact.id,
        });
      }
    }

    if (fact.sensitive && fact.loggingPolicy === 'full') {
      issues.push({
        code: 'sensitive_full_logging',
        severity: 'warn',
        message: `Sensitive fact "${fact.name}" uses full logging.`,
        factId: fact.id,
      });
    }

    // Data-minimization (WP1): a sensitive fact resolved from a copied
    // reference table means PII is being uploaded into LEVERIE. Warn and steer
    // toward a live connector (database / HTTP) that reads at decision time.
    if (fact.sensitive) {
      const fromCopySource = (resolversProducingFact.get(fact.id) ?? []).some(
        (r) => sourceById.get(r.dataSourceId)?.kind === 'reference_table',
      );
      if (fromCopySource) {
        issues.push({
          code: 'sensitive_from_copy_source',
          severity: 'warn',
          message: `Sensitive fact "${fact.name}" is resolved from a copied reference table. Prefer a live database/HTTP connector so personal data is not stored in LEVERIE.`,
          factId: fact.id,
        });
      }
    }
  }

  // Validate only resolvers relevant to this logic (those producing a bound
  // fact): an unrelated workspace resolver must not block this publish.
  const relevantResolvers = activeResolvers.filter((r) =>
    r.outputFactIds.some((fid) => boundFactIds.has(fid)),
  );
  for (const resolver of relevantResolvers) {
    const source = sourceById.get(resolver.dataSourceId);
    if (!source || source.status !== 'active') {
      issues.push({
        code: 'resolver_source_inactive',
        severity: 'block',
        message: 'A resolver used by this logic has no active data source.',
      });
      continue;
    }
    const hasKey = resolver.inputFactIds.some((id) => {
      const f = factById.get(id);
      return f?.kind === 'key' && f.status === 'active';
    });
    if (!hasKey) {
      issues.push({
        code: 'resolver_no_key',
        severity: 'block',
        message:
          'A resolver used by this logic has no active key fact among its inputs.',
      });
    }
    // Reference-table sources must have a non-empty active version. Live
    // sources (database / http) have no copied data to validate at publish — the
    // data is read at decision time — so skip the table checks for them.
    const isReferenceTable =
      source.kind === undefined || source.kind === 'reference_table';
    if (isReferenceTable) {
      const table = activeTableBySource.get(resolver.dataSourceId);
      if (!table) {
        issues.push({
          code: 'resolver_no_active_table',
          severity: 'block',
          message:
            'A resolver used by this logic has no active reference table version.',
        });
      } else if (table.rowCount <= 0) {
        issues.push({
          code: 'empty_reference_table',
          severity: 'block',
          message: 'A reference table used by this logic has no rows.',
        });
      }
    }
  }

  const ok = !issues.some((i) => i.severity === 'block');
  return { ok, dataConnected: true, issues };
}
