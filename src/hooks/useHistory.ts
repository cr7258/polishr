import { useState, useEffect, useCallback } from "react";
import { load } from "@tauri-apps/plugin-store";
import type { HistoryRecord } from "@/core/llm/types";

const STORE_PATH = "history.json";
const MAX_RECORDS = 200;

const STORE_OPTIONS = {
  defaults: {
    records: [] as HistoryRecord[],
  },
  autoSave: true as const,
};

export function useHistory() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const store = await load(STORE_PATH, STORE_OPTIONS);
        const saved = await store.get<HistoryRecord[]>("records");
        if (!cancelled && saved) {
          setRecords(saved);
        }
      } catch (err) {
        console.error("Failed to load history:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  const addRecord = useCallback(async (record: HistoryRecord) => {
    try {
      const store = await load(STORE_PATH, STORE_OPTIONS);
      const existing = (await store.get<HistoryRecord[]>("records")) ?? [];
      const updated = [record, ...existing].slice(0, MAX_RECORDS);
      await store.set("records", updated);
      await store.save();
      setRecords(updated);
    } catch (err) {
      console.error("Failed to save history record:", err);
    }
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      const store = await load(STORE_PATH, STORE_OPTIONS);
      await store.set("records", []);
      await store.save();
      setRecords([]);
    } catch (err) {
      console.error("Failed to clear history:", err);
    }
  }, []);

  return { records, loading, addRecord, clearHistory };
}
