import type { PolishMode } from "@/core/llm/types";

interface PreferencesPageProps {
  defaultMode: PolishMode;
  onSetDefaultMode: (mode: PolishMode) => void;
}

const MODE_OPTIONS: { value: PolishMode; label: string }[] = [
  { value: "improve", label: "Improve" },
  { value: "rephrase", label: "Rephrase" },
  { value: "translate", label: "Translate" },
];

export function PreferencesPage({
  defaultMode,
  onSetDefaultMode,
}: PreferencesPageProps) {
  return (
    <div className="mx-auto max-w-[640px] px-10 py-10">
      <div className="mb-8">
        <h1 className="text-[20px] font-semibold tracking-tight text-[#18181b]">
          Preferences
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#71717a]">
          Customize Polishr behavior.
        </p>
      </div>

      <div className="space-y-4">
        {/* Default Action */}
        <div className="flex items-center justify-between rounded-xl border border-[#f4f4f5] px-5 py-4">
          <div>
            <div className="text-[13px] font-medium text-[#18181b]">
              Default Action
            </div>
            <div className="mt-0.5 text-[11px] text-[#a1a1aa]">
              Action used when pressing the hotkey
            </div>
          </div>
          <select
            value={defaultMode}
            onChange={(e) =>
              onSetDefaultMode(e.target.value as PolishMode)
            }
            className="cursor-pointer rounded-lg border border-[#e4e4e7] bg-white px-3 py-1.5 text-[13px] text-[#18181b] outline-none transition-all duration-150 focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
          >
            {MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Hotkey */}
        <div className="flex items-center justify-between rounded-xl border border-[#f4f4f5] px-5 py-4">
          <div>
            <div className="text-[13px] font-medium text-[#18181b]">
              Global Hotkey
            </div>
            <div className="mt-0.5 text-[11px] text-[#a1a1aa]">
              Shortcut to activate Polishr
            </div>
          </div>
          <kbd className="rounded-lg border border-[#e4e4e7] bg-[#fafafa] px-3 py-1.5 text-[12px] font-medium text-[#52525b]">
            &#8984; &#8997; P
          </kbd>
        </div>
      </div>
    </div>
  );
}
