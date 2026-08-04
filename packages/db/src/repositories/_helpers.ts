import "server-only";

/** Uniform error wrapper for PostgREST results. */
export function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

/** Escape a user-supplied string for use inside a PostgREST `.or()` filter. */
export function sanitizeSearch(input: string): string {
  return input.replace(/[,()]/g, " ").trim();
}

export interface PageParams {
  page: number;
  pageSize: number;
}

export function pageRange({ page, pageSize }: PageParams): { from: number; to: number } {
  const from = Math.max(0, (page - 1) * pageSize);
  return { from, to: from + pageSize - 1 };
}
