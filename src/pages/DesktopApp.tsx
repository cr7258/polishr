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
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/25">
              <svg
                className="h-[18px] w-[18px] text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"
                />
              </svg>
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#2c3e6b] bg-emerald-400" />
            </div>
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
        <div className="px-5 py-4">
          <div className="text-[11px] text-white/25">v0.1.0</div>
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
