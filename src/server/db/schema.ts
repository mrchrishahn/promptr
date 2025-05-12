// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { relations, sql } from "drizzle-orm";
import { index, pgTableCreator, vector } from "drizzle-orm/pg-core";
import {
	pgTable,
	text,
	timestamp,
	uuid,
	jsonb,
	integer,
	uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `promptr_${name}`);

// Projects table to organize prompts
export const projects = createTable(
	"projects",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		name: text("name").notNull(),
		description: text("description"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [index("projects_name_idx").on(table.name)],
);

export const projectRelations = relations(projects, ({ many }) => ({
	prompts: many(prompts),
}));

// Models table to store available models
export const models = createTable(
	"models",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		name: text("name").notNull(),
		provider: text("provider").notNull(), // e.g., "openai", "anthropic"
		category: text("category").notNull(), // "chat", "embedding", "reasoning"
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("models_category_idx").on(table.category),
		uniqueIndex("models_name_provider_idx").on(table.name, table.provider),
	],
);

// Prompts table to store prompt templates and their metadata
export const prompts = createTable(
	"prompts",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		template: text("template").notNull(),
		variables: jsonb("variables").notNull().default({}),
		targetModelId: uuid("target_model_id")
			.references(() => models.id, { onDelete: "cascade" })
			.notNull(),
		projectId: uuid("project_id")
			.references(() => projects.id, { onDelete: "cascade" })
			.notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("prompts_target_model_idx").on(table.targetModelId),
		index("prompts_project_idx").on(table.projectId),
	],
);

export const promptRelations = relations(prompts, ({ many, one }) => ({
	project: one(projects, {
		fields: [prompts.projectId],
		references: [projects.id],
	}),
	embeddings: many(embeddings),
	generations: many(generations),
	targetModel: one(models, {
		fields: [prompts.targetModelId],
		references: [models.id],
	}),
}));


// Embeddings table to store vector embeddings
export const embeddings = createTable(
	"embeddings",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		promptId: uuid("prompt_id")
			.references(() => prompts.id, { onDelete: "cascade" })
			.notNull(),
		modelId: uuid("model_id")
			.references(() => models.id, { onDelete: "cascade" })
			.notNull(),
		vector: vector("vector", { dimensions: 1536 }).notNull(), // OpenAI embeddings are 1536 dimensions
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("embeddings_prompt_idx").on(table.promptId),
		index("embeddings_model_idx").on(table.modelId),
		index("embeddings_vector_idx").using(
			"hnsw",
			table.vector.op("vector_cosine_ops"),
		),
	],
);

export const embeddingRelations = relations(embeddings, ({ one }) => ({
	prompt: one(prompts, {
		fields: [embeddings.promptId],
		references: [prompts.id],
	}),
	model: one(models, {
		fields: [embeddings.modelId],
		references: [models.id],
	}),
}));

// Generated outputs table to store the results of prompt generations
export const generations = createTable(
	"generations",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		promptId: uuid("prompt_id")
			.references(() => prompts.id, { onDelete: "cascade" })
			.notNull(),
		modelId: uuid("model_id")
			.references(() => models.id, { onDelete: "cascade" })
			.notNull(),
		output: text("output").notNull(),
		metadata: jsonb("metadata").default({}), // Store any additional metadata about the generation
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("generations_prompt_idx").on(table.promptId),
		index("generations_model_idx").on(table.modelId),
	],
);

export const generationRelations = relations(generations, ({ one }) => ({
	prompt: one(prompts, {
		fields: [generations.promptId],
		references: [prompts.id],
	}),
	model: one(models, {
		fields: [generations.modelId],
		references: [models.id],
	}),
}));


// Types for TypeScript
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Model = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;

export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;

export type Embedding = typeof embeddings.$inferSelect;
export type NewEmbedding = typeof embeddings.$inferInsert;

export type Generation = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;
