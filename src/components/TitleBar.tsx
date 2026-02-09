import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, X, Settings as SettingsIcon } from "lucide-react";

interface TitleBarProps {
  onSettingsClick: () => void;
}

export function TitleBar({ onSettingsClick }: TitleBarProps) {
  const appWindow = getCurrentWindow();

  return (
    <div
      data-tauri-drag-region
      className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-card px-3"
    >
      {/* App title */}
      <div data-tauri-drag-region className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          P
        </div>
        <span
          data-tauri-drag-region
          className="text-sm font-semibold text-foreground"
        >
          Polishr
        </span>
      </div>

      {/* Window controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onSettingsClick}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
          aria-label="Settings"
        >
          <SettingsIcon className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => appWindow.minimize()}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
          aria-label="Minimize"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => appWindow.hide()}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-destructive/10 hover:text-destructive"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
