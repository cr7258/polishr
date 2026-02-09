import { useState, useCallback, useRef } from "react";
import type { PolishrConfig, PolishMode } from "@/core/llm/types";
import { polishStream, PolishError } from "@/core/llm/client";
import { computeDiff, type DiffSegment } from "@/core/diff/differ";

interface UsePolishReturn {
  result: string;
  diffSegments: DiffSegment[];
  isStreaming: boolean;
  error: string | null;
  startPolish: (text: string, mode: PolishMode, config: PolishrConfig) => void;
  cancelPolish: () => void;
  reset: () => void;
}

export function usePolish(): UsePolishReturn {
  const [result, setResult] = useState("");
  const [diffSegments, setDiffSegments] = useState<DiffSegment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancelPolish = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    cancelPolish();
    setResult("");
    setDiffSegments([]);
    setError(null);
  }, [cancelPolish]);

  const startPolish = useCallback(
    async (text: string, mode: PolishMode, config: PolishrConfig) => {
      // Cancel any in-flight request
      cancelPolish();

      setResult("");
      setDiffSegments([]);
      setError(null);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      let accumulated = "";

      try {
        for await (const token of polishStream(
          text,
          mode,
          config,
          controller.signal,
        )) {
          accumulated += token;
          setResult(accumulated);
        }

        // Compute diff once streaming is complete
        const segments = computeDiff(text, accumulated);
        setDiffSegments(segments);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled, not an error
          return;
        }
        if (err instanceof PolishError) {
          setError(err.message);
        } else {
          setError(
            err instanceof Error ? err.message : "An unknown error occurred",
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [cancelPolish],
  );

  return {
    result,
    diffSegments,
    isStreaming,
    error,
    startPolish,
    cancelPolish,
    reset,
  };
}
