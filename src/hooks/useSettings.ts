import { useState, useEffect, useCallback } from "react";
import { load } from "@tauri-apps/plugin-store";
import type { PolishrConfig } from "@/core/llm/types";
import { DEFAULT_CONFIG } from "@/core/llm/types";

const STORE_PATH = "settings.json";

const STORE_OPTIONS = {
  defaults: {
    apiEndpoint: DEFAULT_CONFIG.apiEndpoint,
    apiKey: DEFAULT_CONFIG.apiKey,
    model: DEFAULT_CONFIG.model,
    temperature: DEFAULT_CONFIG.temperature,
  },
  autoSave: true as const,
};

export function useSettings() {
  const [config, setConfig] = useState<PolishrConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const store = await load(STORE_PATH, STORE_OPTIONS);
        const apiEndpoint = await store.get<string>("apiEndpoint");
        const apiKey = await store.get<string>("apiKey");
        const model = await store.get<string>("model");
        const temperature = await store.get<number>("temperature");

        if (!cancelled) {
          setConfig({
            apiEndpoint: apiEndpoint ?? DEFAULT_CONFIG.apiEndpoint,
            apiKey: apiKey ?? DEFAULT_CONFIG.apiKey,
            model: model ?? DEFAULT_CONFIG.model,
            temperature: temperature ?? DEFAULT_CONFIG.temperature,
          });
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

  const saveConfig = useCallback(async (newConfig: PolishrConfig) => {
    try {
      const store = await load(STORE_PATH, STORE_OPTIONS);
      await store.set("apiEndpoint", newConfig.apiEndpoint);
      await store.set("apiKey", newConfig.apiKey);
      await store.set("model", newConfig.model);
      await store.set("temperature", newConfig.temperature);
      await store.save();
      setConfig(newConfig);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  }, []);

  const isConfigured = config.apiKey.length > 0;

  return { config, saveConfig, loading, isConfigured };
}
