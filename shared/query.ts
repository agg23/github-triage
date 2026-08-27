// GitHub's issue search syntax

import { DAY_MS } from "./constants";
import type { DisplayAction, Item, RuleAction, ViewRule } from "./types";

export interface QueryTerm {
  negated: boolean;
  qualifier: string | undefined;
  value: string;
}

export interface ParsedQuery {
  source: string;
  terms: QueryTerm[];
  warnings: string[];
}

const KNOWN_QUALIFIERS = new Set([
  "is",
  "type",
  "state",
  "draft",
  "repo",
  "org",
  "user",
  "label",
  "no",
  "author",
  "assignee",
  "involves",
  "created",
  "updated",
]);

const QUALIFIER_RE = /^([a-zA-Z-]+):(.*)$/;

const tokenize = (query: string, keepQuotes = false): string[] => {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const character of query) {
    if (character === '"') {
      inQuotes = !inQuotes;

      if (keepQuotes) {
        current += character;
      }
    } else if (!inQuotes && /\s/.test(character)) {
      if (current) {
        tokens.push(current);
      }
      current = "";
    } else {
      current += character;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
};

const parseToken = (unquoted: string): QueryTerm => {
  const negated = unquoted.startsWith("-");
  const body = negated ? unquoted.slice(1) : unquoted;
  const match = QUALIFIER_RE.exec(body);

  if (match) {
    return { negated, qualifier: match[1].toLowerCase(), value: match[2] };
  }

  return { negated, qualifier: undefined, value: body };
};

export const quoteValue = (value: string): string =>
  /\s/.test(value) ? `"${value.replace(/"/g, "")}"` : value;

export const rewriteQuery = (
  query: string,
  remove: (term: QueryTerm) => boolean,
  add: string[] = [],
): string => {
  const kept = tokenize(query, true).filter(
    (raw) => !remove(parseToken(raw.replace(/"/g, ""))),
  );

  return [...kept, ...add].join(" ");
};

export const getQualifier = (query: string, qualifier: string): string =>
  parseQuery(query).terms.find((term) => !term.negated && term.qualifier === qualifier)?.value ??
  "";

export const parseQuery = (query: string): ParsedQuery => {
  const terms: QueryTerm[] = [];
  const warnings: string[] = [];

  for (const raw of tokenize(query)) {
    const term = parseToken(raw);

    if (term.qualifier !== undefined && !KNOWN_QUALIFIERS.has(term.qualifier)) {
      warnings.push(`"${term.qualifier}:" is not supported here and is ignored`);
      continue;
    }

    terms.push(term);
  }

  return { source: query, terms, warnings };
};

const matchDate = (value: string, iso: string): boolean => {
  const time = new Date(iso).getTime();
  const startOfDay = (text: string) => new Date(`${text}T00:00:00Z`).getTime();

  const range = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(value);

  if (range) {
    return time >= startOfDay(range[1]) && time < startOfDay(range[2]) + DAY_MS;
  }

  const comparison = /^(>=|<=|>|<)(\d{4}-\d{2}-\d{2})$/.exec(value);

  if (comparison) {
    const day = startOfDay(comparison[2]);

    switch (comparison[1]) {
      case ">":
        return time >= day + DAY_MS;
      case ">=":
        return time >= day;
      case "<":
        return time < day;
      case "<=":
        return time < day + DAY_MS;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const day = startOfDay(value);

    return time >= day && time < day + DAY_MS;
  }

  return false;
};

const matchTerm = (term: QueryTerm, item: Item): boolean => {
  const value = term.value.toLowerCase();
  const equals = (field: string | null | undefined) => (field ?? "").toLowerCase() === value;

  switch (term.qualifier) {
    case undefined: {
      const number = value.replace(/^#/, "");

      return item.title.toLowerCase().includes(value) || String(item.number) === number;
    }
    case "is":
      switch (value) {
        case "issue":
          return item.type === "issue";
        case "pr":
          return item.type === "pr";
        case "open":
          return item.state === "OPEN";
        case "closed":
          return item.state === "CLOSED" || item.state === "MERGED";
        case "merged":
          return item.state === "MERGED";
        case "draft":
          return item.isDraft;
        case "conflicting":
          return item.mergeable === "CONFLICTING";
        default:
          return false;
      }
    case "type":
      return (value === "issue" && item.type === "issue") || (value === "pr" && item.type === "pr");
    case "state":
      return item.state.toLowerCase() === value;
    case "draft":
      return item.isDraft === (value === "true");
    case "repo":
      return equals(item.repo);
    case "org":
    case "user":
      return equals(item.repo.split("/")[0]);
    case "label":
      return item.labels.some((label) => label.name.toLowerCase() === value);
    case "no":
      if (value === "label") {
        return item.labels.length === 0;
      }

      if (value === "assignee") {
        return item.assignees.length === 0;
      }

      return false;
    case "author":
      return equals(item.author);
    case "assignee":
      return item.assignees.some((assignee) => assignee.toLowerCase() === value);
    case "involves":
      return (
        equals(item.author) ||
        equals(item.lastActor) ||
        item.assignees.some((assignee) => assignee.toLowerCase() === value) ||
        item.participants.some((participant) => participant.toLowerCase() === value)
      );
    case "created":
      return matchDate(term.value, item.createdAt);
    case "updated":
      return matchDate(term.value, item.updatedAt);
    default:
      return true;
  }
};

export const matchesItem = (parsed: ParsedQuery, item: Item): boolean =>
  parsed.terms.every((term) => matchTerm(term, item) !== term.negated);

const OPEN_RE = /^(filter|show|mute|hide)\(/i;

interface Segment {
  action: RuleAction | undefined;
  text: string;
}

const splitSegments = (query: string): Segment[] => {
  const segments: Segment[] = [];
  let text = "";
  let inQuotes = false;

  const flush = () => {
    if (text.trim() !== "") {
      segments.push({ action: undefined, text });
    }
    text = "";
  };

  for (let index = 0; index < query.length; ) {
    const character = query[index];

    if (character === '"') {
      inQuotes = !inQuotes;
    }

    const atBoundary = !inQuotes && (index === 0 || /\s/.test(query[index - 1]));
    const open = atBoundary ? OPEN_RE.exec(query.slice(index)) : null;

    if (!open) {
      text += character;
      index += 1;
      continue;
    }

    flush();

    let body = "";
    let bodyQuotes = false;
    let end = index + open[0].length;
    for (; end < query.length; end += 1) {
      if (query[end] === '"') {
        bodyQuotes = !bodyQuotes;
      }

      if (query[end] === ")" && !bodyQuotes) {
        break;
      }
      body += query[end];
    }

    segments.push({ action: open[1].toLowerCase() as RuleAction, text: body.trim() });
    // Past the ")", or past the end for an unclosed group
    index = end + 1;
  }

  flush();

  return segments;
};

export interface DisplayRule {
  action: DisplayAction;
  parsed: ParsedQuery;
}

export interface ParsedRuleQuery {
  window: ParsedQuery;
  rules: DisplayRule[];
  warnings: string[];
}

export const parseRuleQuery = (query: string): ParsedRuleQuery => {
  const windowTerms: string[] = [];
  const rules: DisplayRule[] = [];

  for (const segment of splitSegments(query)) {
    if (segment.action === undefined || segment.action === "filter") {
      windowTerms.push(segment.text.trim());
      continue;
    }

    rules.push({ action: segment.action, parsed: parseQuery(segment.text) });
  }

  const window = parseQuery(windowTerms.join(" ").trim());

  return {
    window,
    rules,
    warnings: [...window.warnings, ...rules.flatMap((rule) => rule.parsed.warnings)],
  };
};

export interface ItemVerdict {
  action: DisplayAction;
  rule: string;
}

export const evaluateItem = (ruleQuery: ParsedRuleQuery, item: Item): ItemVerdict => {
  if (!matchesItem(ruleQuery.window, item)) {
    return { action: "hide", rule: "" };
  }

  for (let index = ruleQuery.rules.length - 1; index >= 0; index--) {
    const { action, parsed } = ruleQuery.rules[index];

    if (matchesItem(parsed, item)) {
      return { action, rule: parsed.source.trim() };
    }
  }

  return { action: "show", rule: "" };
};

export const serializeRules = (rules: ViewRule[]): string =>
  rules
    .map((rule) =>
      rule.action === "filter" ? rule.query.trim() : `${rule.action}(${rule.query.trim()})`,
    )
    .filter((part) => part !== "")
    .join(" ");

export const windowQuery = (query: string): string => parseRuleQuery(query).window.source;

export const setWindowQuery = (query: string, body: string): string => {
  const groups = splitSegments(query).flatMap((segment) =>
    segment.action === undefined || segment.action === "filter"
      ? []
      : [`${segment.action}(${segment.text})`],
  );

  return [body.trim(), ...groups].filter((part) => part !== "").join(" ");
};
