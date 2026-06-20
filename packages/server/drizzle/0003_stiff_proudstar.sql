ALTER TABLE "logic" ADD COLUMN "draft_workspace_config" jsonb;--> statement-breakpoint
ALTER TABLE "logic_version" ADD COLUMN "workspace_config" jsonb;--> statement-breakpoint
ALTER TABLE "logic" ADD CONSTRAINT "logic_draft_workspace_config_object_chk" CHECK ("logic"."draft_workspace_config" IS NULL OR jsonb_typeof("logic"."draft_workspace_config") = 'object');--> statement-breakpoint
ALTER TABLE "logic_version" ADD CONSTRAINT "logic_version_workspace_config_object_chk" CHECK ("logic_version"."workspace_config" IS NULL OR jsonb_typeof("logic_version"."workspace_config") = 'object');