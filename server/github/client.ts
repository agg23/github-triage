import { githubToken } from "../settings";

const GRAPHQL_URL = "https://api.github.com/graphql";
const REST_URL = "https://api.github.com";

export const REST_PER_PAGE = 100;

export class GitHubError extends Error {}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

const NO_TOKEN = "No GitHub token. Provide one in Settings";

class TransientError extends GitHubError {}

/** GitHub returns these under load */
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(label: string, attempt: () => Promise<T>): Promise<T> => {
  for (let tries = 1; ; tries += 1) {
    try {
      return await attempt();
    } catch (caught) {
      const transient = caught instanceof TransientError || !(caught instanceof GitHubError);

      if (!transient || tries >= MAX_ATTEMPTS) {
        throw caught;
      }

      const wait = RETRY_BASE_MS * 2 ** (tries - 1);
      const message = caught instanceof Error ? caught.message : String(caught);

      console.warn(`[github] ${label}: ${message}, retrying in ${wait}ms`);
      await sleep(wait);
    }
  }
};

const checkStatus = (response: Response) => {
  if (response.status === 401) {
    throw new GitHubError("Unauthorized");
  }

  if (RETRY_STATUSES.has(response.status)) {
    throw new TransientError(`GitHub API error: ${response.status}`);
  }
};

/**
 * Validate a GitHub token is valid, and return the username of the owner
 */
export const fetchViewerLogin = async (token: string): Promise<string> => {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: "{ viewer { login } }" }),
  });

  if (response.status === 401) {
    throw new GitHubError("Unauthorized");
  }

  if (!response.ok) {
    throw new GitHubError(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as GraphQLResponse<{ viewer: { login: string } }>;

  if (json.errors?.length || !json.data) {
    throw new GitHubError(json.errors?.[0]?.message ?? "GitHub API returned no data");
  }

  return json.data.viewer.login;
};

export const fetchGraphQl = async <T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const token = githubToken();

  if (!token) {
    throw new GitHubError(NO_TOKEN);
  }

  return withRetry("graphql", async () => {
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    checkStatus(response);

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
  });
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
  const token = githubToken();

  if (!token) {
    throw new GitHubError(NO_TOKEN);
  }

  const url =
    `${REST_URL}/search/issues?q=${encodeURIComponent(query)}` +
    `&sort=updated&order=asc&per_page=${REST_PER_PAGE}&page=${page}`;

  return withRetry(`search page ${page}`, async () => {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });

    checkStatus(response);

    if (!response.ok) {
      const body = (await response.json().catch(() => undefined)) as
        | { message?: string }
        | undefined;

      throw new GitHubError(`REST search failed (${response.status}): ${body?.message ?? ""}`);
    }

    return (await response.json()) as RestSearchPage;
  });
};
