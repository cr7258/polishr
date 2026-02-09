import type { DiffSegment } from "@/core/diff/differ";

interface DiffViewProps {
  segments: DiffSegment[];
}

export function DiffView({ segments }: DiffViewProps) {
  if (segments.length === 0) {
    return null;
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed">
      {segments.map((segment, i) => {
        if (segment.type === "equal") {
          return <span key={i}>{segment.text}</span>;
        }
        if (segment.type === "delete") {
          return (
            <span
              key={i}
              className="rounded-sm bg-diff-delete-bg text-diff-delete-text line-through decoration-diff-delete-text/50"
            >
              {segment.text}
            </span>
          );
        }
        // insert
        return (
          <span
            key={i}
            className="rounded-sm bg-diff-insert-bg text-diff-insert-text"
          >
            {segment.text}
          </span>
        );
      })}
    </div>
  );
}
