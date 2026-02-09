import { cn } from "@/lib/utils";
import { Languages, PenLine, ArrowRightLeft } from "lucide-react";
import type { PolishMode } from "@/core/llm/types";

interface ModeSelectorProps {
  mode: PolishMode;
  onChange: (mode: PolishMode) => void;
  disabled?: boolean;
}

const MODES: { value: PolishMode; label: string; icon: typeof PenLine }[] = [
  { value: "polish-en", label: "Polish EN", icon: PenLine },
  { value: "polish-zh", label: "润色中文", icon: Languages },
  { value: "translate", label: "CN → EN", icon: ArrowRightLeft },
];

export function ModeSelector({ mode, onChange, disabled }: ModeSelectorProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-secondary p-1">
      {MODES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          disabled={disabled}
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200",
            mode === value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
