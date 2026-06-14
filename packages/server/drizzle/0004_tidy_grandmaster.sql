CREATE TABLE IF NOT EXISTS "fact_definition" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"enum_values" jsonb,
	"kind" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"question" text,
	"sensitive" boolean DEFAULT false NOT NULL,
	"logging_policy" text DEFAULT 'full' NOT NULL,
	"retention_policy" text DEFAULT 'workspace_default' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_actor_type" text NOT NULL,
	"created_actor_id" uuid,
	"updated_actor_type" text,
	"updated_actor_id" uuid,
	CONSTRAINT "fact_definition_workspace_id_id_uniq" UNIQUE("workspace_id","id"),
	CONSTRAINT "fact_definition_name_length_chk" CHECK (length("fact_definition"."name") <= 120),
	CONSTRAINT "fact_definition_description_length_chk" CHECK ("fact_definition"."description" IS NULL OR length("fact_definition"."description") <= 1000),
	CONSTRAINT "fact_definition_type_chk" CHECK ("fact_definition"."type" IN ('string', 'number', 'bool', 'enum', 'date', 'datetime')),
	CONSTRAINT "fact_definition_kind_chk" CHECK ("fact_definition"."kind" IN ('key', 'system_fact', 'manual_fact', 'derived_fact', 'internal_fact')),
	CONSTRAINT "fact_definition_status_chk" CHECK ("fact_definition"."status" IN ('draft', 'active', 'deprecated')),
	CONSTRAINT "fact_definition_logging_policy_chk" CHECK ("fact_definition"."logging_policy" IN ('full', 'masked', 'hash', 'omit')),
	CONSTRAINT "fact_definition_enum_values_type_chk" CHECK ("fact_definition"."enum_values" IS NULL OR jsonb_typeof("fact_definition"."enum_values") = 'array'),
	CONSTRAINT "fact_definition_aliases_type_chk" CHECK (jsonb_typeof("fact_definition"."aliases") = 'array'),
	CONSTRAINT "fact_definition_enum_values_required_chk" CHECK ("fact_definition"."type" <> 'enum'
          OR ("fact_definition"."enum_values" IS NOT NULL AND jsonb_array_length("fact_definition"."enum_values") > 0)),
	CONSTRAINT "fact_definition_manual_question_chk" CHECK ("fact_definition"."kind" <> 'manual_fact'
          OR "fact_definition"."status" <> 'active'
          OR length(btrim(coalesce("fact_definition"."question", ''))) > 0),
	CONSTRAINT "fact_definition_created_actor_type_chk" CHECK ("fact_definition"."created_actor_type" IN ('user', 'system')),
	CONSTRAINT "fact_definition_updated_actor_type_chk" CHECK ("fact_definition"."updated_actor_type" IS NULL OR "fact_definition"."updated_actor_type" IN ('user', 'system')),
	CONSTRAINT "fact_definition_created_actor_consistency_chk" CHECK (("fact_definition"."created_actor_type" = 'user' AND "fact_definition"."created_actor_id" IS NOT NULL)
          OR ("fact_definition"."created_actor_type" = 'system' AND "fact_definition"."created_actor_id" IS NULL)),
	CONSTRAINT "fact_definition_updated_actor_consistency_chk" CHECK (("fact_definition"."updated_actor_type" IS NULL AND "fact_definition"."updated_actor_id" IS NULL)
          OR ("fact_definition"."updated_actor_type" = 'user' AND "fact_definition"."updated_actor_id" IS NOT NULL)
          OR ("fact_definition"."updated_actor_type" = 'system' AND "fact_definition"."updated_actor_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "logic_fact_binding" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"logic_id" uuid NOT NULL,
	"field_id" text NOT NULL,
	"fact_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "logic_fact_binding_logic_field_uniq" UNIQUE("logic_id","field_id"),
	CONSTRAINT "logic_fact_binding_logic_fact_uniq" UNIQUE("logic_id","fact_id"),
	CONSTRAINT "logic_fact_binding_field_id_length_chk" CHECK (length("logic_fact_binding"."field_id") <= 120)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fact_definition" ADD CONSTRAINT "fact_definition_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "logic_fact_binding" ADD CONSTRAINT "logic_fact_binding_workspace_logic_fk" FOREIGN KEY ("workspace_id","logic_id") REFERENCES "public"."logic"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "logic_fact_binding" ADD CONSTRAINT "logic_fact_binding_workspace_fact_fk" FOREIGN KEY ("workspace_id","fact_id") REFERENCES "public"."fact_definition"("workspace_id","id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fact_definition_workspace_name_active_uniq" ON "fact_definition" USING btree ("workspace_id",lower("name")) WHERE status <> 'deprecated';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fact_definition_workspace_status_created_idx" ON "fact_definition" USING btree ("workspace_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fact_definition_workspace_kind_status_idx" ON "fact_definition" USING btree ("workspace_id","kind","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "logic_fact_binding_logic_idx" ON "logic_fact_binding" USING btree ("logic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "logic_fact_binding_workspace_fact_idx" ON "logic_fact_binding" USING btree ("workspace_id","fact_id");--> statement-breakpoint
-- Manual epilogue: updated_at is stamped by the set_updated_at trigger (defined
-- in 0000) rather than by Drizzle $onUpdate, so raw SQL writes also stamp it.
-- Every new table with an updated_at column must be added to the trigger list
-- (implementation_leverie_data_connected_workspace.md §3.0 convention 4).
CREATE TRIGGER set_updated_at_fact_definition
  BEFORE UPDATE ON fact_definition
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_logic_fact_binding
  BEFORE UPDATE ON logic_fact_binding
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();