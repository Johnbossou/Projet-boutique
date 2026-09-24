export interface PaginationInfo {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
  from?: number | null;
  to?: number | null;
  meta?: {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
    from?: number | null;
    to?: number | null;
  };
}

export function extractRows<T = unknown>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (
    data &&
    typeof data === 'object' &&
    'data' in data &&
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
  const source =
    data && typeof data === 'object' && 'meta' in data
      ? { ...(data as PaginatedResponse), ...(data as PaginatedResponse).meta }
      : (data as PaginatedResponse);

  const current =
    source.current_page ?? source.meta?.current_page ?? fallback.current_page ?? 1;
  const last =
    source.last_page ?? source.meta?.last_page ?? fallback.last_page ?? 1;
  const per =
    source.per_page ?? source.meta?.per_page ?? fallback.per_page ?? 20;
  const total =
    source.total ?? source.meta?.total ?? fallback.total ?? 0;

  return {
    current_page: current,
    last_page: last,
    per_page: per,
    total: total,
    from: source.from ?? source.meta?.from ?? fallback.from ?? null,
    to: source.to ?? source.meta?.to ?? fallback.to ?? null,
  };
}