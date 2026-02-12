import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type { PolishMode } from "@/core/llm/types";
import { DiffView } from "@/components/DiffView";
import { usePolish } from "@/hooks/usePolish";
import { useSettings } from "@/hooks/useSettings";
import { useHistory } from "@/hooks/useHistory";
import {
  Loader2,
  AlertCircle,
  ShieldAlert,
  Copy,
  CheckCheck,
  SendHorizonal,
  ArrowDownToLine,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CaptureResult {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function App() {
  const [inputText, setInputText] = useState("");
  const [mode, setMode] = useState<PolishMode>("improve");
  const [accessibilityError, setAccessibilityError] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [changeInput, setChangeInput] = useState("");
  const changeInputRef = useRef<HTMLInputElement>(null);

  const { config, isConfigured, defaultMode, activeProviderId } = useSettings();
  const { addRecord } = useHistory();

  const handlePolishComplete = useCallback(
    (polishInputText: string, resultText: string, polishMode: PolishMode) => {
      addRecord({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        mode: polishMode,
        inputText: polishInputText,
        resultText,
        provider: activeProviderId,
      });
    },
    [addRecord, activeProviderId],
  );

  const {
    result,
    explanation,
    diffSegments,
    isStreaming,
    error,
    startPolish,
    cancelPolish,
    reset,
  } = usePolish(handlePolishComplete);

  // Sync mode with defaultMode from settings
  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  // Auto-polish when text is captured
  const handleCapture = useCallback(
    (text: string) => {
      setInputText(text);
      setAccessibilityError(false);
      setCopied(false);
      setChangeInput("");
      reset();
      if (isConfigured && text.trim()) {
        startPolish(text, mode, config);
      }
    },
    [isConfigured, mode, config, startPolish, reset],
  );

  // Listen for events from Rust backend
  useEffect(() => {
    const unlistenCapture = listen<CaptureResult>(
      "selection-captured",
      (event) => {
        handleCapture(event.payload.text);
      },
    );

    const unlistenError = listen<string>("capture-error", (event) => {
      if (event.payload === "accessibility_denied") {
        setAccessibilityError(true);
      }
    });

    return () => {
      unlistenCapture.then((fn) => fn());
      unlistenError.then((fn) => fn());
    };
  }, [handleCapture]);

  // Detect system dark mode
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      document.documentElement.classList.toggle("dark", media.matches);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDismiss();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleAccept = useCallback(async () => {
    if (!result || isReplacing) return;
    setIsReplacing(true);
    try {
      const win = getCurrentWindow();
      await win.hide();
      await new Promise((r) => setTimeout(r, 50));
      await invoke("replace_text", { text: result });
      console.log("[Polishr] replace_text succeeded");
      reset();
      setInputText("");
      setChangeInput("");
    } catch (err) {
      console.error("Failed to replace:", err);
      const win = getCurrentWindow();
      await win.show();
    } finally {
      setIsReplacing(false);
    }
  }, [result, reset, isReplacing]);

  const handleDismiss = useCallback(async () => {
    await invoke("dismiss");
    const win = getCurrentWindow();
    await win.hide();
    reset();
    setInputText("");
    setCopied(false);
    setChangeInput("");
  }, [reset]);

  const handleRetry = useCallback(
    (customInstruction?: string) => {
      if (inputText.trim() && isConfigured) {
        setCopied(false);
        startPolish(inputText, mode, config, customInstruction);
      }
    },
    [inputText, mode, config, isConfigured, startPolish],
  );

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy");
    }
  }, [result]);

  const handleSendChange = useCallback(() => {
    const instruction = changeInput.trim();
    if (!instruction || !inputText.trim()) return;
    handleRetry(instruction);
    setChangeInput("");
  }, [changeInput, inputText, handleRetry]);

  const showDiff = diffSegments.length > 0 && !isStreaming;
  const showStreamingResult = isStreaming && result.length > 0;

  const modeLabels: Record<PolishMode, string> = {
    improve: "Improve",
    rephrase: "Rephrase",
    translate: "Translate",
  };
  const modes: PolishMode[] = ["improve", "rephrase", "translate"];

  return (
    <div className="flex h-screen flex-col overflow-hidden rounded-lg bg-card shadow-[0_4px_24px_rgba(0,0,0,0.1)]">
      {/* ─── Top bar: "Ask for a change" input ─── */}
      <div
        data-tauri-drag-region
        className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-1.5"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground">
          <ArrowDownToLine className="h-4 w-4" />
        </div>

        <input
          ref={changeInputRef}
          type="text"
          value={changeInput}
          onChange={(e) => setChangeInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSendChange();
          }}
          placeholder="Ask for a change"
          disabled={!inputText || isStreaming}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
        />

        <button
          onClick={handleSendChange}
          disabled={!changeInput.trim() || !inputText || isStreaming}
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity duration-200 hover:opacity-90 disabled:cursor-default disabled:opacity-30"
          title="Send"
        >
          <SendHorizonal className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ─── Accessibility error ─── */}
      {accessibilityError && (
        <div className="flex items-center gap-3 bg-destructive/5 px-4 py-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
          <p className="text-xs text-muted-foreground">
            Enable Accessibility:{" "}
            <span className="font-medium text-foreground">
              System Settings &rarr; Privacy &rarr; Accessibility
            </span>
          </p>
        </div>
      )}

      {/* ─── Not configured ─── */}
      {!isConfigured && !accessibilityError && (
        <div className="flex items-center gap-2 px-4 py-3">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Open Polishr from the tray to configure your API key.
          </p>
        </div>
      )}

      {/* ─── Content area ─── */}
      {isConfigured && !accessibilityError && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Loading spinner */}
          {isStreaming && !showStreamingResult && (
            <div className="flex items-center gap-2 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-[13px] text-muted-foreground">
                Polishing...
              </span>
            </div>
          )}

          {/* Streaming raw result */}
          {showStreamingResult && !showDiff && (
            <div className="mx-4 my-2 border-l-[3px] border-primary px-4 py-0.5">
              <p className="text-[13px] leading-relaxed text-foreground">
                {result}
                <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-primary align-text-bottom" />
              </p>
            </div>
          )}

          {/* Suggestion card */}
          {showDiff && (
            <div className="mx-4 my-2 border-l-[3px] border-primary px-4 py-0.5">
              {explanation && (
                <p className="mb-1.5 text-[13px] font-bold leading-snug text-primary">
                  {explanation}
                </p>
              )}

              <DiffView segments={diffSegments} />

              {/* Action row */}
              <div className="mt-2 flex items-center">
                <button
                  onClick={handleAccept}
                  disabled={isReplacing}
                  className="cursor-pointer rounded-full border border-border px-4 py-1 text-xs font-medium text-foreground transition-colors duration-200 hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                >
                  {isReplacing ? "Replacing..." : "Accept"}
                </button>

                <div className="flex-1" />

                {/* Copy */}
                <button
                  onClick={handleCopy}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:text-foreground"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <CheckCheck className="h-4 w-4 text-primary" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-2 px-4 py-3">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="text-xs text-destructive">{error}</p>
                <button
                  onClick={() => handleRetry()}
                  className="mt-1 cursor-pointer text-xs font-medium text-primary hover:underline"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Waiting state */}
          {!result && !error && !isStreaming && !inputText && (
            <div className="flex items-center justify-center px-4 py-4">
              <p className="text-xs text-muted-foreground">
                Select text, then click the blue button or press Cmd+Option+P
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── Streaming stop bar ─── */}
      {isStreaming && (
        <div className="flex shrink-0 items-center border-t border-border px-4 py-1.5">
          <div className="flex-1" />
          <button
            onClick={cancelPolish}
            className="cursor-pointer rounded-full border border-destructive/30 px-3 py-0.5 text-xs font-medium text-destructive transition-colors duration-200 hover:bg-destructive/5"
          >
            Stop
          </button>
        </div>
      )}

      {/* ─── Bottom mode tabs ─── */}
      <div
        data-tauri-drag-region
        className="flex shrink-0 items-center gap-5 border-t border-border px-4"
      >
        {modes.map((m) => {
          const isActive = mode === m;
          return (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setCopied(false);
                setChangeInput("");
                if (inputText.trim() && isConfigured && !isStreaming) {
                  reset();
                  startPolish(inputText, m, config);
                }
              }}
              disabled={isStreaming}
              className={cn(
                "cursor-pointer border-b-2 py-2 text-[13px] transition-colors duration-200",
                isActive
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent font-normal text-muted-foreground hover:text-foreground",
                isStreaming && "pointer-events-none opacity-50",
              )}
            >
              {modeLabels[m]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
