"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { ProjectSelect } from "~/components/ProjectSelect";
import { VariableEditor } from "~/components/VariableEditor";
import { ModelSelect } from "~/components/ModelSelect";
import type { Embedding, Generation, Model, Prompt } from "~/server/db/schema";
import { format } from "date-fns";
import { createHash } from "node:crypto";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart";

// Hash a prompt and its variables
function hashPrompt(prompt: string, variables: Record<string, string>): string {
  return createHash("sha256")
    .update(`${prompt}:${JSON.stringify(variables)}`)
    .digest("hex");
}

function ModelSelectSkeleton() {
  return (
    <div className="flex space-x-2">
      <div className="h-7 w-28 animate-pulse rounded-md bg-gray-200" />
      <div className="h-7 w-28 animate-pulse rounded-md bg-gray-200" />
    </div>
  );
}

function HistoryScrubber({
  projectId,
  onSelect,
  currentPromptId,
}: {
  projectId: string;
  onSelect: (prompt: string, embedding: number[], promptId: string) => void;
  currentPromptId: string | null;
}) {
  const { data: history } = api.llm.getPromptHistory.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

  if (!history?.length) return null;

  const handleSelect = (prompt: {
    id: string;
    template: string;
    embeddings: { vector: number[] }[];
  }) => {
    const embedding = prompt.embeddings[0]?.vector ?? [];
    onSelect(prompt.template, embedding, prompt.id);
  };

  return (
    <div className="-left-8 absolute top-2 bottom-0 flex w-8 flex-col items-center gap-1 py-4">
      {history.map((prompt) => (
        <button
          key={prompt.id}
          type="button"
          className={`group relative w-4 cursor-pointer border-0 bg-transparent p-0 ${
            prompt.id === currentPromptId ? "opacity-100" : "opacity-50"
          }`}
          onClick={() => handleSelect(prompt)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleSelect(prompt);
            }
          }}
        >
          <div
            className={`h-0.5 w-full transition-colors ${
              prompt.id === currentPromptId
                ? "bg-blue-500"
                : "bg-gray-300 group-hover:bg-blue-500"
            }`}
          />
          <div className="-translate-y-1/2 absolute top-1/2 left-6 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-white text-xs opacity-0 transition-opacity group-hover:opacity-100">
            {format(new Date(prompt.createdAt), "MMM d, h:mm a")}
          </div>
        </button>
      ))}
    </div>
  );
}

