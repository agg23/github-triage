import { GITHUB_TOKEN } from "../env";

const GRAPHQL_URL = "https://api.github.com/graphql";
const REST_URL = "https://api.github.com";

export const REST_PER_PAGE = 100;

export class GitHubError extends Error {}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

export const fetchGraphQl = async <T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  if (!GITHUB_TOKEN) {
    throw new GitHubError("GITHUB_TOKEN is not set");
  }

  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 401) {
    throw new GitHubError("401: Bad GITHUB_TOKEN");
  }

  if (!response.ok) {
    throw new GitHubError(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as GraphQLResponse<T>;

  if (json.errors?.length) {
    const messages = [...new Set(json.errors.map((error) => error.message))];

    throw new GitHubError(messages.join("; "));
  } else if (!json.data) {
    throw new GitHubError("GitHub API returned no data");
  }

  return json.data;
};

export interface RestSearchItem {
  node_id: string;
  updated_at: string;
}

export interface RestSearchPage {
  total_count: number;
  items: RestSearchItem[];
}

export const fetchRestSearch = async (query: string, page: number): Promise<RestSearchPage> => {
  const url =
    `${REST_URL}/search/issues?q=${encodeURIComponent(query)}` +
    `&sort=updated&order=asc&per_page=${REST_PER_PAGE}&page=${page}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { message?: string } | undefined;

    throw new GitHubError(`REST search failed (${response.status}): ${body?.message ?? ""}`);
  }

  return (await response.json()) as RestSearchPage;
};
