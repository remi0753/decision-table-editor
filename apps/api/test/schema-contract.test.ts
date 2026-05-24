import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = resolve(import.meta.dirname, '..');
const repoRoot = resolve(apiRoot, '../..');
const migrations = [
  'drizzle/0000_normal_pride.sql',
  'drizzle/0001_petite_toro.sql',
  'drizzle/0002_old_champions.sql',
]
  .map((path) => readFileSync(resolve(apiRoot, path), 'utf8'))
  .join('\n');
const schemaSource = readFileSync(resolve(apiRoot, 'src/db/schema.ts'), 'utf8');
const logicRoutesSource = readFileSync(
  resolve(apiRoot, 'src/routes/logics.ts'),
  'utf8',
);
const designSchema = readFileSync(
  resolve(repoRoot, 'doc/design_schema.md'),
  'utf8',
);

const productTables = [
  'user',
  'org',
  'workspace',
  'membership',
  'invitation',
  'logic',
  'logic_version',
  'api_key',
  'api_key_logic_scope',
  'execution_log',
  'audit_event',
  'org_deletion_job',
];

function expectSql(fragment: string) {
  expect(migrations).toContain(fragment);
}

describe('P3 schema contract', () => {
  it('covers every product table named by doc/design_schema.md', () => {
    for (const table of productTables) {
      expect(designSchema).toContain(`\`${table}\``);
      expectSql(`CREATE TABLE IF NOT EXISTS "${table}"`);
    }
  });

  it('installs required PostgreSQL extensions and UUID v7 defaults', () => {
    expectSql('CREATE EXTENSION IF NOT EXISTS citext;');
    expectSql('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    for (const table of productTables.filter(
      (table) => table !== 'api_key_logic_scope',
    )) {
      expect(migrations).toMatch(
        new RegExp(
          `CREATE TABLE IF NOT EXISTS "${table}"[\\s\\S]*"id" uuid PRIMARY KEY DEFAULT uuidv7\\(\\) NOT NULL`,
        ),
      );
    }
  });

  it('enforces tenant boundaries with composite uniqueness and composite foreign keys', () => {
    expectSql('CONSTRAINT "workspace_org_id_id_uniq" UNIQUE("org_id","id")');
    expectSql(
      'CONSTRAINT "logic_workspace_id_id_uniq" UNIQUE("workspace_id","id")',
    );
    expectSql(
      'CONSTRAINT "api_key_workspace_id_id_uniq" UNIQUE("workspace_id","id")',
    );
    expectSql(
      'CONSTRAINT "logic_version_logic_id_id_number_uniq" UNIQUE("logic_id","id","version_number")',
    );
    expectSql(
      'CONSTRAINT "logic_version_workspace_id_id_uniq" UNIQUE("workspace_id","id")',
    );

    expectSql(
      'FOREIGN KEY ("workspace_id","api_key_id") REFERENCES "public"."api_key"("workspace_id","id")',
    );
    expectSql(
      'FOREIGN KEY ("workspace_id","logic_id") REFERENCES "public"."logic"("workspace_id","id")',
    );
    expectSql(
      'ALTER TABLE "logic_version" ADD CONSTRAINT "logic_version_workspace_logic_fk" FOREIGN KEY ("workspace_id","logic_id") REFERENCES "public"."logic"("workspace_id","id")',
    );
    expectSql(
      'FOREIGN KEY ("org_id","workspace_id") REFERENCES "public"."workspace"("org_id","id")',
    );
    expectSql(
      'FOREIGN KEY (id, production_version_id)\n  REFERENCES logic_version (logic_id, id)',
    );
    expectSql(
      'FOREIGN KEY (workspace_id, production_version_id)\n  REFERENCES logic_version (workspace_id, id)',
    );
  });

  it('keeps partial uniqueness for active tenant slugs and active invitations/memberships', () => {
    expectSql(
      'CREATE UNIQUE INDEX IF NOT EXISTS "org_slug_not_purged_uniq" ON "org" USING btree ("slug") WHERE lifecycle_status IN (\'active\', \'deleting\', \'purging\')',
    );
    expectSql(
      'CREATE UNIQUE INDEX IF NOT EXISTS "workspace_org_slug_active_uniq" ON "workspace" USING btree ("org_id","slug") WHERE deleted_at IS NULL',
    );
    expectSql(
      'CREATE UNIQUE INDEX IF NOT EXISTS "logic_workspace_slug_active_uniq" ON "logic" USING btree ("workspace_id","slug") WHERE deleted_at IS NULL',
    );
    expectSql(
      'CREATE UNIQUE INDEX IF NOT EXISTS "membership_org_user_not_removed_uniq" ON "membership" USING btree ("org_id","user_id") WHERE removed_at IS NULL',
    );
    expectSql(
      'CREATE UNIQUE INDEX IF NOT EXISTS "invitation_org_email_open_uniq" ON "invitation" USING btree ("org_id","email") WHERE accepted_at IS NULL AND revoked_at IS NULL',
    );
  });

  it('keeps lifecycle, role, actor, and immutable-version checks at the database boundary', () => {
    for (const checkName of [
      'org_lifecycle_status_chk',
      'org_lifecycle_consistency_chk',
      'membership_role_chk',
      'invitation_terminal_state_chk',
      'invitation_accept_before_expiry_chk',
      'logic_draft_schema_version_matches_chk',
      'logic_version_version_number_positive_chk',
      'logic_version_schema_version_matches_chk',
      'api_key_lookup_digest_uniq',
      'execution_log_requested_version_chk',
      'execution_log_caller_chk',
      'audit_event_actor_consistency_chk',
      'org_deletion_job_status_chk',
      'user_name_length_chk',
      'org_name_length_chk',
      'workspace_description_length_chk',
      'logic_description_length_chk',
      'logic_version_release_notes_length_chk',
      'execution_log_error_message_length_chk',
      'org_deletion_job_last_error_length_chk',
    ]) {
      expectSql(checkName);
    }
  });

  it('keeps database-level updated_at triggers for tables that expose updated_at', () => {
    expectSql('CREATE OR REPLACE FUNCTION set_updated_at()');
    for (const table of ['user', 'org', 'workspace', 'logic']) {
      expectSql(`CREATE TRIGGER set_updated_at_${table}`);
      expectSql(`BEFORE UPDATE ON ${table === 'user' ? '"user"' : table}`);
    }
  });

  it('documents schema choices in Drizzle and keeps the migration in parity', () => {
    for (const symbol of [
      'export const user',
      'export const org',
      'export const workspace',
      'export const membership',
      'export const invitation',
      'export const logic',
      'export const logicVersion',
      'export const apiKey',
      'export const apiKeyLogicScope',
      'export const executionLog',
      'export const auditEvent',
      'export const orgDeletionJob',
    ]) {
      expect(schemaSource).toContain(symbol);
    }
  });
});

describe('Logic save path contract', () => {
  it('validates Logic JSON before create, draft save, and publish', () => {
    expect(logicRoutesSource).toContain(
      "import { validateLogicForSave } from '@leverie/engine';",
    );
    expect(
      logicRoutesSource.match(/validateLogicBody\(c, data\)/g),
    ).toHaveLength(1);
    expect(
      logicRoutesSource.match(/validateLogicBody\(c, draftData\)/g),
    ).toHaveLength(1);
    expect(
      logicRoutesSource.match(
        /validateLogicBody\(c, access\.logic\.draftData\)/g,
      ),
    ).toHaveLength(1);
  });

  it('keeps If-Match style optimistic locking on draft updates', () => {
    expect(logicRoutesSource).toContain(
      "parseBodyNumber(body, 'draftRevision')",
    );
    expect(logicRoutesSource).toContain('draft_revision_conflict');
    expect(logicRoutesSource).toContain('access.logic.draftRevision + 1');
  });
});
