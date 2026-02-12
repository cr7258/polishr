import { invoke } from "@tauri-apps/api/core";
import { ChevronDown, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

export function TriggerWindow() {
  const [isOpening, setIsOpening] = useState(false);
  const [showButton] = useState(true);

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
    <div className="flex h-full w-full items-center justify-center">
      <button
        onClick={handleOpenPanel}
        disabled={isOpening || !showButton}
        title="Polish selected text"
        className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-[#217DE6] text-white transition-opacity duration-150 hover:opacity-95 disabled:cursor-default disabled:opacity-70"
      >
        {isOpening ? (
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
        ) : (
          <ChevronDown className="h-2.5 w-2.5" />
        )}
      </button>
    </div>
  );
}
