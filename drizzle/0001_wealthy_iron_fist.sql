CREATE TABLE "promptr_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"vector" vector(1536) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promptr_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"output" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promptr_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"category" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promptr_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template" text NOT NULL,
	"variables" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"target_model_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "promptr_embeddings" ADD CONSTRAINT "promptr_embeddings_prompt_id_promptr_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."promptr_prompts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promptr_embeddings" ADD CONSTRAINT "promptr_embeddings_model_id_promptr_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."promptr_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promptr_generations" ADD CONSTRAINT "promptr_generations_prompt_id_promptr_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."promptr_prompts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promptr_generations" ADD CONSTRAINT "promptr_generations_model_id_promptr_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."promptr_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promptr_prompts" ADD CONSTRAINT "promptr_prompts_target_model_id_promptr_models_id_fk" FOREIGN KEY ("target_model_id") REFERENCES "public"."promptr_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "embeddings_prompt_idx" ON "promptr_embeddings" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "embeddings_model_idx" ON "promptr_embeddings" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "embeddings_vector_idx" ON "promptr_embeddings" USING hnsw ("vector" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "generations_prompt_idx" ON "promptr_generations" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "generations_model_idx" ON "promptr_generations" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "models_category_idx" ON "promptr_models" USING btree ("category");--> statement-breakpoint
CREATE INDEX "prompts_target_model_idx" ON "promptr_prompts" USING btree ("target_model_id");