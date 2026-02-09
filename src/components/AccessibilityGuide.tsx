import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ShieldAlert, ExternalLink } from "lucide-react";

export function AccessibilityGuide({ forceShow = false }: { forceShow?: boolean }) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const result = await invoke<boolean>("check_accessibility_permission");
        setHasPermission(result);
      } catch {
        // If the command fails, assume permission is fine (non-macOS)
        setHasPermission(true);
      }
    }

    check();
  }, []);

  // Show when forced (accessibility error from hotkey) or when permission check fails
  const shouldShow = forceShow || hasPermission === false;

  if (!shouldShow || dismissed) {
    return null;
  }

  return (
    <div className="flex items-start gap-3 border-b border-border bg-destructive/5 px-4 py-3">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="flex-1 space-y-1">
        <p className="text-xs font-medium text-foreground">
          Accessibility Permission Required
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Polishr needs Accessibility access to capture and replace text in other
          apps. Go to{" "}
          <span className="font-medium text-foreground">
            System Settings &rarr; Privacy &amp; Security &rarr; Accessibility
          </span>{" "}
          and enable Polishr.
        </p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => {
              // Open macOS Accessibility settings
              invoke("plugin:opener|open_url", {
                url: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
              }).catch(() => {});
            }}
            className="flex cursor-pointer items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
          >
            <ExternalLink className="h-3 w-3" />
            Open Settings
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
