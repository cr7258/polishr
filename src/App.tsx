import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type { PolishMode } from "@/core/llm/types";
import { DiffView } from "@/components/DiffView";
import { Settings } from "@/components/Settings";
import { usePolish } from "@/hooks/usePolish";
import { useSettings } from "@/hooks/useSettings";
import {
  Sparkles,
  Check,
  X,
  Settings2,
  Loader2,
  AlertCircle,
  PenLine,
  Languages,
  ArrowRightLeft,
  ShieldAlert,
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

  const { config, saveConfig, isConfigured } = useSettings();
  const {
    result,
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
      reset();
      // Auto-start polishing if configured
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
      // Hide the panel FIRST — the replace command will activate the
      // original app and paste, so our panel must not be in the way
      const win = getCurrentWindow();
      await win.hide();
      // Small delay to ensure the panel is fully hidden
      await new Promise((r) => setTimeout(r, 50));
      // Replace text via clipboard + paste in the original app
      await invoke("replace_text", { text: result });
      console.log("[Polishr] replace_text succeeded");
      reset();
      setInputText("");
    } catch (err) {
      console.error("Failed to replace:", err);
      // Show the panel again if replace failed
      const win = getCurrentWindow();
      await win.show();
    } finally {
      setIsReplacing(false);
    }
  }, [result, reset, isReplacing]);

  const handleDismiss = useCallback(async () => {
    // Clear the stored element reference
    await invoke("dismiss");
    const win = getCurrentWindow();
    await win.hide();
    reset();
    setInputText("");
  }, [reset]);

  const handleRetry = useCallback(() => {
    if (inputText.trim() && isConfigured) {
      startPolish(inputText, mode, config);
    }
  }, [inputText, mode, config, isConfigured, startPolish]);

  const showDiff = diffSegments.length > 0 && !isStreaming;
  const showStreamingResult = isStreaming && result.length > 0;
  const hasResult = result.length > 0 && !isStreaming;

  const modeIcons: Record<PolishMode, typeof PenLine> = {
    "polish-en": PenLine,
    "polish-zh": Languages,
    translate: ArrowRightLeft,
  };
  const modeLabels: Record<PolishMode, string> = {
    "polish-en": "EN",
    "polish-zh": "中",
    translate: "译",
  };
  const modes: PolishMode[] = ["polish-en", "polish-zh", "translate"];

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      {/* Header bar */}
      <div
        data-tauri-drag-region
        className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2"
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">Polishr</span>

        <div className="flex-1" />

        {/* Compact mode switcher */}
        <div className="flex gap-0.5 rounded-md bg-secondary p-0.5">
          {modes.map((m) => {
            const Icon = modeIcons[m];
            return (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  if (inputText.trim() && isConfigured && !isStreaming) {
                    reset();
                    startPolish(inputText, m, config);
                  }
                }}
                disabled={isStreaming}
                title={m}
                className={cn(
                  "flex cursor-pointer items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-medium transition-all duration-200",
                  mode === m
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                  isStreaming && "pointer-events-none opacity-50",
                )}
              >
                <Icon className="h-3 w-3" />
                {modeLabels[m]}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setSettingsOpen(true)}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
          title="Settings"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={handleDismiss}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
          title="Dismiss (Esc)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Accessibility error */}
      {accessibilityError && (
        <div className="flex items-center gap-2 border-b border-border bg-destructive/5 px-3 py-2">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-destructive" />
          <p className="text-[11px] text-muted-foreground">
            Enable Accessibility:{" "}
            <span className="font-medium text-foreground">
              System Settings &rarr; Privacy &rarr; Accessibility
            </span>
          </p>
        </div>
      )}

      {/* Not configured */}
      {!isConfigured && !accessibilityError && (
        <div className="flex items-center gap-2 px-3 py-3">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground">
            Configure your API key to get started.
          </p>
          <button
            onClick={() => setSettingsOpen(true)}
            className="ml-auto cursor-pointer rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
          >
            Settings
          </button>
        </div>
      )}

      {/* Content area */}
      {isConfigured && !accessibilityError && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Loading state */}
          {isStreaming && !showStreamingResult && (
            <div className="flex items-center gap-2 px-3 py-4">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">
                Polishing...
              </span>
            </div>
          )}

          {/* Streaming result */}
          {showStreamingResult && !showDiff && (
            <div className="px-3 py-3 text-sm leading-relaxed text-foreground">
              {result}
              <span className="inline-block h-4 w-0.5 animate-pulse bg-primary" />
            </div>
          )}

          {/* Diff view */}
          {showDiff && <DiffView segments={diffSegments} />}

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-3">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="text-xs text-destructive">{error}</p>
                <button
                  onClick={handleRetry}
                  className="mt-1 cursor-pointer text-[11px] font-medium text-primary hover:underline"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Empty / waiting state */}
          {!result && !error && !isStreaming && inputText && (
            <div className="flex items-center justify-center px-3 py-4">
              <p className="text-xs text-muted-foreground">
                Ready to polish. Press the button below.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      {isConfigured && !accessibilityError && (
        <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2">
          {/* Original text preview */}
          {inputText && (
            <span className="max-w-[180px] truncate text-[11px] text-muted-foreground">
              {inputText}
            </span>
          )}

          <div className="flex-1" />

          {isStreaming && (
            <button
              onClick={cancelPolish}
              className="flex cursor-pointer items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive transition-colors duration-200 hover:bg-destructive/20"
            >
              Stop
            </button>
          )}

          {!isStreaming && !hasResult && inputText && (
            <button
              onClick={handleRetry}
              className="flex cursor-pointer items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
            >
              <Sparkles className="h-3 w-3" />
              Polish
            </button>
          )}

          {hasResult && (
            <>
              <button
                onClick={handleDismiss}
                className="flex cursor-pointer items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors duration-200 hover:bg-accent"
              >
                <X className="h-3 w-3" />
                Dismiss
              </button>
              <button
                onClick={handleAccept}
                disabled={isReplacing}
                className="flex cursor-pointer items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              >
                <Check className="h-3 w-3" />
                {isReplacing ? "Replacing..." : "Accept"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Settings modal */}
      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={config}
        onSave={saveConfig}
      />
    </div>
  );
}
