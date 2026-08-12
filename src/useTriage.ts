import { useCallback, useEffect, useState } from "react";
import { MINUTE_MS } from "../shared/constants";
import type { View } from "../shared/types";
import { api, type SourceWithCount } from "./api";
import { applySettings } from "./settings";
import { invalidateStats } from "./statsData";
import { enrich } from "./triage";
import type { SnoozeChoice, TriageItem } from "./types";

const REFETCH_MS = MINUTE_MS;

const ITEM_LIMIT = "1000";

export interface Triage {
  items: TriageItem[];
  sources: SourceWithCount[];
  views: View[];
  loading: boolean;
  syncing: boolean;
  error: string | undefined;
  lastSyncedAt: string | undefined;
  reload: () => void;
  syncNow: () => void;
  snooze: (item: TriageItem, choice: SnoozeChoice) => void;
  wake: (item: TriageItem) => void;
  flag: (item: TriageItem) => void;
  unflag: (item: TriageItem) => void;
}

const messageOf = (caught: unknown) =>
  caught instanceof Error ? caught.message : String(caught);

export const useTriage = (): Triage => {
  const [items, setItems] = useState<TriageItem[]>([]);
  const [sources, setSources] = useState<SourceWithCount[]>([]);
  const [views, setViews] = useState<View[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const [loadedSettings, loadedSources, rawItems, loadedViews, states] = await Promise.all([
        api.settings(),
        api.sources(),
        api.items({ state: "open", limit: ITEM_LIMIT }),
        api.views(),
        api.itemStates(),
      ]);
      const priorityBySource = new Map(loadedSources.map((source) => [source.id, source.priority]));
      const stateByItem = new Map(states.map((state) => [state.itemId, state]));

      applySettings(loadedSettings);
      setSources(loadedSources);
      setViews(loadedViews);
      setItems(rawItems.map((item) => enrich(item, priorityBySource, stateByItem)));
      setError(undefined);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFETCH_MS);

    return () => clearInterval(timer);
  }, [load]);

  const syncNow = async () => {
    setSyncing(true);
    setError(undefined);

    try {
      const result = await api.sync();

      if (result.errors.length) {
        setError(result.errors.join("; "));
      }

      invalidateStats();
      await load();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setSyncing(false);
    }
  };

  const mutate = async (action: Promise<unknown>) => {
    try {
      await action;
      await load();
    } catch (caught) {
      setError(messageOf(caught));
    }
  };

  const syncTimes = sources.flatMap((source) => (source.lastSyncedAt ? [source.lastSyncedAt] : []));

  return {
    items,
    sources,
    views,
    loading,
    syncing,
    error,
    lastSyncedAt: syncTimes.reduce<string | undefined>(
      (latest, time) => (latest !== undefined && latest > time ? latest : time),
      undefined,
    ),
    reload: () => void load(),
    syncNow: () => void syncNow(),
    snooze: (item, choice) => void mutate(api.snoozeItem(item.id, choice)),
    wake: (item) => void mutate(api.wakeItem(item.id)),
    flag: (item) => void mutate(api.flagItem(item.id)),
    unflag: (item) => void mutate(api.unflagItem(item.id)),
  };
};
