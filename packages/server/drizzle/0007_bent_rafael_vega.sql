CREATE TABLE IF NOT EXISTS "case_context" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source_kind" text NOT NULL,
	"source_ref" text,
	"raw_payload_ref" text,
	"extracted_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_context_source_kind_chk" CHECK ("case_context"."source_kind" IN ('manual_paste', 'url_query', 'clipboard', 'webhook', 'embed')),
	CONSTRAINT "case_context_extracted_keys_type_chk" CHECK (jsonb_typeof("case_context"."extracted_keys") = 'array')
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "case_context" ADD CONSTRAINT "case_context_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "case_context" ADD CONSTRAINT "case_context_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "case_context_workspace_created_idx" ON "case_context" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "case_context_expires_idx" ON "case_context" USING btree ("expires_at") WHERE expires_at IS NOT NULL;--> statement-breakpoint
-- created_by must be NO ACTION DEFERRABLE INITIALLY IMMEDIATE: users are never
-- physically deleted (redact + deleted_at), so the FK blocks a raw DELETE
-- rather than orphaning a case context (§3.0 convention 3).
ALTER TABLE case_context DROP CONSTRAINT IF EXISTS case_context_created_by_user_id_fk;
--> statement-breakpoint
ALTER TABLE case_context
  ADD CONSTRAINT case_context_created_by_fk
  FOREIGN KEY (created_by) REFERENCES "user"(id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;