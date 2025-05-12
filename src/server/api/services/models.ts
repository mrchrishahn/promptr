import OpenAI from "openai";
import { env } from "~/env";
import { db } from "~/server/db";
import { models, type Model } from "~/server/db/schema";
import { eq, and, gte } from "drizzle-orm";

const openai = new OpenAI({
	apiKey: env.OPENAI_API_KEY,
});

export type OpenAIModel = {
	id: string;
	object: string;
	created: number;
	owned_by: string;
};

export type ModelCategory = "chat" | "embedding" | "reasoning" | "other";

// Cache duration in milliseconds (1 week)
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;

async function fetchAndStoreModels(): Promise<Model[]> {
	const response = await openai.models.list();
	const openaiModels = response.data;

	// Categorize models
	const categorizedModels = openaiModels.map((model) => {
		let category: ModelCategory = "other";

		if (model.id.startsWith("gpt")) {
			category = "chat";
		} else if (model.id.startsWith("o")) {
			category = "reasoning";
		} else if (model.id.startsWith("text-embedding")) {
			category = "embedding";
		}

		return {
			...model,
			category,
			label: model.id,
		};
	});

	// Store models in database and get stored records
	const storedModels = [];
	for (const model of categorizedModels) {
		const [stored] = await db
			.insert(models)
			.values({
				name: model.id,
				provider: "openai",
				category: model.category,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: [models.name, models.provider],
				set: {
					category: model.category,
					updatedAt: new Date(),
				},
			})
			.returning();
		storedModels.push(stored);
	}

	// Map stored models to CategorizedModel format
	return storedModels.filter((model) => model !== null && model !== undefined);
}

export async function getAvailableModels(): Promise<Model[]> {
	// Check if we have cached models that are less than a week old
	const cachedModels = await db.query.models.findMany({
		where: and(
			eq(models.provider, "openai"),
			gte(models.updatedAt, new Date(Date.now() - CACHE_DURATION)),
		),
	});

	if (cachedModels.length > 0) {
		return cachedModels;
	}

	// If no cached models or they're too old, fetch fresh ones
	return fetchAndStoreModels();
}

export async function getModelsByCategory(
	category: ModelCategory,
): Promise<Model[]> {
	const allModels = await getAvailableModels();
	return allModels.filter((model) => model.category === category);
}

export async function getModelById(id: string): Promise<Model | null> {
	const model = await db.query.models.findFirst({
		where: eq(models.id, id),
	});
	return model ?? null;
}