export function PromptInterface() {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [embedding, setEmbedding] = useState<number[]>([]);
  const [embeddingModel, setEmbeddingModel] = useState<Model | null>(null);
  const [generationModel, setGenerationModel] = useState<Model | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [currentPromptId, setCurrentPromptId] = useState<string | null>(null);
  const utils = api.useUtils();

  const { data: models, isLoading: isLoadingModels } =
    api.llm.getModels.useQuery();

  const { data: history } = api.llm.getPromptHistory.useQuery(
    { projectId },
    {
      enabled: !!projectId,
      select: (data) => {
        const history = data.map((prompt, index, history) => {
          const previousPrompt = index > 0 ? history[index - 1] : null;
          const nextPrompt =
            index < history.length - 1 ? history[index + 1] : null;

          const previousEmbeddingDistance =
            previousPrompt &&
            prompt.embeddings[0]?.vector &&
            previousPrompt.embeddings[0]?.vector
              ? cosineDistance(
                  prompt.embeddings[0]?.vector ?? [],
                  previousPrompt.embeddings[0]?.vector ?? []
                )
              : null;
          const nextEmbeddingDistance =
            nextPrompt &&
            prompt.embeddings[0]?.vector &&
            nextPrompt.embeddings[0]?.vector
              ? cosineDistance(
                  prompt.embeddings[0]?.vector ?? [],
                  nextPrompt.embeddings[0]?.vector ?? []
                )
              : null;

          const previousEmbeddingDeviation =
            previousPrompt &&
            prompt.embeddings[0]?.vector &&
            previousPrompt.embeddings[0]?.vector
              ? findGreatestDeviation(
                  prompt.embeddings[0]?.vector ?? [],
                  previousPrompt.embeddings[0]?.vector ?? [],
                  5
                )
              : null;
          const nextEmbeddingDeviation =
            nextPrompt &&
            prompt.embeddings[0]?.vector &&
            nextPrompt.embeddings[0]?.vector
              ? findGreatestDeviation(
                  prompt.embeddings[0]?.vector ?? [],
                  nextPrompt.embeddings[0]?.vector ?? [],
                  5
                )
              : null;

          return {
            ...prompt,
            previousEmbeddingDistance,
            nextEmbeddingDistance,
            previousEmbeddingDeviation,
            nextEmbeddingDeviation,
          };
        });
        return history;
      },
    }
  );

  // Set initial model values when models are loaded
  useEffect(() => {
    if (models) {
      if (models.embedding.length > 0 && !embeddingModel) {
        setEmbeddingModel(models.embedding[0] ?? null);
      }
      if (
        (models.chat.length > 0 || models.reasoning.length > 0) &&
        !generationModel
      ) {
        setGenerationModel(models.chat[0] ?? models.reasoning[0] ?? null);
      }
    }
  }, [models, embeddingModel, generationModel]);

  const getEmbeddingMutation = api.llm.getEmbedding.useMutation({
    onSuccess: (data) => {
      setEmbedding(data.embedding?.vector ?? []);
      setCurrentPromptId(data.prompt?.id ?? null);
      setIsLoading(false);
      utils.llm.getPromptHistory.invalidate();
    },
    onError: (error) => {
      console.error("Error getting embedding:", error);
      setIsLoading(false);
    },
  });

  const generateMutation = api.llm.generate.useMutation({
    onSuccess: (data) => {
      setOutput(data.generation?.output ?? "");
      setCurrentPromptId(data.prompt?.id ?? null);
      setIsLoading(false);
      utils.llm.getPromptHistory.invalidate();
    },
    onError: (error) => {
      console.error("Error generating response:", error);
      setIsLoading(false);
    },
  });

  const handleGetEmbedding = () => {
    if (!prompt.trim() || !embeddingModel || !projectId) return;

    const currentHash = hashPrompt(prompt, variables);

    // Check if the current prompt matches any existing prompt in history
    const matchingPrompt = history?.find((p) => {
      return p.hash === currentHash;
    });

    if (matchingPrompt) {
      // If we find a match, just set the current prompt ID and embedding
      setCurrentPromptId(matchingPrompt.id);
      const matchingEmbedding = matchingPrompt.embeddings[0]?.vector;
      if (matchingEmbedding) {
        setEmbedding(matchingEmbedding);
        return;
      }
    }

    // If no match or no embedding, proceed with getting a new embedding
    setIsLoading(true);
    getEmbeddingMutation.mutate({
      prompt,
      variables,
      model: embeddingModel,
      projectId,
    });
  };

  const handlePromptUpdate = (
    prompt: string,
    variables: Record<string, string>
  ) => {
    setPrompt(prompt);
    setVariables(variables);
    const currentHash = hashPrompt(prompt, variables);
    const matchingPrompt = history?.find((p) => {
      return p.hash === currentHash;
    });
    if (matchingPrompt) {
      setCurrentPromptId(matchingPrompt.id);
    } else {
      setCurrentPromptId(null);
    }
  };

  const handleGenerate = () => {
    if (!prompt.trim() || !generationModel || !projectId) return;
    setIsLoading(true);
    generateMutation.mutate({
      prompt,
      variables,
      model: generationModel,
      projectId,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === "e") {
        e.preventDefault();
        handleGetEmbedding();
      } else if (e.key === "g") {
        e.preventDefault();
        handleGenerate();
      }
    }
  };

  const handleHistorySelect = (
    selectedPrompt: string,
    selectedEmbedding: number[],
    promptId: string
  ) => {
    setPrompt(selectedPrompt);
    setEmbedding(selectedEmbedding);
    setCurrentPromptId(promptId);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <ProjectSelect
          value={projectId}
          onValueChange={(value) => {
            setProjectId(value);
            utils.llm.getPromptHistory.invalidate();
            setCurrentPromptId(null);
            setEmbedding([]);
            setOutput("");
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left Column */}
        <div className="flex flex-col space-y-4">
          <div className="flex items-center space-x-2">
            {isLoadingModels ? (
              <ModelSelectSkeleton />
            ) : (
              <>
                <ModelSelect
                  value={embeddingModel}
                  onChange={setEmbeddingModel}
                  models={models?.embedding ?? []}
                  disabled={isLoading}
                  placeholder="Select embedding model"
                />
                <ModelSelect
                  value={generationModel}
                  onChange={setGenerationModel}
                  models={[
                    ...(models?.chat ?? []),
                    ...(models?.reasoning ?? []),
                  ]}
                  disabled={isLoading}
                  placeholder="Select generation model"
                />
              </>
            )}
          </div>
          <div className="relative flex-0">
            {projectId && (
              <HistoryScrubber
                projectId={projectId}
                onSelect={handleHistorySelect}
                currentPromptId={currentPromptId}
              />
            )}
            <textarea
              className="h-[400px] w-full rounded-lg border border-gray-300 p-4 text-gray-900 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Enter your prompt here..."
              value={prompt}
              onChange={(e) => handlePromptUpdate(e.target.value, variables)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || !projectId}
            />
            <div className="absolute right-4 bottom-4 flex space-x-2">
              <button
                type="button"
                onClick={handleGetEmbedding}
                disabled={
                  isLoading || !embeddingModel || !projectId || isLoadingModels
                }
                className="rounded-md bg-gray-100 px-4 py-2 font-medium text-gray-700 text-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Get Embedding (⌘E)
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={
                  isLoading || !generationModel || !projectId || isLoadingModels
                }
                className="rounded-md bg-blue-600 px-4 py-2 font-medium text-sm text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Generate (⌘G)
              </button>
            </div>
          </div>

          <VariableEditor
            prompt={prompt}
            variables={variables}
            onChange={(variables) => handlePromptUpdate(prompt, variables)}
          />

          <div className="rounded-lg border border-gray-300 bg-gray-50 p-4">
            <h3 className="mb-2 font-medium text-gray-700 text-sm">Output</h3>
            <div className="whitespace-pre-wrap text-gray-900">
              {isLoading
                ? "Loading..."
                : output || "Generated output will appear here..."}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-4">
          {history && <EmbeddingDeviationChart history={history} />}
          <div className="rounded-lg border border-gray-300 bg-gray-50 p-4">
            <h3 className="mb-2 font-medium text-gray-700 text-sm">
              Current Prompt Embedding
            </h3>
            <div className="font-mono text-gray-900 text-sm">
              {isLoading ? (
                "Loading..."
              ) : embedding.length === 0 ? (
                "Embedding will appear here..."
              ) : (
                <EmbeddingDisplay
                  embedding={embedding}
                  currentPromptEntry={
                    history?.find((p) => p.id === currentPromptId) ?? null
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmbeddingDisplay({
  embedding,
  currentPromptEntry,
}: {
  embedding: number[];
  currentPromptEntry:
    | (Prompt & {
        embeddings: Embedding[];
        generations: Generation[];
        hash: string;
        previousEmbeddingDistance: number | null;
        nextEmbeddingDistance: number | null;
        previousEmbeddingDeviation: [number, number][] | null;
        nextEmbeddingDeviation: [number, number][] | null;
      })
    | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-gray-500 text-xs">Embedding:</div>
      <div className="text-gray-900 text-xs">
        {JSON.stringify(embedding, null, 2).slice(0, 200)}...
      </div>
      {currentPromptEntry?.previousEmbeddingDistance && (
        <>
          <div className="text-gray-500 text-xs">
            Distance to previous prompt:{" "}
            {currentPromptEntry.previousEmbeddingDistance}
          </div>
          <div className="text-gray-500 text-xs">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="pr-4 text-left">Index</th>
                  <th className="text-left">Deviation</th>
                </tr>
              </thead>
              <tbody>
                {currentPromptEntry.previousEmbeddingDeviation?.map(
                  ([deviation, index]) => (
                    <tr key={index}>
                      <td className="pr-4">{index}</td>
                      <td>{deviation.toFixed(8)}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {currentPromptEntry?.nextEmbeddingDistance && (
        <>
          <div className="text-gray-500 text-xs">
            Distance to next prompt: {currentPromptEntry.nextEmbeddingDistance}
          </div>
          <div className="text-gray-500 text-xs">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="pr-4 text-left">Index</th>
                  <th className="text-left">Deviation</th>
                </tr>
              </thead>
              <tbody>
                {currentPromptEntry.nextEmbeddingDeviation?.map(
                  ([deviation, index]) => (
                    <tr key={index}>
                      <td className="pr-4">{index}</td>
                      <td>{deviation.toFixed(8)}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function EmbeddingDeviationChart({
  history,
}: {
  history: Array<{
    id: string;
    previousEmbeddingDistance: number | null;
    nextEmbeddingDistance: number | null;
    createdAt: Date;
  }>;
}) {
  if (!history?.length) return null;

  const chartData = history.map((prompt) => ({
    id: prompt.id,
    deviation: prompt.nextEmbeddingDistance ?? 0,
    date: format(new Date(prompt.createdAt), "MMM d"),
  }));

  return (
    <div className="mb-4 h-10 w-full">
      <ChartContainer className="h-full">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="deviation"
            stroke="rgb(59, 130, 246)"
            strokeWidth={1.5}
            dot={{ r: 2, fill: "rgb(59, 130, 246)" }}
            isAnimationActive={false}
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "rgb(107, 114, 128)" }}
            interval="preserveStartEnd"
          />
          <YAxis hide domain={[0, "dataMax"]} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const data = payload[0]?.payload;
              return (
                <ChartTooltip>
                  <ChartTooltipContent
                    label={data.date}
                    value={`Deviation: ${data.deviation.toFixed(6)}`}
                  />
                </ChartTooltip>
              );
            }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

function cosineDistance(embedding: number[], previousEmbedding: number[]) {
  const dotProduct = embedding.reduce(
    (acc, val, index) => acc + val * (previousEmbedding[index] as number),
    0
  );
  const magnitude = Math.sqrt(
    embedding.reduce((acc, val) => acc + val * val, 0)
  );
  const previousMagnitude = Math.sqrt(
    previousEmbedding.reduce((acc, val) => acc + val * val, 0)
  );
  return dotProduct / (magnitude * previousMagnitude);
}

const findGreatestDeviation = (
  vector: number[],
  comp_vector: number[],
  n: number
) => {
  if (n > vector.length) {
    throw new Error("n is greater than the vector length");
  }
  if (vector.length !== comp_vector.length) {
    throw new Error(
      `Vector and comp_vector must have the same length: ${vector.length} !== ${comp_vector.length}`
    );
  }
  const deviations: [number, number][] = vector.map((val, index) => [
    Math.abs(val - (comp_vector[index] as number)),
    index,
  ]);
  const sortedDeviations = deviations.sort((a, b) => b[0] - a[0]);
  return sortedDeviations.slice(0, n);
};
