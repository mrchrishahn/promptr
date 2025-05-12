import { db } from "~/server/db";
import { prompts, embeddings, generations, projects } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export async function createProject(name: string, description?: string) {
  const [project] = await db
    .insert(projects)
    .values({
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return project;
}

export async function getProjects() {
  return db.query.projects.findMany({
    orderBy: (projects, { desc }) => [desc(projects.createdAt)],
  });
}

export async function getProjectById(id: string) {
  return db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: {
      prompts: {
        with: {
          embeddings: {
            with: {
              model: true,
            },
          },
          generations: {
            with: {
              model: true,
            },
          },
        },
      },
    },
  });
}

export async function storePrompt(
  template: string,
  variables: Record<string, unknown>,
  targetModelId: string,
  projectId: string,
) {
  const [prompt] = await db
    .insert(prompts)
    .values({
      template,
      variables,
      targetModelId,
      projectId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return prompt;
}

export async function storeEmbedding(
  promptId: string,
  modelId: string,
  vector: number[],
) {
  const [embedding] = await db
    .insert(embeddings)
    .values({
      promptId,
      modelId,
      vector,
      createdAt: new Date(),
    })
    .returning();

  return embedding;
}

export async function storeGeneration(
  promptId: string,
  modelId: string,
  output: string,
  metadata: Record<string, unknown> = {},
) {
  const [generation] = await db
    .insert(generations)
    .values({
      promptId,
      modelId,
      output,
      metadata,
      createdAt: new Date(),
    })
    .returning();

  return generation;
}

export async function getPromptHistory(projectId?: string, limit = 10) {
  return db.query.prompts.findMany({
    where: projectId ? eq(prompts.projectId, projectId) : undefined,
    limit,
    orderBy: (prompts, { asc }) => [asc(prompts.createdAt)],
    with: {
      embeddings: {
        with: {
          model: true,
        },
      },
      generations: {
        with: {
          model: true,
        },
      },
    },
  });
}

export async function getPromptById(id: string) {
  return db.query.prompts.findFirst({
    where: eq(prompts.id, id),
    with: {
      embeddings: {
        with: {
          model: true,
        },
      },
      generations: {
        with: {
          model: true,
        },
      },
    },
  });
} 