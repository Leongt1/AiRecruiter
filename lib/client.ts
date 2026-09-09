import type { Filters, Rubric } from "@/lib/schemas";
import type { Profile } from "@/lib/profiles";
import type { FilterStats } from "@/lib/filter";

/** One ranked result: the full profile plus its rubric score and grounded explanation. */
export interface RankedItem {
  profile: Profile;
  score: number;
  explanation: string;
  matchedSignals: string[];
}

export interface GenerateResponse {
  filters: Filters;
  rubric: Rubric;
}

export interface SearchResponse {
  ranked: RankedItem[];
  totalPassed: number;
  stats: FilterStats;
}

export interface RefineResponse {
  filters: Filters;
  rubric: Rubric;
  changeSummary: string;
}

/** Mirror of the server's error envelope, thrown so callers can branch on `kind`. */
export class ApiError extends Error {
  kind: string;
  constructor(kind: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("network", "Couldn't reach the server. Check your connection and retry.");
  }
  if (!res.ok) {
    let kind = "unknown";
    let message = "Something went wrong. Please retry.";
    try {
      const data = await res.json();
      if (data?.error) {
        kind = data.error.kind ?? kind;
        message = data.error.message ?? message;
      }
    } catch {
      /* non-JSON error body: keep defaults */
    }
    throw new ApiError(kind, message);
  }
  return (await res.json()) as T;
}

export const api = {
  generate: (query: string) => postJson<GenerateResponse>("/api/generate", { query }),
  search: (filters: Filters, rubric: Rubric) =>
    postJson<SearchResponse>("/api/search", { filters, rubric }),
  refine: (params: {
    query: string;
    filters: Filters;
    rubric: Rubric;
    feedback: string;
    shownProfileIds: string[];
  }) => postJson<RefineResponse>("/api/refine", params),
};
