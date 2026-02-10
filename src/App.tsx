import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type { PolishMode } from "@/core/llm/types";
import { DiffView } from "@/components/DiffView";
import { Settings } from "@/components/Settings";
import { usePolish } from "@/hooks/usePolish";
import { useSettings } from "@/hooks/useSettings";
import {
  Settings2,
  Loader2,
  AlertCircle,
  ShieldAlert,
  Copy,
  CheckCheck,
  SendHorizonal,
  ChevronDown,
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
  const [mode, setMode] = useState<PolishMode>("polish-en");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accessibilityError, setAccessibilityError] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [changeInput, setChangeInput] = useState("");
  const changeInputRef = useRef<HTMLInputElement>(null);

  const { config, saveConfig, isConfigured } = useSettings();
  const {
    result,
    explanation,
    diffSegments,
    isStreaming,
    error,
    startPolish,
    cancelPolish,
    reset,
  } = usePolish();

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
    "polish-en": "Improve",
    "polish-zh": "中文",
    translate: "Translate",
  };
  const modes: PolishMode[] = ["polish-en", "polish-zh", "translate"];

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
      {/* ─── Top bar: "Ask for a change" input ─── */}
      <div
        data-tauri-drag-region
        className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-2"
      >
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
          title="Settings"
        >
          <ArrowDownToLine className="h-[18px] w-[18px]" />
        </button>

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
          className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
        />

        <button
          onClick={handleSendChange}
          disabled={!changeInput.trim() || !inputText || isStreaming}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity duration-200 hover:opacity-90 disabled:cursor-default disabled:opacity-30"
          title="Send"
        >
          <SendHorizonal className="h-4 w-4" />
        </button>
      </div>

      {/* ─── Accessibility error ─── */}
      {accessibilityError && (
        <div className="flex items-center gap-3 bg-destructive/5 px-5 py-3">
          <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-muted-foreground">
            Enable Accessibility:{" "}
            <span className="font-medium text-foreground">
              System Settings &rarr; Privacy &rarr; Accessibility
            </span>
          </p>
        </div>
      )}

      {/* ─── Not configured ─── */}
      {!isConfigured && !accessibilityError && (
        <div className="flex items-center gap-3 px-5 py-4">
          <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Configure your API key to get started.
          </p>
          <button
            onClick={() => setSettingsOpen(true)}
            className="ml-auto cursor-pointer rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Settings
          </button>
        </div>
      )}

      {/* ─── Content area ─── */}
      {isConfigured && !accessibilityError && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Loading spinner */}
          {isStreaming && !showStreamingResult && (
            <div className="flex items-center gap-3 px-5 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-[15px] text-muted-foreground">
                Polishing...
              </span>
            </div>
          )}

          {/* Streaming raw result */}
          {showStreamingResult && !showDiff && (
            <div className="mx-5 my-3 border-l-[3px] border-primary px-5 py-1">
              <p className="text-[15px] leading-relaxed text-foreground">
                {result}
                <span className="ml-0.5 inline-block h-[18px] w-[2px] animate-pulse bg-primary align-text-bottom" />
              </p>
            </div>
          )}

          {/* Suggestion card: accent bar + explanation + diff + actions */}
          {showDiff && (
            <div className="mx-5 my-3 border-l-[3px] border-primary px-5 py-1">
              {/* Explanation */}
              {explanation && (
                <p className="mb-2 text-[15px] font-bold leading-snug text-primary">
                  {explanation}
                </p>
              )}

              {/* Diff */}
              <DiffView segments={diffSegments} />

              {/* Action row */}
              <div className="mt-3 flex items-center">
                {/* Accept — outlined pill */}
                <button
                  onClick={handleAccept}
                  disabled={isReplacing}
                  className="cursor-pointer rounded-full border border-border px-5 py-1.5 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                >
                  {isReplacing ? "Replacing..." : "Accept"}
                </button>

                <div className="flex-1" />

                {/* Copy */}
                <button
                  onClick={handleCopy}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:text-foreground"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <CheckCheck className="h-[18px] w-[18px] text-primary" />
                  ) : (
                    <Copy className="h-[18px] w-[18px]" />
                  )}
                </button>

                {/* Settings dropdown */}
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="flex cursor-pointer items-center gap-0.5 rounded-lg px-1.5 py-1.5 text-muted-foreground transition-colors duration-200 hover:text-foreground"
                  title="Settings"
                >
                  <Settings2 className="h-[18px] w-[18px]" />
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-3 px-5 py-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="text-sm text-destructive">{error}</p>
                <button
                  onClick={() => handleRetry()}
                  className="mt-1 cursor-pointer text-sm font-medium text-primary hover:underline"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Waiting state — no text captured yet */}
          {!result && !error && !isStreaming && !inputText && (
            <div className="flex items-center justify-center px-5 py-6">
              <p className="text-sm text-muted-foreground">
                Select text and press Cmd+Option+P
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── Streaming stop bar ─── */}
      {isStreaming && (
        <div className="flex shrink-0 items-center border-t border-border px-5 py-2">
          <div className="flex-1" />
          <button
            onClick={cancelPolish}
            className="cursor-pointer rounded-full border border-destructive/30 px-4 py-1 text-sm font-medium text-destructive transition-colors duration-200 hover:bg-destructive/5"
          >
            Stop
          </button>
        </div>
      )}

      {/* ─── Bottom mode tabs (also draggable) ─── */}
      <div
        data-tauri-drag-region
        className="flex shrink-0 items-center gap-7 border-t border-border px-5"
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
                "cursor-pointer border-b-2 py-2.5 text-[14px] transition-colors duration-200",
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

      {/* ─── Settings modal ─── */}
      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={config}
        onSave={saveConfig}
      />
    </div>
  );
}
