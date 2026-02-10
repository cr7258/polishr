import { useState } from "react";
import { ProvidersPage } from "./ProvidersPage";
import { HistoryPage } from "./HistoryPage";
import { PreferencesPage } from "./PreferencesPage";
import { useSettings } from "@/hooks/useSettings";
import { useHistory } from "@/hooks/useHistory";
import { cn } from "@/lib/utils";
import {
  Server,
  Clock,
  SlidersHorizontal,
} from "lucide-react";

type Page = "providers" | "history" | "preferences";

const NAV_ITEMS: { id: Page; label: string; icon: typeof Server }[] = [
  { id: "providers", label: "Providers", icon: Server },
  { id: "history", label: "History", icon: Clock },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
];

export function DesktopApp() {
  const [page, setPage] = useState<Page>("providers");
  const {
    providers,
    activeProviderId,
    saveProviders,
    setActiveProvider,
    defaultMode,
    setDefaultMode,
  } = useSettings();
  const { records, clearHistory } = useHistory();

  return (
    <div className="flex h-screen select-none overflow-hidden bg-[#fafbfc] text-[#18181b]">
      {/* ═══════ Sidebar ═══════ */}
      <aside className="flex w-56 flex-col bg-gradient-to-b from-[#2c3e6b] to-[#263659] border-r border-white/[0.08]">
        {/* macOS drag area + Logo */}
        <div data-tauri-drag-region className="px-5 pt-5 pb-1">
          <div data-tauri-drag-region className="mb-5 h-3" />
          <div className="flex items-center gap-3">
            <img
              src="/polishr.png"
              alt="Polishr"
              className="h-9 w-9 rounded-lg shadow-lg shadow-blue-500/25"
            />
            <div>
              <div className="text-[14px] font-semibold tracking-[-0.01em] text-white">
                Polishr
              </div>
              <div className="mt-px text-[10px] font-medium text-white/25">
                Desktop
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-6 flex-1 space-y-1 px-3">
          <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/20">
            General
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={cn(
                  "relative flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 py-[10px] text-[13px] transition-all duration-150",
                  isActive
                    ? "bg-white/[0.08] text-white"
                    : "text-white/45 hover:bg-white/[0.05] hover:text-white/85",
                )}
              >
                {isActive && (
                  <div className="absolute bottom-[6px] left-0 top-[6px] w-[3px] rounded-r-[3px] bg-blue-400" />
                )}
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Version */}
        <div className="mx-3 mb-4 rounded-xl bg-white/[0.04] px-4 py-2.5">
          <span className="text-[12px] font-medium text-white/30">Polishr v0.1.0</span>
        </div>
      </aside>

      {/* ═══════ Main Content ═══════ */}
      <main className="flex-1 overflow-y-auto">
        {page === "providers" && (
          <ProvidersPage
            providers={providers}
            activeProviderId={activeProviderId}
            onSave={saveProviders}
            onSetActive={setActiveProvider}
          />
        )}
        {page === "history" && (
          <HistoryPage records={records} onClear={clearHistory} />
        )}
        {page === "preferences" && (
          <PreferencesPage
            defaultMode={defaultMode}
            onSetDefaultMode={setDefaultMode}
          />
        )}
      </main>
    </div>
  );
}
