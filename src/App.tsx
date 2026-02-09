import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { invoke } from "@tauri-apps/api/core";

import type { PolishMode } from "@/core/llm/types";
import { TitleBar } from "@/components/TitleBar";
import { ModeSelector } from "@/components/ModeSelector";
import { Editor } from "@/components/Editor";
import { DiffView } from "@/components/DiffView";
import { ResultPanel } from "@/components/ResultPanel";
import { Settings } from "@/components/Settings";
import { usePolish } from "@/hooks/usePolish";
import { useSettings } from "@/hooks/useSettings";
import { AccessibilityGuide } from "@/components/AccessibilityGuide";
import { Sparkles, AlertCircle, KeyRound } from "lucide-react";

export function App() {
  const [inputText, setInputText] = useState("");
  const [mode, setMode] = useState<PolishMode>("polish-en");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [capturedFromSelection, setCapturedFromSelection] = useState(false);

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

  const [accessibilityError, setAccessibilityError] = useState(false);

  // Listen for text captured from global hotkey
  useEffect(() => {
    const unlistenCapture = listen<string>("selection-captured", (event) => {
      setInputText(event.payload);
      setCapturedFromSelection(true);
      reset();
    });

    const unlistenError = listen<string>("capture-error", (event) => {
      console.error("Capture error:", event.payload);
      if (event.payload === "accessibility_denied") {
        setAccessibilityError(true);
      }
    });

    return () => {
      unlistenCapture.then((fn) => fn());
      unlistenError.then((fn) => fn());
    };
  }, [reset]);

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

  const handlePolish = useCallback(() => {
    if (!inputText.trim() || !isConfigured) return;
    startPolish(inputText, mode, config);
  }, [inputText, mode, config, isConfigured, startPolish]);

  const handleReplace = useCallback(async () => {
    console.log("[Polishr] handleReplace called", { result: result?.length, capturedFromSelection });
    if (!result || !capturedFromSelection) {
      console.log("[Polishr] handleReplace skipped: no result or not captured from selection");
      return;
    }
    try {
      console.log("[Polishr] Invoking replace_selection with", result.length, "chars");
      await invoke("replace_selection", { text: result });
      console.log("[Polishr] replace_selection succeeded");
      setCapturedFromSelection(false);
    } catch (err) {
      console.error("Failed to replace selection:", err);
      // Fallback: just copy to clipboard
      await writeText(result);
    }
  }, [result, capturedFromSelection]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await writeText(result);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [result]);

  const handleInputChange = useCallback(
    (value: string) => {
      setInputText(value);
      if (result) reset();
    },
    [result, reset],
  );

  const showDiff = diffSegments.length > 0 && !isStreaming;
  const showStreamingResult = isStreaming && result.length > 0;

  return (
    <div className="flex h-screen flex-col overflow-hidden rounded-lg border border-border">
      <TitleBar onSettingsClick={() => setSettingsOpen(true)} />
      <AccessibilityGuide forceShow={accessibilityError} />

      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
        <ModeSelector mode={mode} onChange={setMode} disabled={isStreaming} />
        <div className="flex-1" />
        <button
          onClick={isStreaming ? cancelPolish : handlePolish}
          disabled={!inputText.trim() || !isConfigured}
          className={
            isStreaming
              ? "flex cursor-pointer items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors duration-200 hover:bg-destructive/20"
              : "flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
          }
        >
          <Sparkles className="h-3.5 w-3.5" />
          {isStreaming ? "Stop" : "Polish"}
        </button>
      </div>

      {/* Main content area */}
      <div className="flex min-h-0 flex-1">
        {/* Left: Input */}
        <div className="flex flex-1 flex-col border-r border-border">
          <div className="shrink-0 px-4 pt-2.5 pb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Original
            </span>
          </div>
          <Editor
            value={inputText}
            onChange={handleInputChange}
            autoFocus
            disabled={isStreaming}
          />
        </div>

        {/* Right: Result */}
        <div className="flex flex-1 flex-col">
          <div className="shrink-0 px-4 pt-2.5 pb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {showDiff ? "Changes" : "Result"}
            </span>
          </div>

          {/* Not configured state */}
          {!isConfigured && !result && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
              <KeyRound className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                Configure your API key in Settings to get started.
              </p>
              <button
                onClick={() => setSettingsOpen(true)}
                className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
              >
                Open Settings
              </button>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-2 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {/* Diff view */}
          {showDiff && <DiffView segments={diffSegments} />}

          {/* Streaming result */}
          {showStreamingResult && !showDiff && (
            <div className="flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed text-foreground">
              {result}
              <span className="inline-block h-4 w-0.5 animate-pulse bg-primary" />
            </div>
          )}

          {/* Empty state */}
          {!result && !error && isConfigured && !isStreaming && (
            <div className="flex flex-1 items-center justify-center px-4">
              <p className="text-xs text-muted-foreground">
                Type or paste text, then click Polish.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <ResultPanel
        result={result}
        isStreaming={isStreaming}
        onReplace={handleReplace}
        onCopy={handleCopy}
        hasOriginal={capturedFromSelection}
      />

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
