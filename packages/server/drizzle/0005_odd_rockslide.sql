CREATE TABLE IF NOT EXISTS "data_source" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'reference_table' NOT NULL,
	"schema" jsonb NOT NULL,
	"schema_hash" text,
	"auth_type" text DEFAULT 'none' NOT NULL,
	"secret_ref" text,
	"allowed_domains" jsonb,
	"owner_user_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_actor_type" text NOT NULL,
	"created_actor_id" uuid,
	"updated_actor_type" text,
	"updated_actor_id" uuid,
	CONSTRAINT "data_source_workspace_id_id_uniq" UNIQUE("workspace_id","id"),
	CONSTRAINT "data_source_name_length_chk" CHECK (length("data_source"."name") <= 120),
	CONSTRAINT "data_source_kind_chk" CHECK ("data_source"."kind" IN ('reference_table', 'spreadsheet', 'managed_connector', 'openapi_http', 'graphql')),
	CONSTRAINT "data_source_auth_type_chk" CHECK ("data_source"."auth_type" IN ('none', 'api_key', 'bearer', 'basic', 'oauth')),
	CONSTRAINT "data_source_status_chk" CHECK ("data_source"."status" IN ('draft', 'active', 'disabled')),
	CONSTRAINT "data_source_schema_object_chk" CHECK (jsonb_typeof("data_source"."schema") = 'object'),
	CONSTRAINT "data_source_allowed_domains_type_chk" CHECK ("data_source"."allowed_domains" IS NULL OR jsonb_typeof("data_source"."allowed_domains") = 'array'),
	CONSTRAINT "data_source_created_actor_type_chk" CHECK ("data_source"."created_actor_type" IN ('user', 'system')),
	CONSTRAINT "data_source_updated_actor_type_chk" CHECK ("data_source"."updated_actor_type" IS NULL OR "data_source"."updated_actor_type" IN ('user', 'system')),
	CONSTRAINT "data_source_created_actor_consistency_chk" CHECK (("data_source"."created_actor_type" = 'user' AND "data_source"."created_actor_id" IS NOT NULL)
          OR ("data_source"."created_actor_type" = 'system' AND "data_source"."created_actor_id" IS NULL)),
	CONSTRAINT "data_source_updated_actor_consistency_chk" CHECK (("data_source"."updated_actor_type" IS NULL AND "data_source"."updated_actor_id" IS NULL)
          OR ("data_source"."updated_actor_type" = 'user' AND "data_source"."updated_actor_id" IS NOT NULL)
          OR ("data_source"."updated_actor_type" = 'system' AND "data_source"."updated_actor_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reference_table" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"data_source_id" uuid NOT NULL,
	"name" text NOT NULL,
	"columns" jsonb NOT NULL,
	"key_columns" jsonb NOT NULL,
	"row_count" integer NOT NULL,
	"storage_ref" text,
	"version" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_actor_type" text NOT NULL,
	"created_actor_id" uuid,
	CONSTRAINT "reference_table_source_version_uniq" UNIQUE("data_source_id","version"),
	CONSTRAINT "reference_table_workspace_id_id_uniq" UNIQUE("workspace_id","id"),
	CONSTRAINT "reference_table_name_length_chk" CHECK (length("reference_table"."name") <= 120),
	CONSTRAINT "reference_table_columns_type_chk" CHECK (jsonb_typeof("reference_table"."columns") = 'array'),
	CONSTRAINT "reference_table_key_columns_type_chk" CHECK (jsonb_typeof("reference_table"."key_columns") = 'array'),
	CONSTRAINT "reference_table_row_count_chk" CHECK ("reference_table"."row_count" >= 0),
	CONSTRAINT "reference_table_status_chk" CHECK ("reference_table"."status" IN ('active', 'superseded', 'disabled')),
	CONSTRAINT "reference_table_created_actor_type_chk" CHECK ("reference_table"."created_actor_type" IN ('user', 'system')),
	CONSTRAINT "reference_table_created_actor_consistency_chk" CHECK (("reference_table"."created_actor_type" = 'user' AND "reference_table"."created_actor_id" IS NOT NULL)
          OR ("reference_table"."created_actor_type" = 'system' AND "reference_table"."created_actor_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reference_table_row" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"reference_table_id" uuid NOT NULL,
	"row_index" integer NOT NULL,
	"key_hash" text NOT NULL,
	"key_values" jsonb NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resolver_recipe" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"input_fact_ids" jsonb NOT NULL,
	"data_source_id" uuid NOT NULL,
	"operation_ref" jsonb NOT NULL,
	"parameter_mappings" jsonb NOT NULL,
	"output_mappings" jsonb NOT NULL,
	"normalizers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fallback_policy" text DEFAULT 'ask_operator' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_actor_type" text NOT NULL,
	"created_actor_id" uuid,
	"updated_actor_type" text,
	"updated_actor_id" uuid,
	CONSTRAINT "resolver_recipe_workspace_id_id_uniq" UNIQUE("workspace_id","id"),
	CONSTRAINT "resolver_recipe_name_length_chk" CHECK (length("resolver_recipe"."name") <= 120),
	CONSTRAINT "resolver_recipe_input_fact_ids_type_chk" CHECK (jsonb_typeof("resolver_recipe"."input_fact_ids") = 'array'),
	CONSTRAINT "resolver_recipe_operation_ref_type_chk" CHECK (jsonb_typeof("resolver_recipe"."operation_ref") = 'object'),
	CONSTRAINT "resolver_recipe_parameter_mappings_type_chk" CHECK (jsonb_typeof("resolver_recipe"."parameter_mappings") = 'object'),
	CONSTRAINT "resolver_recipe_output_mappings_type_chk" CHECK (jsonb_typeof("resolver_recipe"."output_mappings") = 'array'),
	CONSTRAINT "resolver_recipe_normalizers_type_chk" CHECK (jsonb_typeof("resolver_recipe"."normalizers") = 'object'),
	CONSTRAINT "resolver_recipe_fallback_policy_chk" CHECK ("resolver_recipe"."fallback_policy" IN ('ask_operator', 'mark_unavailable', 'block')),
	CONSTRAINT "resolver_recipe_status_chk" CHECK ("resolver_recipe"."status" IN ('draft', 'active', 'disabled')),
	CONSTRAINT "resolver_recipe_created_actor_type_chk" CHECK ("resolver_recipe"."created_actor_type" IN ('user', 'system')),
	CONSTRAINT "resolver_recipe_updated_actor_type_chk" CHECK ("resolver_recipe"."updated_actor_type" IS NULL OR "resolver_recipe"."updated_actor_type" IN ('user', 'system')),
	CONSTRAINT "resolver_recipe_created_actor_consistency_chk" CHECK (("resolver_recipe"."created_actor_type" = 'user' AND "resolver_recipe"."created_actor_id" IS NOT NULL)
          OR ("resolver_recipe"."created_actor_type" = 'system' AND "resolver_recipe"."created_actor_id" IS NULL)),
	CONSTRAINT "resolver_recipe_updated_actor_consistency_chk" CHECK (("resolver_recipe"."updated_actor_type" IS NULL AND "resolver_recipe"."updated_actor_id" IS NULL)
          OR ("resolver_recipe"."updated_actor_type" = 'user' AND "resolver_recipe"."updated_actor_id" IS NOT NULL)
          OR ("resolver_recipe"."updated_actor_type" = 'system' AND "resolver_recipe"."updated_actor_id" IS NULL))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data_source" ADD CONSTRAINT "data_source_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data_source" ADD CONSTRAINT "data_source_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reference_table" ADD CONSTRAINT "reference_table_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reference_table" ADD CONSTRAINT "reference_table_workspace_source_fk" FOREIGN KEY ("workspace_id","data_source_id") REFERENCES "public"."data_source"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reference_table_row" ADD CONSTRAINT "reference_table_row_reference_table_id_reference_table_id_fk" FOREIGN KEY ("reference_table_id") REFERENCES "public"."reference_table"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resolver_recipe" ADD CONSTRAINT "resolver_recipe_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resolver_recipe" ADD CONSTRAINT "resolver_recipe_workspace_source_fk" FOREIGN KEY ("workspace_id","data_source_id") REFERENCES "public"."data_source"("workspace_id","id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_source_workspace_status_idx" ON "data_source" USING btree ("workspace_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reference_table_source_active_uniq" ON "reference_table" USING btree ("data_source_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reference_table_workspace_idx" ON "reference_table" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reference_table_row_index_uniq" ON "reference_table_row" USING btree ("reference_table_id","row_index");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reference_table_row_key_hash_uniq" ON "reference_table_row" USING btree ("reference_table_id","key_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resolver_recipe_workspace_status_idx" ON "resolver_recipe" USING btree ("workspace_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
-- Manual epilogue: set_updated_at triggers for the new tables that carry an
-- updated_at column (reference_table_row is immutable and has none), per
-- implementation_leverie_data_connected_workspace.md §3.0 convention 4.
CREATE TRIGGER set_updated_at_data_source
  BEFORE UPDATE ON data_source
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_reference_table
  BEFORE UPDATE ON reference_table
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_resolver_recipe
  BEFORE UPDATE ON resolver_recipe
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
-- data_source.owner_user_id must be NO ACTION DEFERRABLE INITIALLY IMMEDIATE:
-- users are never physically deleted (redact + deleted_at), so the FK blocks
-- a raw DELETE rather than orphaning the source (§3.0 convention 3).
ALTER TABLE data_source DROP CONSTRAINT IF EXISTS data_source_owner_user_id_user_id_fk;
--> statement-breakpoint
ALTER TABLE data_source
  ADD CONSTRAINT data_source_owner_user_id_fk
  FOREIGN KEY (owner_user_id) REFERENCES "user"(id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;