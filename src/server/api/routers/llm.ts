import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { OpenAI } from "openai";
import { env } from "~/env";
import {
	getModelsByCategory,
	getAvailableModels,
	getModelById,
} from "~/server/api/services/models";
import {
	storePrompt,
	storeEmbedding,
	storeGeneration,
	getPromptHistory,
	getPromptById,
	createProject,
	getProjects,
	getProjectById,
} from "~/server/api/services/history";
import { createHash } from "node:crypto";

function replaceVariables(text: string, variables: Record<string, string>): string {
	return text.replace(/\{(\w+)\}/g, (match, key) => {
		return variables[key] ?? match;
	});
}

const modelSchema = z.object({
	id: z.string(),
	category: z.string(),
	name: z.string(),
	provider: z.string(),
});



const openai = new OpenAI({
	apiKey: env.OPENAI_API_KEY,
});

export const llmRouter = createTRPCRouter({
	getModels: publicProcedure.query(async () => {
		const chatModels = await getModelsByCategory("chat");
		const embeddingModels = await getModelsByCategory("embedding");
		const reasoningModels = await getModelsByCategory("reasoning");

		return {
			chat: chatModels,
			embedding: embeddingModels,
			reasoning: reasoningModels,
		};
	}),

	getProjects: publicProcedure.query(async () => {
		return getProjects();
	}),

	getProject: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ input }) => {
			return getProjectById(input.id);
		}),

	createProject: publicProcedure
		.input(
			z.object({
				name: z.string(),
				description: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			return createProject(input.name, input.description);
		}),

	getPromptHistory: publicProcedure
		.input(
			z.object({
				projectId: z.string().optional(),
				limit: z.number().optional(),
			}),
		)
		.query(async ({ input }) => {
			const history = await getPromptHistory(input.projectId, input.limit);
			return history.map((prompt) => ({
				...prompt,
				hash: createHash('sha256').update(`${prompt.template}:${JSON.stringify(prompt.variables)}`).digest('hex'),
			}));
		}),

	getPrompt: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ input }) => {
			return getPromptById(input.id);
		}),

	getEmbedding: publicProcedure
		.input(
			z.object({
				prompt: z.string(),
				variables: z.record(z.string(), z.string()).optional().default({}),
				model: modelSchema,
				projectId: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			const model = await getModelById(input.model.id);

			if (!model || model.category !== "embedding") {
				throw new Error("Invalid embedding model");
			}

			const prompt = await storePrompt(
				input.prompt,
				input.variables,
				model.id,
				input.projectId,
			);

			if (!prompt) {
				throw new Error("Failed to store prompt");
			}

			const response = await openai.embeddings.create({
				model: model.name,
				input: replaceVariables(input.prompt, input.variables),
			});

			const embedding = await storeEmbedding(
				prompt.id,
				model.id,
				response.data[0]?.embedding ?? [],
			);

			return {
				prompt,
				embedding,
			};
		}),

	generate: publicProcedure
		.input(
			z.object({
				prompt: z.string(),
				variables: z.record(z.string(), z.string()).optional().default({}),
				model: modelSchema,
				projectId: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			const model = await getModelById(input.model.id);

			if (!model) {
				throw new Error("Invalid chat or reasoning model");
			}

			const prompt = await storePrompt(
				input.prompt,
				input.variables,
				model.id,
				input.projectId,
			);

			if (!prompt) {
				throw new Error("Failed to store prompt");
			}

			const response = await openai.chat.completions.create({
				model: model.name,
				messages: [{ role: "user", content: replaceVariables(input.prompt, input.variables) }],
			});

			const generation = await storeGeneration(
				prompt.id,
				model.id,
				response.choices[0]?.message?.content ?? "",
				{
					finishReason: response.choices[0]?.finish_reason,
					usage: response.usage,
				},
			);

			return {
				prompt,
				generation,
			};
		}),
}); 