-- Manual prelude: Drizzle Kit does not create PostgreSQL extensions from the
-- TypeScript schema. `citext` must exist before the user / invitation tables
-- are created, because both use CITEXT columns.
CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_key" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"lookup_secret_version" text DEFAULT 'v1' NOT NULL,
	"lookup_digest" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"role" text NOT NULL,
	"scope_mode" text DEFAULT 'all' NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_actor_type" text NOT NULL,
	"created_actor_id" uuid,
	CONSTRAINT "api_key_workspace_id_id_uniq" UNIQUE("workspace_id","id"),
	CONSTRAINT "api_key_role_chk" CHECK ("api_key"."role" IN ('editor', 'viewer', 'runner')),
	CONSTRAINT "api_key_scope_mode_chk" CHECK ("api_key"."scope_mode" IN ('all', 'allowlist')),
	CONSTRAINT "api_key_created_actor_type_chk" CHECK ("api_key"."created_actor_type" IN ('user', 'system')),
	CONSTRAINT "api_key_created_actor_consistency_chk" CHECK (("api_key"."created_actor_type" = 'user' AND "api_key"."created_actor_id" IS NOT NULL)
          OR ("api_key"."created_actor_type" = 'system' AND "api_key"."created_actor_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_key_logic_scope" (
	"workspace_id" uuid NOT NULL,
	"api_key_id" uuid NOT NULL,
	"logic_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_key_logic_scope_workspace_id_api_key_id_logic_id_pk" PRIMARY KEY("workspace_id","api_key_id","logic_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"workspace_id" uuid,
	"event_class" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_user_id" uuid,
	"actor_api_key_id" uuid,
	"actor_persona" text DEFAULT 'unknown' NOT NULL,
	"actor_channel" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_event_event_class_chk" CHECK ("audit_event"."event_class" IN ('security', 'product', 'system')),
	CONSTRAINT "audit_event_actor_type_chk" CHECK ("audit_event"."actor_type" IN ('user', 'api_key', 'system')),
	CONSTRAINT "audit_event_actor_persona_chk" CHECK ("audit_event"."actor_persona" IN ('installer', 'author', 'unknown')),
	CONSTRAINT "audit_event_actor_channel_chk" CHECK ("audit_event"."actor_channel" IN ('web', 'api_key', 'mcp', 'system')),
	CONSTRAINT "audit_event_actor_consistency_chk" CHECK (("audit_event"."actor_type" = 'user' AND "audit_event"."actor_user_id" IS NOT NULL AND "audit_event"."actor_api_key_id" IS NULL)
          OR ("audit_event"."actor_type" = 'api_key' AND "audit_event"."actor_user_id" IS NULL AND "audit_event"."actor_api_key_id" IS NOT NULL)
          OR ("audit_event"."actor_type" = 'system' AND "audit_event"."actor_user_id" IS NULL AND "audit_event"."actor_api_key_id" IS NULL)),
	CONSTRAINT "audit_event_api_key_actor_workspace_chk" CHECK ("audit_event"."actor_type" <> 'api_key' OR "audit_event"."workspace_id" IS NOT NULL),
	CONSTRAINT "audit_event_channel_consistency_chk" CHECK (("audit_event"."actor_type" = 'user' AND "audit_event"."actor_channel" IN ('web', 'mcp'))
          OR ("audit_event"."actor_type" = 'api_key' AND "audit_event"."actor_channel" IN ('api_key', 'mcp'))
          OR ("audit_event"."actor_type" = 'system' AND "audit_event"."actor_channel" = 'system'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "execution_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"logic_id" uuid NOT NULL,
	"logic_version_id" uuid,
	"requested_version_type" text NOT NULL,
	"requested_version_number" integer,
	"resolved_version_number" integer,
	"inputs" jsonb,
	"result" jsonb,
	"trace" jsonb,
	"status" text NOT NULL,
	"caller_actor_type" text NOT NULL,
	"caller_channel" text NOT NULL,
	"caller_user_id" uuid,
	"caller_api_key_id" uuid,
	"error_code" text,
	"request_id" text,
	"latency_ms" integer NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "execution_log_requested_version_type_chk" CHECK ("execution_log"."requested_version_type" IN ('draft', 'latest', 'production', 'version')),
	CONSTRAINT "execution_log_requested_version_number_positive_chk" CHECK ("execution_log"."requested_version_number" IS NULL OR "execution_log"."requested_version_number" > 0),
	CONSTRAINT "execution_log_resolved_version_number_positive_chk" CHECK ("execution_log"."resolved_version_number" IS NULL OR "execution_log"."resolved_version_number" > 0),
	CONSTRAINT "execution_log_status_chk" CHECK ("execution_log"."status" IN ('ok', 'no_match', 'error')),
	CONSTRAINT "execution_log_caller_actor_type_chk" CHECK ("execution_log"."caller_actor_type" IN ('user', 'api_key', 'system')),
	CONSTRAINT "execution_log_caller_channel_chk" CHECK ("execution_log"."caller_channel" IN ('web', 'api_key', 'mcp', 'system')),
	CONSTRAINT "execution_log_latency_ms_non_negative_chk" CHECK ("execution_log"."latency_ms" >= 0),
	CONSTRAINT "execution_log_status_payload_chk" CHECK (("execution_log"."status" IN ('ok', 'no_match')
            AND "execution_log"."inputs" IS NOT NULL
            AND "execution_log"."result" IS NOT NULL
            AND "execution_log"."trace" IS NOT NULL
            AND "execution_log"."error_message" IS NULL
            AND "execution_log"."error_code" IS NULL)
          OR ("execution_log"."status" = 'error'
            AND "execution_log"."result" IS NULL
            AND "execution_log"."trace" IS NULL
            AND "execution_log"."error_message" IS NOT NULL)),
	CONSTRAINT "execution_log_requested_version_chk" CHECK (("execution_log"."requested_version_type" = 'draft'
            AND "execution_log"."logic_version_id" IS NULL
            AND "execution_log"."requested_version_number" IS NULL
            AND "execution_log"."resolved_version_number" IS NULL)
          OR ("execution_log"."requested_version_type" IN ('latest', 'production')
            AND "execution_log"."logic_version_id" IS NOT NULL
            AND "execution_log"."requested_version_number" IS NULL
            AND "execution_log"."resolved_version_number" IS NOT NULL)
          OR ("execution_log"."requested_version_type" = 'version'
            AND "execution_log"."logic_version_id" IS NOT NULL
            AND "execution_log"."requested_version_number" IS NOT NULL
            AND "execution_log"."resolved_version_number" IS NOT NULL
            AND "execution_log"."requested_version_number" = "execution_log"."resolved_version_number")),
	CONSTRAINT "execution_log_caller_chk" CHECK (("execution_log"."caller_actor_type" = 'user'
            AND "execution_log"."caller_channel" = 'web'
            AND "execution_log"."caller_user_id" IS NOT NULL
            AND "execution_log"."caller_api_key_id" IS NULL)
          OR ("execution_log"."caller_actor_type" = 'api_key'
            AND "execution_log"."caller_channel" IN ('api_key', 'mcp')
            AND "execution_log"."caller_user_id" IS NULL
            AND "execution_log"."caller_api_key_id" IS NOT NULL)
          OR ("execution_log"."caller_actor_type" = 'system'
            AND "execution_log"."caller_channel" = 'system'
            AND "execution_log"."caller_user_id" IS NULL
            AND "execution_log"."caller_api_key_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitation" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" "citext" NOT NULL,
	"role" text NOT NULL,
	"token_digest" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"invited_actor_type" text NOT NULL,
	"invited_actor_id" uuid,
	"accepted_actor_type" text,
	"accepted_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_role_chk" CHECK ("invitation"."role" IN ('owner', 'admin', 'editor', 'viewer', 'runner')),
	CONSTRAINT "invitation_invited_actor_type_chk" CHECK ("invitation"."invited_actor_type" IN ('user', 'system')),
	CONSTRAINT "invitation_accepted_actor_type_chk" CHECK ("invitation"."accepted_actor_type" IS NULL OR "invitation"."accepted_actor_type" IN ('user', 'system')),
	CONSTRAINT "invitation_terminal_state_chk" CHECK ("invitation"."accepted_at" IS NULL OR "invitation"."revoked_at" IS NULL),
	CONSTRAINT "invitation_accept_before_expiry_chk" CHECK ("invitation"."accepted_at" IS NULL OR "invitation"."accepted_at" <= "invitation"."expires_at"),
	CONSTRAINT "invitation_accepted_pair_chk" CHECK (("invitation"."accepted_at" IS NULL
            AND "invitation"."accepted_actor_type" IS NULL
            AND "invitation"."accepted_actor_id" IS NULL)
          OR ("invitation"."accepted_at" IS NOT NULL
            AND "invitation"."accepted_actor_type" IS NOT NULL
            AND (
              ("invitation"."accepted_actor_type" = 'user' AND "invitation"."accepted_actor_id" IS NOT NULL)
              OR ("invitation"."accepted_actor_type" = 'system' AND "invitation"."accepted_actor_id" IS NULL)
            ))),
	CONSTRAINT "invitation_invited_actor_consistency_chk" CHECK (("invitation"."invited_actor_type" = 'user' AND "invitation"."invited_actor_id" IS NOT NULL)
          OR ("invitation"."invited_actor_type" = 'system' AND "invitation"."invited_actor_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "logic" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"draft_data" jsonb NOT NULL,
	"draft_schema_version" text DEFAULT '2' NOT NULL,
	"draft_revision" integer DEFAULT 0 NOT NULL,
	"production_version_id" uuid,
	"draft_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"draft_updated_actor_type" text NOT NULL,
	"draft_updated_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_actor_type" text NOT NULL,
	"created_actor_id" uuid,
	"updated_actor_type" text,
	"updated_actor_id" uuid,
	CONSTRAINT "logic_workspace_id_id_uniq" UNIQUE("workspace_id","id"),
	CONSTRAINT "logic_slug_format_chk" CHECK ("logic"."slug" ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
	CONSTRAINT "logic_draft_schema_version_matches_chk" CHECK (jsonb_typeof("logic"."draft_data"->'version') = 'string'
          AND "logic"."draft_schema_version" = "logic"."draft_data"->>'version'),
	CONSTRAINT "logic_created_actor_type_chk" CHECK ("logic"."created_actor_type" IN ('user', 'system')),
	CONSTRAINT "logic_updated_actor_type_chk" CHECK ("logic"."updated_actor_type" IS NULL OR "logic"."updated_actor_type" IN ('user', 'api_key', 'system')),
	CONSTRAINT "logic_draft_updated_actor_type_chk" CHECK ("logic"."draft_updated_actor_type" IN ('user', 'system')),
	CONSTRAINT "logic_created_actor_consistency_chk" CHECK (("logic"."created_actor_type" = 'user' AND "logic"."created_actor_id" IS NOT NULL)
          OR ("logic"."created_actor_type" = 'system' AND "logic"."created_actor_id" IS NULL)),
	CONSTRAINT "logic_updated_actor_consistency_chk" CHECK (("logic"."updated_actor_type" IS NULL AND "logic"."updated_actor_id" IS NULL)
          OR ("logic"."updated_actor_type" IN ('user', 'api_key') AND "logic"."updated_actor_id" IS NOT NULL)
          OR ("logic"."updated_actor_type" = 'system' AND "logic"."updated_actor_id" IS NULL)),
	CONSTRAINT "logic_draft_updated_actor_consistency_chk" CHECK (("logic"."draft_updated_actor_type" = 'user' AND "logic"."draft_updated_actor_id" IS NOT NULL)
          OR ("logic"."draft_updated_actor_type" = 'system' AND "logic"."draft_updated_actor_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "logic_version" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"logic_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"schema_version" text DEFAULT '2' NOT NULL,
	"data" jsonb NOT NULL,
	"release_notes" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_actor_type" text NOT NULL,
	"published_actor_id" uuid,
	CONSTRAINT "logic_version_logic_number_uniq" UNIQUE("logic_id","version_number"),
	CONSTRAINT "logic_version_logic_id_id_uniq" UNIQUE("logic_id","id"),
	CONSTRAINT "logic_version_logic_id_id_number_uniq" UNIQUE("logic_id","id","version_number"),
	CONSTRAINT "logic_version_version_number_positive_chk" CHECK ("logic_version"."version_number" > 0),
	CONSTRAINT "logic_version_schema_version_matches_chk" CHECK (jsonb_typeof("logic_version"."data"->'version') = 'string'
          AND "logic_version"."schema_version" = "logic_version"."data"->>'version'),
	CONSTRAINT "logic_version_published_actor_type_chk" CHECK ("logic_version"."published_actor_type" IN ('user', 'system')),
	CONSTRAINT "logic_version_published_actor_consistency_chk" CHECK (("logic_version"."published_actor_type" = 'user' AND "logic_version"."published_actor_id" IS NOT NULL)
          OR ("logic_version"."published_actor_type" = 'system' AND "logic_version"."published_actor_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "membership" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"invited_actor_type" text NOT NULL,
	"invited_actor_id" uuid,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "membership_role_chk" CHECK ("membership"."role" IN ('owner', 'admin', 'editor', 'viewer', 'runner')),
	CONSTRAINT "membership_invited_actor_type_chk" CHECK ("membership"."invited_actor_type" IN ('user', 'system')),
	CONSTRAINT "membership_invited_actor_consistency_chk" CHECK (("membership"."invited_actor_type" = 'user' AND "membership"."invited_actor_id" IS NOT NULL)
          OR ("membership"."invited_actor_type" = 'system' AND "membership"."invited_actor_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"lifecycle_status" text DEFAULT 'active' NOT NULL,
	"purge_requested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_actor_type" text NOT NULL,
	"created_actor_id" uuid,
	"updated_actor_type" text,
	"updated_actor_id" uuid,
	CONSTRAINT "org_slug_format_chk" CHECK ("org"."slug" ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
	CONSTRAINT "org_lifecycle_status_chk" CHECK ("org"."lifecycle_status" IN ('active', 'deleting', 'purging')),
	CONSTRAINT "org_lifecycle_consistency_chk" CHECK ((
        "org"."lifecycle_status" = 'active'
        AND "org"."deleted_at" IS NULL
        AND "org"."purge_requested_at" IS NULL
      ) OR (
        "org"."lifecycle_status" IN ('deleting', 'purging')
        AND "org"."deleted_at" IS NOT NULL
        AND "org"."purge_requested_at" IS NOT NULL
      )),
	CONSTRAINT "org_created_actor_type_chk" CHECK ("org"."created_actor_type" IN ('user', 'system')),
	CONSTRAINT "org_updated_actor_type_chk" CHECK ("org"."updated_actor_type" IS NULL OR "org"."updated_actor_type" IN ('user', 'system')),
	CONSTRAINT "org_created_actor_consistency_chk" CHECK (("org"."created_actor_type" = 'user' AND "org"."created_actor_id" IS NOT NULL)
          OR ("org"."created_actor_type" = 'system' AND "org"."created_actor_id" IS NULL)),
	CONSTRAINT "org_updated_actor_consistency_chk" CHECK (("org"."updated_actor_type" IS NULL AND "org"."updated_actor_id" IS NULL)
          OR ("org"."updated_actor_type" = 'user' AND "org"."updated_actor_id" IS NOT NULL)
          OR ("org"."updated_actor_type" = 'system' AND "org"."updated_actor_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org_deletion_job" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid,
	"org_slug_snapshot" text NOT NULL,
	"org_name_snapshot" text NOT NULL,
	"status" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requested_actor_type" text NOT NULL,
	"requested_actor_id" uuid,
	CONSTRAINT "org_deletion_job_status_chk" CHECK (("org_deletion_job"."status" = 'queued'
            AND "org_deletion_job"."started_at" IS NULL
            AND "org_deletion_job"."completed_at" IS NULL
            AND "org_deletion_job"."last_error" IS NULL)
          OR ("org_deletion_job"."status" = 'running'
            AND "org_deletion_job"."started_at" IS NOT NULL
            AND "org_deletion_job"."completed_at" IS NULL
            AND "org_deletion_job"."last_error" IS NULL)
          OR ("org_deletion_job"."status" = 'failed'
            AND "org_deletion_job"."started_at" IS NOT NULL
            AND "org_deletion_job"."completed_at" IS NULL
            AND "org_deletion_job"."last_error" IS NOT NULL)
          OR ("org_deletion_job"."status" = 'completed'
            AND "org_deletion_job"."started_at" IS NOT NULL
            AND "org_deletion_job"."completed_at" IS NOT NULL
            AND "org_deletion_job"."last_error" IS NULL)),
	CONSTRAINT "org_deletion_job_requested_actor_type_chk" CHECK ("org_deletion_job"."requested_actor_type" IN ('user', 'system')),
	CONSTRAINT "org_deletion_job_requested_actor_consistency_chk" CHECK (("org_deletion_job"."requested_actor_type" = 'user' AND "org_deletion_job"."requested_actor_id" IS NOT NULL)
          OR ("org_deletion_job"."requested_actor_type" = 'system' AND "org_deletion_job"."requested_actor_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" "citext" NOT NULL,
	"name" text NOT NULL,
	"image" text,
	"email_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspace" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_actor_type" text NOT NULL,
	"created_actor_id" uuid,
	"updated_actor_type" text,
	"updated_actor_id" uuid,
	CONSTRAINT "workspace_org_id_id_uniq" UNIQUE("org_id","id"),
	CONSTRAINT "workspace_slug_format_chk" CHECK ("workspace"."slug" ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
	CONSTRAINT "workspace_created_actor_type_chk" CHECK ("workspace"."created_actor_type" IN ('user', 'system')),
	CONSTRAINT "workspace_updated_actor_type_chk" CHECK ("workspace"."updated_actor_type" IS NULL OR "workspace"."updated_actor_type" IN ('user', 'system')),
	CONSTRAINT "workspace_created_actor_consistency_chk" CHECK (("workspace"."created_actor_type" = 'user' AND "workspace"."created_actor_id" IS NOT NULL)
          OR ("workspace"."created_actor_type" = 'system' AND "workspace"."created_actor_id" IS NULL)),
	CONSTRAINT "workspace_updated_actor_consistency_chk" CHECK (("workspace"."updated_actor_type" IS NULL AND "workspace"."updated_actor_id" IS NULL)
          OR ("workspace"."updated_actor_type" = 'user' AND "workspace"."updated_actor_id" IS NOT NULL)
          OR ("workspace"."updated_actor_type" = 'system' AND "workspace"."updated_actor_id" IS NULL))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_key" ADD CONSTRAINT "api_key_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_key_logic_scope" ADD CONSTRAINT "api_key_logic_scope_api_key_fk" FOREIGN KEY ("workspace_id","api_key_id") REFERENCES "public"."api_key"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_key_logic_scope" ADD CONSTRAINT "api_key_logic_scope_logic_fk" FOREIGN KEY ("workspace_id","logic_id") REFERENCES "public"."logic"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_org_workspace_fk" FOREIGN KEY ("org_id","workspace_id") REFERENCES "public"."workspace"("org_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_api_key_fk" FOREIGN KEY ("workspace_id","actor_api_key_id") REFERENCES "public"."api_key"("workspace_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "execution_log" ADD CONSTRAINT "execution_log_caller_user_id_user_id_fk" FOREIGN KEY ("caller_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "execution_log" ADD CONSTRAINT "execution_log_workspace_logic_fk" FOREIGN KEY ("workspace_id","logic_id") REFERENCES "public"."logic"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "execution_log" ADD CONSTRAINT "execution_log_version_tuple_fk" FOREIGN KEY ("logic_id","logic_version_id","resolved_version_number") REFERENCES "public"."logic_version"("logic_id","id","version_number") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "execution_log" ADD CONSTRAINT "execution_log_caller_api_key_fk" FOREIGN KEY ("workspace_id","caller_api_key_id") REFERENCES "public"."api_key"("workspace_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitation" ADD CONSTRAINT "invitation_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "logic" ADD CONSTRAINT "logic_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "logic_version" ADD CONSTRAINT "logic_version_logic_id_logic_id_fk" FOREIGN KEY ("logic_id") REFERENCES "public"."logic"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "membership" ADD CONSTRAINT "membership_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org_deletion_job" ADD CONSTRAINT "org_deletion_job_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace" ADD CONSTRAINT "workspace_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_key_lookup_digest_uniq" ON "api_key" USING btree ("lookup_secret_version","lookup_digest");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_key_workspace_not_revoked_idx" ON "api_key" USING btree ("workspace_id","created_at" DESC NULLS LAST) WHERE revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_key_logic_scope_workspace_logic_idx" ON "api_key_logic_scope" USING btree ("workspace_id","logic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_event_org_created_idx" ON "audit_event" USING btree ("org_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_event_workspace_created_idx" ON "audit_event" USING btree ("workspace_id","created_at" DESC NULLS LAST) WHERE workspace_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_event_target_idx" ON "audit_event" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_event_persona_action_created_idx" ON "audit_event" USING btree ("actor_persona","action","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_event_class_created_idx" ON "audit_event" USING btree ("event_class","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_event_channel_action_created_idx" ON "audit_event" USING btree ("actor_channel","action","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_log_logic_created_idx" ON "execution_log" USING btree ("logic_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_log_workspace_created_idx" ON "execution_log" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_log_created_at_idx" ON "execution_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_log_workspace_requested_type_created_idx" ON "execution_log" USING btree ("workspace_id","requested_version_type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_log_request_id_idx" ON "execution_log" USING btree ("request_id") WHERE request_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_log_error_code_created_idx" ON "execution_log" USING btree ("error_code","created_at" DESC NULLS LAST) WHERE error_code IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_log_workspace_channel_created_idx" ON "execution_log" USING btree ("workspace_id","caller_channel","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invitation_token_digest_uniq" ON "invitation" USING btree ("token_digest");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invitation_org_email_open_uniq" ON "invitation" USING btree ("org_id","email") WHERE accepted_at IS NULL AND revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitation_email_open_idx" ON "invitation" USING btree ("email") WHERE accepted_at IS NULL AND revoked_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "logic_workspace_slug_active_uniq" ON "logic" USING btree ("workspace_id","slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "logic_workspace_active_idx" ON "logic" USING btree ("workspace_id","draft_updated_at" DESC NULLS LAST) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "logic_version_logic_id_desc_idx" ON "logic_version" USING btree ("logic_id","version_number" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "membership_org_user_not_removed_uniq" ON "membership" USING btree ("org_id","user_id") WHERE removed_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "membership_user_not_removed_idx" ON "membership" USING btree ("user_id") WHERE removed_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_slug_not_purged_uniq" ON "org" USING btree ("slug") WHERE lifecycle_status IN ('active', 'deleting', 'purging');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_lifecycle_purge_queue_idx" ON "org" USING btree ("purge_requested_at") WHERE lifecycle_status IN ('deleting', 'purging');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_deletion_job_queued_idx" ON "org_deletion_job" USING btree ("requested_at") WHERE status = 'queued';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_deletion_job_failed_idx" ON "org_deletion_job" USING btree ("requested_at" DESC NULLS LAST) WHERE status = 'failed';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_deletion_job_org_id_idx" ON "org_deletion_job" USING btree ("org_id") WHERE org_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_deletion_job_completed_at_idx" ON "org_deletion_job" USING btree ("completed_at" DESC NULLS LAST) WHERE completed_at IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_uniq" ON "user" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_org_slug_active_uniq" ON "workspace" USING btree ("org_id","slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_org_id_active_idx" ON "workspace" USING btree ("org_id","created_at" DESC NULLS LAST) WHERE deleted_at IS NULL;
--> statement-breakpoint
-- Manual epilogue: DDL that is intentionally kept in this initial migration
-- so a fresh DB can be created by `drizzle-kit migrate` alone.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER set_updated_at_user
  BEFORE UPDATE ON "user"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_org
  BEFORE UPDATE ON org
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_workspace
  BEFORE UPDATE ON workspace
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_logic
  BEFORE UPDATE ON logic
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
-- DEFERRABLE INITIALLY IMMEDIATE foreign keys. Drizzle emits ordinary
-- NO ACTION FKs, so we replace the affected constraints with deferrable ones.
ALTER TABLE membership DROP CONSTRAINT IF EXISTS membership_user_id_user_id_fk;
--> statement-breakpoint
ALTER TABLE membership
  ADD CONSTRAINT membership_user_id_fk
  FOREIGN KEY (user_id) REFERENCES "user"(id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;
--> statement-breakpoint
ALTER TABLE logic
  ADD CONSTRAINT logic_production_version_same_logic_fk
  FOREIGN KEY (id, production_version_id)
  REFERENCES logic_version (logic_id, id)
  DEFERRABLE INITIALLY IMMEDIATE;
--> statement-breakpoint
ALTER TABLE execution_log DROP CONSTRAINT IF EXISTS execution_log_caller_user_id_user_id_fk;
--> statement-breakpoint
ALTER TABLE execution_log
  ADD CONSTRAINT execution_log_caller_user_id_fk
  FOREIGN KEY (caller_user_id) REFERENCES "user"(id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;
--> statement-breakpoint
ALTER TABLE execution_log DROP CONSTRAINT IF EXISTS execution_log_version_tuple_fk;
--> statement-breakpoint
ALTER TABLE execution_log
  ADD CONSTRAINT execution_log_version_tuple_fk
  FOREIGN KEY (logic_id, logic_version_id, resolved_version_number)
  REFERENCES logic_version (logic_id, id, version_number)
  ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;
--> statement-breakpoint
ALTER TABLE execution_log DROP CONSTRAINT IF EXISTS execution_log_caller_api_key_fk;
--> statement-breakpoint
ALTER TABLE execution_log
  ADD CONSTRAINT execution_log_caller_api_key_fk
  FOREIGN KEY (workspace_id, caller_api_key_id)
  REFERENCES api_key (workspace_id, id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;
--> statement-breakpoint
ALTER TABLE audit_event DROP CONSTRAINT IF EXISTS audit_event_actor_user_id_user_id_fk;
--> statement-breakpoint
ALTER TABLE audit_event
  ADD CONSTRAINT audit_event_actor_user_id_fk
  FOREIGN KEY (actor_user_id) REFERENCES "user"(id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;
--> statement-breakpoint
ALTER TABLE audit_event DROP CONSTRAINT IF EXISTS audit_event_actor_api_key_fk;
--> statement-breakpoint
ALTER TABLE audit_event
  ADD CONSTRAINT audit_event_actor_api_key_fk
  FOREIGN KEY (workspace_id, actor_api_key_id)
  REFERENCES api_key (workspace_id, id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;
