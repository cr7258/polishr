import { useState, useEffect, useCallback } from "react";
import { load } from "@tauri-apps/plugin-store";
import type {
  PolishrConfig,
  PolishMode,
  Provider,
} from "@/core/llm/types";
import { DEFAULT_CONFIG, PROVIDER_PRESETS } from "@/core/llm/types";

const STORE_PATH = "settings.json";

const STORE_OPTIONS = {
  defaults: {
    providers: [] as Provider[],
    activeProviderId: "",
    defaultMode: "improve" as PolishMode,
    // Legacy flat keys for backward compatibility
    apiEndpoint: DEFAULT_CONFIG.apiEndpoint,
    apiKey: DEFAULT_CONFIG.apiKey,
    model: DEFAULT_CONFIG.model,
    temperature: DEFAULT_CONFIG.temperature,
  },
  autoSave: true as const,
};

export function useSettings() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeProviderId, setActiveProviderId] = useState("");
  const [defaultMode, setDefaultModeState] = useState<PolishMode>("improve");
  const [loading, setLoading] = useState(true);

  // Derive config from active provider
  const activeProvider = providers.find((p) => p.id === activeProviderId);
  const config: PolishrConfig = activeProvider
    ? {
        apiEndpoint: activeProvider.endpoint,
        apiKey: activeProvider.apiKey,
        model: activeProvider.model,
        temperature: activeProvider.temperature,
      }
    : DEFAULT_CONFIG;

  const isConfigured = config.apiKey.length > 0;

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const store = await load(STORE_PATH, STORE_OPTIONS);

        const savedProviders = await store.get<Provider[]>("providers");
        const savedActiveId = await store.get<string>("activeProviderId");
        const savedMode = await store.get<PolishMode>("defaultMode");

        // Migrate from legacy flat config if no providers saved
        if (!savedProviders || savedProviders.length === 0) {
          const legacyKey = await store.get<string>("apiKey");
          const legacyEndpoint = await store.get<string>("apiEndpoint");
          const legacyModel = await store.get<string>("model");
          const legacyTemp = await store.get<number>("temperature");

          if (legacyKey && legacyKey.length > 0) {
            // Find matching preset or create custom
            const matchedPreset = PROVIDER_PRESETS.find(
              (p) => p.endpoint === legacyEndpoint,
            );
            const migratedProvider: Provider = {
              id: matchedPreset?.id ?? "custom",
              name: matchedPreset?.name ?? "Custom",
              endpoint: legacyEndpoint ?? DEFAULT_CONFIG.apiEndpoint,
              apiKey: legacyKey,
              model: legacyModel ?? DEFAULT_CONFIG.model,
              temperature: legacyTemp ?? DEFAULT_CONFIG.temperature,
            };
            if (!cancelled) {
              setProviders([migratedProvider]);
              setActiveProviderId(migratedProvider.id);
              // Persist migration
              await store.set("providers", [migratedProvider]);
              await store.set("activeProviderId", migratedProvider.id);
              await store.save();
            }
          }
        } else if (!cancelled) {
          setProviders(savedProviders);
          setActiveProviderId(savedActiveId ?? "");
        }

        if (!cancelled && savedMode) {
          setDefaultModeState(savedMode);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveProviders = useCallback(
    async (newProviders: Provider[], newActiveId?: string) => {
      try {
        const store = await load(STORE_PATH, STORE_OPTIONS);
        await store.set("providers", newProviders);
        if (newActiveId !== undefined) {
          await store.set("activeProviderId", newActiveId);
          setActiveProviderId(newActiveId);
        }
        await store.save();
        setProviders(newProviders);
      } catch (err) {
        console.error("Failed to save providers:", err);
      }
    },
    [],
  );

  const setActiveProvider = useCallback(async (id: string) => {
    try {
      const store = await load(STORE_PATH, STORE_OPTIONS);
      await store.set("activeProviderId", id);
      await store.save();
      setActiveProviderId(id);
    } catch (err) {
      console.error("Failed to set active provider:", err);
    }
  }, []);

  const setDefaultMode = useCallback(async (mode: PolishMode) => {
    try {
      const store = await load(STORE_PATH, STORE_OPTIONS);
      await store.set("defaultMode", mode);
      await store.save();
      setDefaultModeState(mode);
    } catch (err) {
      console.error("Failed to set default mode:", err);
    }
  }, []);

  // Legacy saveConfig for backward compatibility
  const saveConfig = useCallback(
    async (newConfig: PolishrConfig) => {
      const updated = providers.map((p) =>
        p.id === activeProviderId
          ? {
              ...p,
              endpoint: newConfig.apiEndpoint,
              apiKey: newConfig.apiKey,
              model: newConfig.model,
              temperature: newConfig.temperature,
            }
          : p,
      );
      await saveProviders(updated);
    },
    [providers, activeProviderId, saveProviders],
  );

  return {
    config,
    saveConfig,
    loading,
    isConfigured,
    providers,
    activeProviderId,
    activeProvider,
    saveProviders,
    setActiveProvider,
    defaultMode,
    setDefaultMode,
  };
}
