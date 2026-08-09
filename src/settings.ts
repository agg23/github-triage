import { useSyncExternalStore } from "react";
import type { Settings, TriageSettings } from "../shared/types";

export const DEFAULT_SETTINGS: Settings = {
  me: "",
  teamMembers: [],
  trustedContributors: [],
  bots: [],
  newWithinHours: 24,
  hasToken: false,
  tokenLogin: null,
};

const normalizeLogin = (login: string) => login.toLowerCase();

interface Lookups {
  team: Set<string>;
  trusted: Set<string>;
  bots: Set<string>;
}

const lookupsFor = (source: TriageSettings): Lookups => ({
  team: new Set(source.teamMembers.map(normalizeLogin)),
  trusted: new Set(source.trustedContributors.map(normalizeLogin)),
  bots: new Set(source.bots.map(normalizeLogin)),
});

let current = DEFAULT_SETTINGS;
let lookups = lookupsFor(current);
const listeners = new Set<() => void>();

export const getSettings = (): Settings => current;

export const getLookups = (): Lookups => lookups;

export const applySettings = (next: Settings) => {
  if (JSON.stringify(next) === JSON.stringify(current)) {
    return;
  }

  current = next;
  lookups = lookupsFor(next);

  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const useSettings = (): Settings => useSyncExternalStore(subscribe, getSettings);
