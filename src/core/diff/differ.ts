import DiffMatchPatch from "diff-match-patch";

export type DiffType = "equal" | "insert" | "delete";

export interface DiffSegment {
  type: DiffType;
  text: string;
}

const dmp = new DiffMatchPatch();

/**
 * Compute an inline diff between original and polished text.
 * Returns an array of segments, each tagged as equal / insert / delete.
 */
export function computeDiff(
  original: string,
  polished: string,
): DiffSegment[] {
  const diffs = dmp.diff_main(original, polished);
  dmp.diff_cleanupSemantic(diffs);

  return diffs.map(([op, text]) => ({
    type: op === 0 ? "equal" : op === 1 ? "insert" : "delete",
    text,
  }));
}

/**
 * Check if there are any actual changes between original and polished text.
 */
export function hasChanges(segments: DiffSegment[]): boolean {
  return segments.some((s) => s.type !== "equal");
}
