-- The (workspace_id, logic_id, id) UNIQUE on logic_version must exist before the
-- snapshot FK references it, so it is emitted first (drizzle-kit ordered the FK
-- ahead of the constraint).
ALTER TABLE "logic_version" ADD CONSTRAINT "logic_version_workspace_logic_id_uniq" UNIQUE("workspace_id","logic_id","id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "logic_version_data_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"logic_id" uuid NOT NULL,
	"logic_version_id" uuid NOT NULL,
	"bindings" jsonb NOT NULL,
	"fact_definitions" jsonb NOT NULL,
	"resolver_recipes" jsonb NOT NULL,
	"data_sources" jsonb NOT NULL,
	"reference_tables" jsonb NOT NULL,
	"snapshot_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lv_data_snapshot_logic_version_id_uniq" UNIQUE("logic_version_id"),
	CONSTRAINT "lv_data_snapshot_bindings_type_chk" CHECK (jsonb_typeof("logic_version_data_snapshot"."bindings") = 'array'),
	CONSTRAINT "lv_data_snapshot_fact_definitions_type_chk" CHECK (jsonb_typeof("logic_version_data_snapshot"."fact_definitions") = 'array'),
	CONSTRAINT "lv_data_snapshot_resolver_recipes_type_chk" CHECK (jsonb_typeof("logic_version_data_snapshot"."resolver_recipes") = 'array'),
	CONSTRAINT "lv_data_snapshot_data_sources_type_chk" CHECK (jsonb_typeof("logic_version_data_snapshot"."data_sources") = 'array'),
	CONSTRAINT "lv_data_snapshot_reference_tables_type_chk" CHECK (jsonb_typeof("logic_version_data_snapshot"."reference_tables") = 'array')
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "logic_version_data_snapshot" ADD CONSTRAINT "lv_data_snapshot_version_fk" FOREIGN KEY ("workspace_id","logic_id","logic_version_id") REFERENCES "public"."logic_version"("workspace_id","logic_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
