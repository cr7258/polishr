import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PolishrConfig } from "@/core/llm/types";
import { PRESET_ENDPOINTS } from "@/core/llm/types";

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  config: PolishrConfig;
  onSave: (config: PolishrConfig) => void;
}

export function Settings({ open, onClose, config, onSave }: SettingsProps) {
  const [draft, setDraft] = useState<PolishrConfig>(config);

  useEffect(() => {
    if (open) {
      setDraft(config);
    }
  }, [open, config]);

  if (!open) return null;

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Settings</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* API Endpoint */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              API Endpoint
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_ENDPOINTS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() =>
                    setDraft({ ...draft, apiEndpoint: preset.value })
                  }
                  className={cn(
                    "cursor-pointer rounded-md border px-2 py-1 text-[11px] font-medium transition-colors duration-200",
                    draft.apiEndpoint === preset.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <input
              type="url"
              value={draft.apiEndpoint}
              onChange={(e) =>
                setDraft({ ...draft, apiEndpoint: e.target.value })
              }
              placeholder="https://api.openai.com/v1"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              API Key
            </label>
            <input
              type="password"
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Model</label>
            <input
              type="text"
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              placeholder="gpt-4o"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Temperature */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Temperature{" "}
              <span className="text-muted-foreground">
                ({draft.temperature.toFixed(1)})
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={draft.temperature}
              onChange={(e) =>
                setDraft({ ...draft, temperature: parseFloat(e.target.value) })
              }
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-md border border-border px-4 py-2 text-xs font-medium text-foreground transition-colors duration-200 hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="cursor-pointer rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
