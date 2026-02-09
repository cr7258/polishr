import { Copy, Replace, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResultPanelProps {
  result: string;
  isStreaming: boolean;
  onReplace: () => void;
  onCopy: () => void;
  hasOriginal: boolean;
}

export function ResultPanel({
  result,
  isStreaming,
  onReplace,
  onCopy,
  hasOriginal,
}: ResultPanelProps) {
  const hasResult = result.length > 0;

  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2.5">
      {isStreaming && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Polishing...</span>
        </div>
      )}

      <div className="flex-1" />

      <button
        onClick={onCopy}
        disabled={!hasResult || isStreaming}
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200",
          "border border-border text-foreground hover:bg-accent",
          (!hasResult || isStreaming) && "pointer-events-none opacity-40",
        )}
      >
        <Copy className="h-3.5 w-3.5" />
        Copy
      </button>

      <button
        onClick={onReplace}
        disabled={!hasResult || isStreaming || !hasOriginal}
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          (!hasResult || isStreaming || !hasOriginal) &&
            "pointer-events-none opacity-40",
        )}
      >
        <Replace className="h-3.5 w-3.5" />
        Replace
      </button>
    </div>
  );
}
