ALTER TABLE "logic_version" DROP CONSTRAINT "logic_version_logic_id_logic_id_fk";
--> statement-breakpoint
ALTER TABLE "logic_version" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
UPDATE "logic_version"
SET "workspace_id" = "logic"."workspace_id"
FROM "logic"
WHERE "logic_version"."logic_id" = "logic"."id";--> statement-breakpoint
ALTER TABLE "logic_version" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "logic_version" ADD CONSTRAINT "logic_version_workspace_logic_fk" FOREIGN KEY ("workspace_id","logic_id") REFERENCES "public"."logic"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "logic_version" ADD CONSTRAINT "logic_version_workspace_id_id_uniq" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE logic
  ADD CONSTRAINT logic_production_version_same_workspace_fk
  FOREIGN KEY (workspace_id, production_version_id)
  REFERENCES logic_version (workspace_id, id)
  ON DELETE NO ACTION
  DEFERRABLE INITIALLY IMMEDIATE;
