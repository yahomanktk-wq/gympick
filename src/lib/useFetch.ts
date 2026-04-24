import { useState, useEffect, useCallback, DependencyList } from 'react';

interface FetchState<T> {
  data:    T | null;
  loading: boolean;
  error:   string | null;
  refetch: () => void;
}

/**
 * Minimal async data hook for Supabase queries.
 *
 * Usage:
 *   const { data: gyms, loading } = useFetch(() => fetchGyms(), []);
 */
export function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList = [],
): FetchState<T> {
  const [data,    setData]    = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tick,    setTick]    = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcher()
      .then(result => { if (!cancelled) { setData(result); setLoading(false); } })
      .catch(err   => { if (!cancelled) { setError(String(err)); setLoading(false); } });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, loading, error, refetch };
}
