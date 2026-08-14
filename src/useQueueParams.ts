import {
  debounce,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import { useEffect, useMemo } from "react";
import { serializeRules } from "../shared/query";
import type { View } from "../shared/types";
import { type Filters, QUEUE_TABS, type QueueTab, SORT_IDS, type SortId } from "./types";

/** Typing debounces for period before creating a history entry */
const SEARCH_DEBOUNCE_MS = 300;

export const queueParsers = {
  tab: parseAsStringLiteral(QUEUE_TABS).withDefault("attention"),
  sort: parseAsStringLiteral(SORT_IDS).withDefault("recent"),
  showBots: parseAsBoolean.withDefault(false),
  hideDrafts: parseAsBoolean.withDefault(false),
  forMe: parseAsBoolean.withDefault(false),
  showMuted: parseAsBoolean.withDefault(false),
};

export interface QueueParams {
  tab: QueueTab;
  setTab: (tab: QueueTab) => void;
  sort: SortId;
  setSort: (sort: SortId) => void;
  filters: Filters;
  setFilters: (filters: Filters) => void;
  /** Represents typing events, which should not constantly push to history */
  setSearch: (query: string) => void;
  hideMuted: boolean;
  toggleMuted: () => void;
}

const urlHasQuery = () => new URLSearchParams(window.location.search).has("q");

/**
 * The queue's filters fed from the query param
 *
 * `active` is whether the queue page is currently displayed
 */
export const useQueueParams = (views: View[], active: boolean): QueueParams => {
  const defaultQuery = useMemo(() => {
    const defaultView = views.find((view) => view.isDefault);

    return defaultView ? serializeRules(defaultView.rules) : "";
  }, [views]);

  const parsers = useMemo(
    () => ({
      ...queueParsers,
      // Empty `q` param is the default
      q: parseAsString.withDefault(defaultQuery).withOptions({ clearOnDefault: false }),
    }),
    [defaultQuery],
  );

  const [params, setParams] = useQueryStates(parsers, { history: "push" });

  useEffect(() => {
    if (!active || defaultQuery === "" || urlHasQuery()) {
      return;
    }

    void setParams({ q: defaultQuery }, { history: "replace" });
  }, [active, defaultQuery, setParams, params.q]);

  const hideMuted = !params.showMuted;

  return {
    tab: params.tab,
    setTab: (tab) => void setParams({ tab }),
    sort: params.sort,
    setSort: (sort) => void setParams({ sort }),
    filters: {
      query: params.q,
      hideBots: !params.showBots,
      hideDrafts: params.hideDrafts,
      forMe: params.forMe,
    },
    setFilters: (next) =>
      void setParams({
        q: next.query,
        showBots: !next.hideBots,
        hideDrafts: next.hideDrafts,
        forMe: next.forMe,
      }),
    setSearch: (next) =>
      void setParams(
        { q: next },
        { history: "replace", limitUrlUpdates: debounce(SEARCH_DEBOUNCE_MS) },
      ),
    hideMuted,
    toggleMuted: () => void setParams({ showMuted: hideMuted }),
  };
};
