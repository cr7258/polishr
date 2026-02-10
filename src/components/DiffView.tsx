import type { DiffSegment } from "@/core/diff/differ";

interface DiffViewProps {
  segments: DiffSegment[];
}

export function DiffView({ segments }: DiffViewProps) {
  if (segments.length === 0) {
    return null;
  }

  return (
    <div className="text-[13px] leading-relaxed text-foreground">
      {segments.map((segment, i) => {
        if (segment.type === "equal") {
          return <span key={i}>{segment.text}</span>;
        }
        if (segment.type === "delete") {
          return (
            <span
              key={i}
              className="rounded-sm bg-diff-delete-bg text-diff-delete-text line-through"
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
