import type { Model } from "~/server/db/schema";

interface ModelSelectProps {
  value: Model | null;
  onChange: (model: Model | null) => void;
  models: Model[];
  disabled?: boolean;
  placeholder?: string;
}

export function ModelSelect({
  value,
  onChange,
  models,
  disabled = false,
  placeholder = "Select model",
}: ModelSelectProps) {
  return (
    <select
      value={value?.id ?? ""}
      onChange={(e) => {
        const model = models.find((m) => m.id === e.target.value);
        onChange(model ?? null);
      }}
      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {models.map((model) => (
        <option key={model.id} value={model.id}>
          {model.name}
        </option>
      ))}
    </select>
  );
} 