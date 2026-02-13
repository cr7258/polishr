import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ChevronDown, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type TriggerMode = "selection" | "paragraph";

export function TriggerWindow() {
  const [isOpening, setIsOpening] = useState(false);
  const [mode, setMode] = useState<TriggerMode>("selection");
  const [isHovered, setIsHovered] = useState(false);
  const [isMultiLine, setIsMultiLine] = useState(false);

  // Listen for mode changes from the Rust poller
  useEffect(() => {
    const unlisten = listen<string>("trigger-mode", (event) => {
      setMode(event.payload as TriggerMode);
      // Reset hover when mode changes
      setIsHovered(false);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Track multi-line via window dimensions
  useEffect(() => {
    const check = () => setIsMultiLine(window.innerHeight > window.innerWidth + 2);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleClick = useCallback(async () => {
    if (isOpening) return;
    setIsOpening(true);
    try {
      if (mode === "paragraph") {
        await invoke("select_paragraph_and_open");
      } else {
        await invoke("open_main_from_cached_selection");
      }
    } catch (err) {
      console.error("Failed to open panel from trigger:", err);
    } finally {
      setTimeout(() => setIsOpening(false), 140);
    }
  }, [isOpening, mode]);

  const handleMouseEnter = useCallback(async () => {
    setIsHovered(true);
    try {
      await invoke("expand_trigger");
    } catch {
      // ignore
    }
  }, []);

  const handleMouseLeave = useCallback(async () => {
    setIsHovered(false);
    try {
      await invoke("shrink_trigger");
    } catch {
      // ignore
    }
  }, []);

  // --- Paragraph mode: animated gray line → white button ---
  if (mode === "paragraph") {
    const expanded = isHovered;
    return (
      <div
        className="flex items-center justify-center"
        style={{ width: "100vw", height: "100vh" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={expanded ? handleClick : undefined}
      >
        <div
          className={`flex items-center justify-center transition-colors duration-150 ease-out ${expanded ? "cursor-pointer border border-gray-200 bg-white text-gray-500 shadow-sm" : "bg-gray-300"} ${expanded ? (isMultiLine ? "rounded-[8px]" : "rounded-full") : "rounded-full"}`}
          style={{
            width: "100vw",
            height: "100vh",
          }}
        >
          <span
            className="flex items-center justify-center transition-opacity duration-150"
            style={{ opacity: expanded ? 1 : 0 }}
          >
            {isOpening ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <ChevronDown className="h-2.5 w-2.5" />
            )}
          </span>
        </div>
      </div>
    );
  }

  // --- Selection mode: blue button ---
  return (
    <button
      onClick={handleClick}
      disabled={isOpening}
      title="Polish selected text"
      className={`flex cursor-pointer items-center justify-center bg-[#217DE6] text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-default disabled:opacity-70 ${isMultiLine ? "rounded-[8px]" : "rounded-full"}`}
      style={{ width: "100vw", height: "100vh" }}
    >
      {isOpening ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
      ) : (
        <ChevronDown className="h-2.5 w-2.5" />
      )}
    </button>
  );
}
