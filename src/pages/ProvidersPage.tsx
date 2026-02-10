import { useState, useEffect } from "react";
import type { Provider } from "@/core/llm/types";
import { PROVIDER_PRESETS } from "@/core/llm/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface ProvidersPageProps {
  providers: Provider[];
  activeProviderId: string;
  onSave: (providers: Provider[], activeId?: string) => void;
  onSetActive: (id: string) => void;
}

const PROVIDER_LOGOS: Record<string, string> = {
  deepseek:
    "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/deepseek-color.png",
  openai:
    "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/openai.png",
  openrouter:
    "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/openrouter.png",
  minimax:
    "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/minimax-color.png",
};

export function ProvidersPage({
  providers,
  activeProviderId,
  onSave,
  onSetActive,
}: ProvidersPageProps) {
  const [selectedId, setSelectedId] = useState(
    activeProviderId || PROVIDER_PRESETS[0]?.id || "",
  );
  const [draft, setDraft] = useState<Provider | null>(null);

  // Get the provider data (from saved or preset)
  function getProvider(id: string): Provider {
    const saved = providers.find((p) => p.id === id);
    if (saved) return saved;
    const preset = PROVIDER_PRESETS.find((p) => p.id === id);
    if (preset) return { ...preset, apiKey: "" };
    return { id, name: id, endpoint: "", apiKey: "", model: "", temperature: 0.3 };
  }

  useEffect(() => {
    setDraft(getProvider(selectedId));
  }, [selectedId, providers]);

  const handleSave = () => {
    if (!draft) return;
    const existing = providers.filter((p) => p.id !== draft.id);
    const updated = [...existing, draft];
    onSave(updated, draft.id);
    onSetActive(draft.id);
  };

  const isActive = activeProviderId === selectedId;
  const isConfigured = (id: string) =>
    providers.find((p) => p.id === id)?.apiKey?.length ?? 0 > 0;

  return (
    <div className="mx-auto max-w-[640px] px-10 py-10">
      <div className="mb-8">
        <h1 className="text-[20px] font-semibold tracking-tight text-[#18181b]">
          API Providers
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#71717a]">
          Select and configure the LLM provider used by the floating panel.
        </p>
      </div>

      {/* Provider grid */}
      <div className="grid grid-cols-2 gap-3">
        {PROVIDER_PRESETS.map((preset) => {
          const isSelected = selectedId === preset.id;
          const isActiveProvider = activeProviderId === preset.id;
          const configured = isConfigured(preset.id);
          return (
            <button
              key={preset.id}
              onClick={() => setSelectedId(preset.id)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] px-4 py-3.5 text-left transition-all duration-150",
                isSelected
                  ? "border-blue-500 bg-gradient-to-br from-blue-500/[0.04] to-blue-500/[0.01] shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
                  : "border-[#e5e7eb] hover:border-blue-300 hover:-translate-y-px hover:shadow-[0_0_0_3px_rgba(59,130,246,0.06)]",
              )}
            >
              <img
                src={PROVIDER_LOGOS[preset.id]}
                alt={preset.name}
                className="h-10 w-10 rounded-[10px] object-contain"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-[#18181b]">
                  {preset.name}
                </div>
                <div className="truncate text-[11px] text-[#a1a1aa]">
                  {configured ? preset.model : "Not configured"}
                </div>
              </div>
              {isActiveProvider && (
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="my-8 border-t border-[#f4f4f5]" />

      {/* Config form */}
      {draft && (
        <div>
          <div className="mb-6 flex items-center gap-3">
            <img
              src={PROVIDER_LOGOS[draft.id]}
              alt={draft.name}
              className="h-10 w-10 rounded-[10px] object-contain"
            />
            <div>
              <h2 className="text-[14px] font-semibold text-[#18181b]">
                {draft.name} Configuration
              </h2>
              <p className="text-[11px] text-[#a1a1aa]">
                {new URL(draft.endpoint).hostname}
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-[12px] font-medium text-[#52525b]">
                API Endpoint
              </label>
              <input
                type="url"
                value={draft.endpoint}
                onChange={(e) =>
                  setDraft({ ...draft, endpoint: e.target.value })
                }
                className="w-full rounded-lg border border-[#e4e4e7] bg-white px-3.5 py-2.5 text-[13px] text-[#18181b] outline-none transition-all duration-150 placeholder:text-[#d4d4d8] focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
              />
            </div>
            <div>
              <label className="mb-2 block text-[12px] font-medium text-[#52525b]">
                API Key
              </label>
              <input
                type="password"
                value={draft.apiKey}
                onChange={(e) =>
                  setDraft({ ...draft, apiKey: e.target.value })
                }
                placeholder="sk-..."
                className="w-full rounded-lg border border-[#e4e4e7] bg-white px-3.5 py-2.5 text-[13px] text-[#18181b] outline-none transition-all duration-150 placeholder:text-[#d4d4d8] focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
              />
            </div>
            <div>
              <label className="mb-2 block text-[12px] font-medium text-[#52525b]">
                Model
              </label>
              <input
                type="text"
                value={draft.model}
                onChange={(e) =>
                  setDraft({ ...draft, model: e.target.value })
                }
                className="w-full rounded-lg border border-[#e4e4e7] bg-white px-3.5 py-2.5 text-[13px] text-[#18181b] outline-none transition-all duration-150 placeholder:text-[#d4d4d8] focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
              />
            </div>
            <div>
              <label className="mb-2 block text-[12px] font-medium text-[#52525b]">
                Temperature{" "}
                <span className="ml-1 text-[11px] font-normal text-[#a1a1aa]">
                  {draft.temperature.toFixed(1)}
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={draft.temperature}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    temperature: parseFloat(e.target.value),
                  })
                }
                className="h-1.5 w-full accent-blue-500"
              />
              <div className="mt-2 flex justify-between text-[10px] text-[#d4d4d8]">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <button
              onClick={handleSave}
              className="cursor-pointer rounded-lg bg-[#18181b] px-5 py-2 text-[13px] font-medium text-white shadow-sm transition-colors duration-200 hover:bg-[#27272a]"
            >
              {isActive ? "Save Changes" : "Save & Activate"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
