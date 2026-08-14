const PARAM_ORDER = [
  "q",
  "tab",
  "state",
  "metric",
  "range",
  "scope",
  "label",
  "sort",
  "forMe",
  "showBots",
  "hideDrafts",
  "showMuted",
  "table",
];

const rank = (key: string) => {
  const index = PARAM_ORDER.indexOf(key);

  return index === -1 ? PARAM_ORDER.length : index;
};

export const orderSearchParams = (search: URLSearchParams): URLSearchParams => {
  const entries = [...search.entries()].sort(
    ([first], [second]) => rank(first) - rank(second) || first.localeCompare(second),
  );

  return new URLSearchParams(entries);
};
