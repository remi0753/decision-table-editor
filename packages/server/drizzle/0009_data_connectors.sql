CREATE TABLE IF NOT EXISTS "connector_secret" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"auth_type" text NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_actor_type" text NOT NULL,
	"created_actor_id" uuid,
	"updated_actor_type" text,
	"updated_actor_id" uuid,
	CONSTRAINT "connector_secret_auth_type_chk" CHECK ("connector_secret"."auth_type" IN ('api_key', 'bearer', 'basic', 'oauth', 'database_url')),
	CONSTRAINT "connector_secret_created_actor_consistency_chk" CHECK (("connector_secret"."created_actor_type" = 'user' AND "connector_secret"."created_actor_id" IS NOT NULL)
          OR ("connector_secret"."created_actor_type" = 'system' AND "connector_secret"."created_actor_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "data_source" DROP CONSTRAINT "data_source_kind_chk";--> statement-breakpoint
ALTER TABLE "resolver_recipe" ADD COLUMN "timeout_policy" jsonb;--> statement-breakpoint
ALTER TABLE "resolver_recipe" ADD COLUMN "cache_policy" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "connector_secret" ADD CONSTRAINT "connector_secret_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connector_secret_workspace_idx" ON "connector_secret" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "data_source" ADD CONSTRAINT "data_source_kind_chk" CHECK ("data_source"."kind" IN ('reference_table', 'spreadsheet', 'managed_connector', 'openapi_http', 'graphql', 'database'));--> statement-breakpoint
-- Manual epilogue: set_updated_at trigger for the new table with updated_at
-- (§3.0 convention 4). connector_secret is the only added table with updated_at.
CREATE TRIGGER set_updated_at_connector_secret
  BEFORE UPDATE ON "connector_secret"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
