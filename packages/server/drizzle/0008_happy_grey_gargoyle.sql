CREATE TABLE IF NOT EXISTS "decision_fact_value" (
	"decision_session_id" uuid NOT NULL,
	"fact_id" uuid NOT NULL,
	"field_id" text,
	"value" text,
	"masked_value" text,
	"state" text NOT NULL,
	"source_kind" text NOT NULL,
	"data_source_id" uuid,
	"resolver_recipe_id" uuid,
	"reference_table_id" uuid,
	"reference_table_version" integer,
	"provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confirmed_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decision_fact_value_decision_session_id_fact_id_pk" PRIMARY KEY("decision_session_id","fact_id"),
	CONSTRAINT "decision_fact_value_state_chk" CHECK ("decision_fact_value"."state" IN ('missing', 'resolved', 'needs_confirmation', 'confirmed', 'manual', 'unavailable', 'invalid', 'hidden')),
	CONSTRAINT "decision_fact_value_source_kind_chk" CHECK ("decision_fact_value"."source_kind" IN ('manual', 'url_query', 'clipboard', 'reference_table', 'api', 'derived', 'embed', 'internal')),
	CONSTRAINT "decision_fact_value_provenance_type_chk" CHECK (jsonb_typeof("decision_fact_value"."provenance") = 'object')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decision_report" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"logic_id" uuid NOT NULL,
	"logic_version_id" uuid,
	"decision_session_id" uuid,
	"kind" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	CONSTRAINT "decision_report_kind_chk" CHECK ("decision_report"."kind" IN ('no_match', 'wrong_fact', 'missing_source', 'confusing_question', 'wrong_result_text', 'exception_required')),
	CONSTRAINT "decision_report_status_chk" CHECK ("decision_report"."status" IN ('open', 'reviewing', 'resolved', 'dismissed')),
	CONSTRAINT "decision_report_note_length_chk" CHECK ("decision_report"."note" IS NULL OR length("decision_report"."note") <= 2000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decision_session" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"logic_id" uuid NOT NULL,
	"logic_version_id" uuid NOT NULL,
	"data_snapshot_id" uuid NOT NULL,
	"case_context_id" uuid,
	"status" text NOT NULL,
	"result" jsonb,
	"trace" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "decision_session_status_chk" CHECK ("decision_session"."status" IN ('started', 'needs_input', 'decision_ready', 'no_match', 'error', 'abandoned')),
	CONSTRAINT "decision_session_result_payload_chk" CHECK ("decision_session"."result" IS NULL OR "decision_session"."status" IN ('decision_ready', 'no_match', 'error'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_fact_value" ADD CONSTRAINT "decision_fact_value_decision_session_id_decision_session_id_fk" FOREIGN KEY ("decision_session_id") REFERENCES "public"."decision_session"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_fact_value" ADD CONSTRAINT "decision_fact_value_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_report" ADD CONSTRAINT "decision_report_decision_session_id_decision_session_id_fk" FOREIGN KEY ("decision_session_id") REFERENCES "public"."decision_session"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_report" ADD CONSTRAINT "decision_report_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_report" ADD CONSTRAINT "decision_report_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_report" ADD CONSTRAINT "decision_report_workspace_logic_fk" FOREIGN KEY ("workspace_id","logic_id") REFERENCES "public"."logic"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_report" ADD CONSTRAINT "decision_report_version_fk" FOREIGN KEY ("workspace_id","logic_id","logic_version_id") REFERENCES "public"."logic_version"("workspace_id","logic_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_session" ADD CONSTRAINT "decision_session_data_snapshot_id_logic_version_data_snapshot_id_fk" FOREIGN KEY ("data_snapshot_id") REFERENCES "public"."logic_version_data_snapshot"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_session" ADD CONSTRAINT "decision_session_case_context_id_case_context_id_fk" FOREIGN KEY ("case_context_id") REFERENCES "public"."case_context"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_session" ADD CONSTRAINT "decision_session_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_session" ADD CONSTRAINT "decision_session_workspace_logic_fk" FOREIGN KEY ("workspace_id","logic_id") REFERENCES "public"."logic"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_session" ADD CONSTRAINT "decision_session_version_fk" FOREIGN KEY ("workspace_id","logic_id","logic_version_id") REFERENCES "public"."logic_version"("workspace_id","logic_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_report_workspace_status_created_idx" ON "decision_report" USING btree ("workspace_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_report_logic_created_idx" ON "decision_report" USING btree ("logic_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_session_workspace_created_idx" ON "decision_session" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_session_logic_created_idx" ON "decision_session" USING btree ("logic_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_session_created_by_idx" ON "decision_session" USING btree ("created_by","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_session_workspace_status_created_idx" ON "decision_session" USING btree ("workspace_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
-- Manual epilogue: set_updated_at triggers for the new tables with updated_at
-- (decision_report has none), per §3.0 convention 4.
CREATE TRIGGER set_updated_at_decision_session
  BEFORE UPDATE ON decision_session
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_decision_fact_value
  BEFORE UPDATE ON decision_fact_value
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
-- User FKs are NO ACTION DEFERRABLE INITIALLY IMMEDIATE: users are never
-- physically deleted (redact + deleted_at), so these block a raw DELETE rather
-- than orphaning audit rows (§3.0 convention 3).
ALTER TABLE decision_session DROP CONSTRAINT IF EXISTS decision_session_created_by_user_id_fk;
--> statement-breakpoint
ALTER TABLE decision_session
  ADD CONSTRAINT decision_session_created_by_fk
  FOREIGN KEY (created_by) REFERENCES "user"(id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;
--> statement-breakpoint
ALTER TABLE decision_fact_value DROP CONSTRAINT IF EXISTS decision_fact_value_confirmed_by_user_id_fk;
--> statement-breakpoint
ALTER TABLE decision_fact_value
  ADD CONSTRAINT decision_fact_value_confirmed_by_fk
  FOREIGN KEY (confirmed_by) REFERENCES "user"(id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;
--> statement-breakpoint
ALTER TABLE decision_report DROP CONSTRAINT IF EXISTS decision_report_created_by_user_id_fk;
--> statement-breakpoint
ALTER TABLE decision_report
  ADD CONSTRAINT decision_report_created_by_fk
  FOREIGN KEY (created_by) REFERENCES "user"(id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;
--> statement-breakpoint
ALTER TABLE decision_report DROP CONSTRAINT IF EXISTS decision_report_resolved_by_user_id_fk;
--> statement-breakpoint
ALTER TABLE decision_report
  ADD CONSTRAINT decision_report_resolved_by_fk
  FOREIGN KEY (resolved_by) REFERENCES "user"(id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;