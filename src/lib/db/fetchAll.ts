import { supabase } from '../supabase';

// PostgREST(Supabase)는 요청 1번에 최대 1,000행만 돌려준다. 넘치는 행은 오류 없이
// 잘리기 때문에, 행이 많아질 수 있는 조회는 아래 헬퍼로 나눠서 받아 합친다.
//
// - PAGE_SIZE: 한 페이지 행 수 (서버 상한과 같게)
// - ID_CHUNK_SIZE: .in(column, ids)에 한 번에 넣는 id 개수.
//   id가 수백 개면 요청 URL이 수 KB가 되어 길이 제한에 걸릴 수 있어 나눠 보낸다.
const PAGE_SIZE     = 1000;
const ID_CHUNK_SIZE = 100;

type OrderSpec = { column: string; ascending?: boolean };

type FetchResult<T> = { data: T[] | null; error: string | null };

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * 조건 하나로 걸러진 행을 1,000행씩 끝까지 받아온다.
 * 페이지가 밀리지 않도록 마지막 정렬 기준으로 'id'를 항상 덧붙인다.
 */
async function fetchPaged<T>(
  build: () => any,   // supabase.from(...).select(...).eq/in(...) 까지 만든 쿼리를 매번 새로 반환
  order: OrderSpec[],
): Promise<FetchResult<T>> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let q = build();
    for (const o of order) q = q.order(o.column, { ascending: o.ascending ?? true });
    if (!order.some(o => o.column === 'id')) q = q.order('id', { ascending: true });

    const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error: error.message };
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return { data: rows, error: null };
}

/** table에서 column = value 인 행 전체 (페이지 단위로 끝까지) */
export function fetchAllEq<T>(
  table: string,
  select: string,
  column: string,
  value: string,
  order: OrderSpec[] = [],
): Promise<FetchResult<T>> {
  return fetchPaged<T>(
    () => supabase.from(table).select(select).eq(column, value),
    order,
  );
}

/**
 * table에서 column IN ids 인 행 전체.
 * id 목록을 100개씩 나눠 동시에 요청하고, 각 묶음도 1,000행씩 끝까지 받는다.
 * 하나라도 실패하면 error를 돌려준다(일부만 보여주지 않도록).
 */
export async function fetchAllIn<T>(
  table: string,
  select: string,
  column: string,
  ids: string[],
  order: OrderSpec[] = [],
): Promise<FetchResult<T>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return { data: [], error: null };

  const results = await Promise.all(
    chunk(unique, ID_CHUNK_SIZE).map(part =>
      fetchPaged<T>(() => supabase.from(table).select(select).in(column, part), order),
    ),
  );

  const failed = results.find(r => r.error);
  if (failed) return { data: null, error: failed.error };
  return { data: results.flatMap(r => r.data ?? []), error: null };
}
