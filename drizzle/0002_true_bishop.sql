CREATE TABLE "promptr_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "promptr_prompts" ADD COLUMN "project_id" uuid NOT NULL;--> statement-breakpoint
CREATE INDEX "projects_name_idx" ON "promptr_projects" USING btree ("name");--> statement-breakpoint
ALTER TABLE "promptr_prompts" ADD CONSTRAINT "promptr_prompts_project_id_promptr_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."promptr_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prompts_project_idx" ON "promptr_prompts" USING btree ("project_id");