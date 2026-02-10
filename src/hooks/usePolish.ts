import { useState, useCallback, useRef } from "react";
import type { PolishrConfig, PolishMode } from "@/core/llm/types";
import { polishStream, PolishError } from "@/core/llm/client";
import { computeDiff, type DiffSegment } from "@/core/diff/differ";
import { detectLanguage } from "@/core/lang/detect";

/**
 * Parse the LLM response into explanation + polished text.
 *
 * Expected format:
 *   <explanation>\n\n<polished text>
 *
 * Falls back gracefully: if no blank-line separator is found the
 * whole response is treated as the polished text with no explanation.
 */
function parseResponse(raw: string): { explanation: string; text: string } {
  const idx = raw.indexOf("\n\n");
  if (idx === -1) {
    return { explanation: "", text: raw.trim() };
  }
  const explanation = raw.slice(0, idx).trim();
  const text = raw.slice(idx + 2).trim();
  // Guard: if the "explanation" is suspiciously long it probably isn't one
  if (explanation.length > 60) {
    return { explanation: "", text: raw.trim() };
  }
  return { explanation, text };
}

/** Callback invoked when a polish completes successfully. */
export type OnPolishComplete = (
  inputText: string,
  resultText: string,
  mode: PolishMode,
) => void;

interface UsePolishReturn {
  /** The clean polished text (explanation stripped) */
  result: string;
  /** Short explanation of what was changed */
  explanation: string;
  diffSegments: DiffSegment[];
  isStreaming: boolean;
  error: string | null;
  startPolish: (
    text: string,
    mode: PolishMode,
    config: PolishrConfig,
    customInstruction?: string,
  ) => void;
  cancelPolish: () => void;
  reset: () => void;
}

export function usePolish(onComplete?: OnPolishComplete): UsePolishReturn {
  const [result, setResult] = useState("");
  const [explanation, setExplanation] = useState("");
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
    setExplanation("");
    setDiffSegments([]);
    setError(null);
  }, [cancelPolish]);

  const startPolish = useCallback(
    async (
      text: string,
      mode: PolishMode,
      config: PolishrConfig,
      customInstruction?: string,
    ) => {
      cancelPolish();

      setResult("");
      setExplanation("");
      setDiffSegments([]);
      setError(null);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const lang = detectLanguage(text);

      let accumulated = "";

      try {
        for await (const token of polishStream(
          text,
          mode,
          lang,
          config,
          controller.signal,
          customInstruction,
        )) {
          accumulated += token;
          setResult(accumulated);
        }

        // Parse the complete response
        const { explanation: exp, text: polished } =
          parseResponse(accumulated);
        setExplanation(exp);
        setResult(polished);

        // Compute diff on the clean polished text
        const segments = computeDiff(text, polished);
        setDiffSegments(segments);

        // Notify completion for history saving
        onComplete?.(text, polished, mode);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
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
    [cancelPolish, onComplete],
  );

  return {
    result,
    explanation,
    diffSegments,
    isStreaming,
    error,
    startPolish,
    cancelPolish,
    reset,
  };
}
