export interface PaginationInfo {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

interface PageMeta {
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
  from?: number;
  to?: number;
}

export function extractRows<T = unknown>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (
    data &&
    typeof data === "object" &&
    "data" in data &&
    Array.isArray((data as { data: unknown }).data)
  ) {
    return (data as { data: T[] }).data;
  }
  return [];
}

export function normalizePagination(
  data: unknown,
  fallback: Partial<PaginationInfo> = {}
): PaginationInfo {
  const source: PageMeta =
    data && typeof data === "object" && "meta" in data
      ? { ...(data as PageMeta), ...((data as { meta: PageMeta }).meta ?? {}) }
      : (data as PageMeta);

  return {
    current_page: source.current_page ?? fallback.current_page ?? 1,
    last_page: source.last_page ?? fallback.last_page ?? 1,
    per_page: source.per_page ?? fallback.per_page ?? 20,
    total: source.total ?? fallback.total ?? 0,
    from: source.from ?? fallback.from ?? 0,
    to: source.to ?? fallback.to ?? 0,
  };
}