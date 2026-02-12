import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ChevronDown, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export function TriggerWindow() {
  const [isOpening, setIsOpening] = useState(false);
  const [showButton, setShowButton] = useState(true);
  const showTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const unlisten = listen("trigger-appear", () => {
      setShowButton(false);
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
      }
      showTimerRef.current = window.setTimeout(() => {
        setShowButton(true);
      }, 90);
    });

    return () => {
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
      }
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleOpenPanel = useCallback(async () => {
    if (isOpening || !showButton) return;
    setIsOpening(true);
    try {
      await invoke("open_main_from_cached_selection");
    } catch (err) {
      console.error("Failed to open panel from trigger:", err);
    } finally {
      setTimeout(() => setIsOpening(false), 140);
    }
  }, [isOpening, showButton]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-transparent">
      <button
        onClick={handleOpenPanel}
        disabled={isOpening || !showButton}
        title="Polish selected text"
        className={`flex h-full w-full cursor-pointer items-center justify-center rounded-[11px] border border-white/35 bg-[#217DE6] text-white transition-opacity duration-150 focus:outline-none focus-visible:outline-none disabled:cursor-default disabled:opacity-70 ${
          showButton ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {isOpening ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
