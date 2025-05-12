import { useState, useEffect, useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { ChevronDown, ChevronUp } from "lucide-react";

interface VariableEditorProps {
  prompt: string;
  variables: Record<string, string>;
  onChange: (variables: Record<string, string>) => void;
}

// Extract variables from prompt using regex
const extractVariables = (text: string) => {
  const regex = /\{(\w+)\}/g;
  const matches = [...text.matchAll(regex)];
  return [...new Set(matches.map((match) => match[1]))];
};

export function VariableEditor({
  prompt,
  variables,
  onChange,
}: VariableEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const promptVariables = useMemo(() => extractVariables(prompt), [prompt]);

  // Update variables when prompt changes
  useEffect(() => {
    const newVariables = { ...variables };
    let hasChanges = false;

    // Remove variables that are no longer in the prompt
    for (const key of Object.keys(newVariables)) {
      if (!promptVariables.includes(key)) {
        delete newVariables[key];
        hasChanges = true;
      }
    }

    // Add new variables with empty values
    for (const key of promptVariables) {
      if (!!key && !(key in newVariables)) {
        newVariables[key] = "";
        hasChanges = true;
      }
    }

    if (hasChanges) {
      onChange(newVariables);
    }
  }, [promptVariables, variables, onChange]);

  const toggleRow = (variable: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(variable)) {
      newExpandedRows.delete(variable);
    } else {
      newExpandedRows.add(variable);
    }
    setExpandedRows(newExpandedRows);
  };

  if (promptVariables.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white">
      <Button
        variant="ghost"
        className="w-full justify-between px-4 py-2 text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium">Variables</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>

      {isOpen && (
        <div className="border-t border-gray-200 p-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                  Variable
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {promptVariables.map(
                (variable) =>
                  variable && (
                    <tr key={variable} className="border-b border-gray-100">
                      <td className="px-4 py-2">
                        <code className="rounded bg-gray-100 px-2 py-1 text-sm">{`{${variable}}`}</code>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {expandedRows.has(variable) ? (
                            <Textarea
                              value={variables[variable] ?? ""}
                              onChange={(e) =>
                                onChange({
                                  ...variables,
                                  [variable]: e.target.value,
                                })
                              }
                              className="min-h-[100px] resize-y"
                              placeholder={`Enter value for ${variable}`}
                            />
                          ) : (
                            <Input
                              value={variables[variable] ?? ""}
                              onChange={(e) =>
                                onChange({
                                  ...variables,
                                  [variable]: e.target.value,
                                })
                              }
                              placeholder={`Enter value for ${variable}`}
                            />
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleRow(variable)}
                          >
                            {expandedRows.has(variable) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
