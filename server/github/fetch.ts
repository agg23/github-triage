import type { Item, ItemDetail, Source, SourceKind, SyncStats } from "../../shared/types";
import { GitHubError, fetchGraphQl, fetchRestSearch, REST_PER_PAGE } from "./client";
import { toDetail, toItem } from "./item";
import {
  CONNECTIONS,
  DETAIL_FIELDS,
  fieldsFor,
  PR_DETAIL_FIELDS,
  type DetailNodesResponse,
  type NodesResponse,
  type RepositoryResponse,
} from "./schema";

const PAGE_SIZE = 50;

// REST search serves at most 1000 results per query
const REST_MAX_PAGES = 1000 / REST_PER_PAGE;

export type OwnerKind = Exclude<SourceKind, "repo">;

export interface FetchPage {
  items: Item[];
  /** Parallel to `items` */
  details: ItemDetail[];
  rateLimitRemaining: number | undefined;
  pages: number;
}

type OnPage = (count: number) => void;

// Get newest updated items. For some reason `search()` will silently return nothing depending on PAT/org policy
export const fetchRepoUpdatedSince = async (
  owner: string,
  name: string,
  since: string,
  sourceId: number,
  onPage?: OnPage,
): Promise<FetchPage> => {
  const fetched: Item[] = [];
  const details: ItemDetail[] = [];
  let rateLimitRemaining: number | undefined = undefined;
  let pages = 0;

  for (const connection of CONNECTIONS) {
    const query = `
      query ($owner: String!, $name: String!, $first: Int!, $after: String) {
        rateLimit { remaining }
        repository(owner: $owner, name: $name) {
          ${connection}(first: $first, after: $after,
                  orderBy: { field: UPDATED_AT, direction: DESC }) {
            pageInfo { endCursor hasNextPage }
            nodes { ${fieldsFor(connection)} }
          }
        }
      }
    `;

    let after: string | null = null;

    while (true) {
      const data: RepositoryResponse = await fetchGraphQl(query, {
        owner,
        name,
        first: PAGE_SIZE,
        after,
      });

      if (!data.repository) {
        throw new GitHubError(`Repository ${owner}/${name} not found or not visible to token`);
      }

      rateLimitRemaining = data.rateLimit?.remaining ?? rateLimitRemaining;
      pages += 1;

      const page = data.repository[connection];
      let reachedOld = false;

      for (const node of page.nodes) {
        if (node.updatedAt < since) {
          reachedOld = true;
          break;
        }

        fetched.push(toItem(node, connection === "pullRequests", sourceId));
        details.push(toDetail(node));
      }
      onPage?.(fetched.length);

      if (reachedOld || !page.pageInfo.hasNextPage) {
        break;
      }

      after = page.pageInfo.endCursor;
    }
  }

  return { items: fetched, details, rateLimitRemaining, pages };
};

interface SearchResult {
  ids: string[];
  requests: number;
}

// Find all node ids matching a search query via HTTP
const restSearchNodeIds = async (search: string, onPage?: OnPage): Promise<SearchResult> => {
  const ids: string[] = [];
  const seen = new Set<string>();
  let requests = 0;
  let query = search;

  while (true) {
    let lastUpdatedAt: string | undefined = undefined;

    for (let page = 1; page <= REST_MAX_PAGES; page += 1) {
      const data = await fetchRestSearch(query, page);
      requests += 1;

      for (const item of data.items) {
        if (!seen.has(item.node_id)) {
          seen.add(item.node_id);
          ids.push(item.node_id);
        }

        lastUpdatedAt = item.updated_at;
      }
      onPage?.(ids.length);

      if (page * REST_PER_PAGE >= data.total_count || data.items.length === 0) {
        return { ids, requests };
      }
    }

    // Past the result cap, so restart the query from the newest update seen
    if (lastUpdatedAt === undefined) {
      throw new GitHubError(`search cannot advance: ${query}`);
    }

    query = query.replace(/updated:>=\S+/, `updated:>=${lastUpdatedAt}`);
  }
};

const hydrateNodes = async (ids: string[], sourceId: number): Promise<FetchPage> => {
  const query = /* GraphQL */ `
    query ($ids: [ID!]!) {
      rateLimit { remaining }
      nodes(ids: $ids) {
        __typename
        ... on Issue { ${fieldsFor("issues")} }
        ... on PullRequest { ${fieldsFor("pullRequests")} }
      }
    }
  `;
  const fetched: Item[] = [];
  const details: ItemDetail[] = [];
  let rateLimitRemaining: number | undefined = undefined;
  let pages = 0;

  for (let index = 0; index < ids.length; index += PAGE_SIZE) {
    const data = await fetchGraphQl<NodesResponse>(query, { ids: ids.slice(index, index + PAGE_SIZE) });
    rateLimitRemaining = data.rateLimit?.remaining ?? rateLimitRemaining;
    pages += 1;

    for (const node of data.nodes ?? []) {
      if (node?.__typename) {
        fetched.push(toItem(node, node.__typename === "PullRequest", sourceId));
        details.push(toDetail(node));
      }
    }
  }

  return { items: fetched, details, rateLimitRemaining, pages };
};

export const fetchOwnerUpdatedSince = async (
  kind: OwnerKind,
  owner: string,
  since: string,
  sourceId: number,
  onPage?: OnPage,
): Promise<FetchPage> => {
  const ids: string[] = [];
  let requestCount = 0;

  // REST search requires an is:issue / is:pull-request qualifier
  const requests = ["is:issue", "is:pull-request"].map(query => restSearchNodeIds(`${kind}:${owner} ${query} updated:>=${since}`, onPage));
  const results = await Promise.all(requests);
  for (const result of results) {
    ids.push(...result.ids);
    requestCount += result.requests;
  }

  const hydrated = await hydrateNodes(ids, sourceId);

  return { ...hydrated, pages: hydrated.pages + requestCount };
};

/** Content for items already in the cache, without re-fetching everything else about them */
export const fetchDetails = async (ids: string[]): Promise<ItemDetail[]> => {
  const query = /* GraphQL */ `
    query ($ids: [ID!]!) {
      nodes(ids: $ids) {
        __typename
        ... on Issue { ${DETAIL_FIELDS} }
        ... on PullRequest { ${DETAIL_FIELDS} ${PR_DETAIL_FIELDS} }
      }
    }
  `;
  const details: ItemDetail[] = [];

  for (let index = 0; index < ids.length; index += PAGE_SIZE) {
    const data = await fetchGraphQl<DetailNodesResponse>(query, {
      ids: ids.slice(index, index + PAGE_SIZE),
    });

    for (const node of data.nodes ?? []) {
      if (node?.__typename) {
        details.push(toDetail(node));
      }
    }
  }

  return details;
};

export interface SourceFetch extends SyncStats {
  items: Item[];
  details: ItemDetail[];
}

export const fetchSourceUpdatedSince = async (
  source: Source,
  since: string,
  onPage?: OnPage,
): Promise<SourceFetch> => {
  const result =
    source.kind === "repo"
      ? await fetchRepoUpdatedSince(source.owner, source.repo!, since, source.id, onPage)
      : await fetchOwnerUpdatedSince(source.kind, source.owner, since, source.id, onPage);

  return {
    sourceId: source.id,
    scope:
      source.kind === "repo"
        ? `${source.owner}/${source.repo}`
        : `${source.kind}:${source.owner}`,
    upserted: result.items.length,
    pages: result.pages,
    rateLimitRemaining: result.rateLimitRemaining,
    items: result.items,
    details: result.details,
  };
};
