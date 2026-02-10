import { useState, useMemo } from "react";
import type { HistoryRecord, PolishMode } from "@/core/llm/types";
import { Search, Clipboard, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoryPageProps {
  records: HistoryRecord[];
  onClear: () => void;
}

const MODE_STYLES: Record<PolishMode, { bg: string; text: string }> = {
  improve: { bg: "bg-blue-50", text: "text-blue-600" },
  rephrase: { bg: "bg-violet-50", text: "text-violet-600" },
  translate: { bg: "bg-emerald-50", text: "text-emerald-600" },
};

const MODE_LABELS: Record<PolishMode, string> = {
  improve: "Improve",
  rephrase: "Rephrase",
  translate: "Translate",
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function HistoryPage({ records, onClear }: HistoryPageProps) {
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return records;
    const q = query.toLowerCase();
    return records.filter(
      (r) =>
        r.inputText.toLowerCase().includes(q) ||
        r.resultText.toLowerCase().includes(q),
    );
  }, [records, query]);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      console.error("Failed to copy");
    }
  };

  return (
    <div className="mx-auto max-w-[640px] px-10 py-10">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-[#18181b]">
            History
          </h1>
          <p className="mt-1.5 text-[13px] text-[#71717a]">
            Your recent polishing sessions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {records.length > 0 && (
            <button
              onClick={onClear}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#a1a1aa] transition-colors duration-200 hover:bg-[#f4f4f5] hover:text-[#18181b]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#a1a1aa]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search history..."
              className="w-52 rounded-lg border border-[#e4e4e7] bg-white py-2 pl-9 pr-3 text-[13px] text-[#18181b] outline-none transition-all duration-150 placeholder:text-[#d4d4d8] focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
            />
          </div>
        </div>
      </div>

      {/* Empty state */}
      {records.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-[14px] text-[#a1a1aa]">No history yet</p>
          <p className="mt-1 text-[12px] text-[#d4d4d8]">
            Polish some text with Cmd+Option+P to get started.
          </p>
        </div>
      )}

      {/* History list */}
      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#f4f4f5]">
          {filtered.map((record, i) => {
            const style = MODE_STYLES[record.mode];
            return (
              <div
                key={record.id}
                className={cn(
                  "group cursor-default px-5 py-4 transition-colors duration-100 hover:bg-[#f8fafc]",
                  i < filtered.length - 1 && "border-b border-[#f4f4f5]",
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold",
                      style.bg,
                      style.text,
                    )}
                  >
                    {MODE_LABELS[record.mode]}
                  </span>
                  <span className="text-[11px] text-[#d4d4d8]">&middot;</span>
                  <span className="text-[11px] text-[#a1a1aa]">
                    {timeAgo(record.timestamp)}
                  </span>
                  <div className="ml-auto flex opacity-0 transition-opacity duration-100 group-hover:opacity-100">
                    <button
                      onClick={() => handleCopy(record.resultText, record.id)}
                      className="cursor-pointer rounded-md p-1 text-[#a1a1aa] transition-colors duration-150 hover:bg-[#f4f4f5] hover:text-[#18181b]"
                      title="Copy result"
                    >
                      <Clipboard className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="truncate text-[13px] leading-relaxed text-[#a1a1aa]">
                  {record.inputText}
                </p>
                <p className="mt-1 truncate text-[13px] leading-relaxed text-[#18181b]">
                  {copiedId === record.id ? "Copied!" : record.resultText}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* No results for search */}
      {filtered.length === 0 && records.length > 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-[14px] text-[#a1a1aa]">No results found</p>
          <p className="mt-1 text-[12px] text-[#d4d4d8]">
            Try a different search term.
          </p>
        </div>
      )}
    </div>
  );
}
