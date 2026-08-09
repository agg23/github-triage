import type {
  Item,
  ItemDetail,
  ItemState,
  Settings,
  SettingsPatch,
  Source,
  SourceKind,
  SyncResult,
  View,
  ViewRule,
} from "../shared/types";
import type { SnoozeChoice } from "./types";

export interface SourceWithCount extends Source {
  itemCount: number;
}

export interface NewSource {
  kind: SourceKind;
  owner: string;
  repo?: string;
  priority?: number;
  backfillDays?: number;
}

export interface NewView {
  name: string;
  rules: ViewRule[];
  isDefault?: boolean;
}

export interface SavedView extends View {
  warnings: string[];
}

const JSON_HEADERS = { "Content-Type": "application/json" };

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/api${path}`, init);

  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { error?: string } | undefined;

    throw new Error(body?.error ?? `${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
};

const send = <T>(path: string, method: string, body: unknown): Promise<T> =>
  request<T>(path, { method, headers: JSON_HEADERS, body: JSON.stringify(body) });

const statePath = (id: string) => `/items/${encodeURIComponent(id)}/state`;

export const api = {
  items: (params: Record<string, string> = {}) =>
    request<Item[]>(`/items?${new URLSearchParams(params)}`),
  itemDetail: (id: string) => request<ItemDetail>(`/items/${encodeURIComponent(id)}/detail`),
  settings: () => request<Settings>("/settings"),
  updateSettings: (body: SettingsPatch) => send<Settings>("/settings", "PUT", body),
  sources: () => request<SourceWithCount[]>("/sources"),
  addSource: (body: NewSource) => send<Source>("/sources", "POST", body),
  deleteSource: (id: number) => request<Source>(`/sources/${id}`, { method: "DELETE" }),
  views: () => request<View[]>("/views"),
  addView: (body: NewView) => send<SavedView>("/views", "POST", body),
  updateView: (id: number, body: Partial<NewView>) => send<SavedView>(`/views/${id}`, "PUT", body),
  deleteView: (id: number) => request<View>(`/views/${id}`, { method: "DELETE" }),
  itemStates: () => request<ItemState[]>("/item-states"),
  snoozeItem: (id: string, body: SnoozeChoice) => send<ItemState>(statePath(id), "PUT", body),
  wakeItem: (id: string) => request<ItemState>(statePath(id), { method: "DELETE" }),
  sync: () => request<SyncResult>("/sync", { method: "POST" }),
};
