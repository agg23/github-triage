import { useEffect, useRef, useState } from "react";
import { serializeRules } from "../shared/query";
import type { View } from "../shared/types";
import { DEFAULT_FILTERS, type Filters } from "./types";

const QUERY_KEY = "triage.query";
const HIDE_MUTED_KEY = "triage.hideMuted";

export interface StoredFilters {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  hideMuted: boolean;
  toggleMuted: () => void;
}

export const useStoredFilters = (views: View[], loading: boolean): StoredFilters => {
  const [filters, setFilters] = useState<Filters>(() => {
    const stored = localStorage.getItem(QUERY_KEY);

    return stored !== null ? { ...DEFAULT_FILTERS, query: stored } : DEFAULT_FILTERS;
  });

  const [hideMuted, setHideMuted] = useState(() => localStorage.getItem(HIDE_MUTED_KEY) === "1");

  const initialized = useRef(localStorage.getItem(QUERY_KEY) !== null);

  useEffect(() => {
    if (initialized.current) {
      localStorage.setItem(QUERY_KEY, filters.query);
    }
  }, [filters.query]);

  useEffect(() => {
    localStorage.setItem(HIDE_MUTED_KEY, hideMuted ? "1" : "0");
  }, [hideMuted]);

  useEffect(() => {
    if (initialized.current || loading) {
      return;
    }

    initialized.current = true;
    const defaultView = views.find((view) => view.isDefault);

    if (defaultView) {
      setFilters((current) => ({ ...current, query: serializeRules(defaultView.rules) }));
    }
  }, [views, loading]);

  return {
    filters,
    setFilters,
    hideMuted,
    toggleMuted: () => setHideMuted((hidden) => !hidden),
  };
};
