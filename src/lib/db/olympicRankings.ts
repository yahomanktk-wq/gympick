import { supabase } from '../supabase';

export interface OlympicRankingEntry {
  machineId:    string;
  bodyPart:     string;
  category:     string | null;
  winCount:     number;
  loseCount:    number;
  winRate:      number;
  rank:         number;
  machineName:  string;
  machineBrand: string;
}

/** 투표 1건을 Supabase에 저장하고 olympic_rankings upsert */
export async function saveVoteToSupabase(params: {
  userId:     string | null;
  machineId:  string;
  opponentId: string;
  bodyPart:   string;
  category:   string;
  round:      string;
  gymId:      string | null;
}): Promise<void> {
  try {
    // 2026-10-13: 기존에는 투표기록 저장 → 승자 select → 승자 upsert →
    // 패자 select → 패자 upsert를 순차로 5번 왕복했음. 투표기록 저장과
    // 승자/패자 조회는 서로 결과가 필요 없는 독립적인 작업이라 동시에
    // 시작하고, 승자/패자 upsert도 서로 독립적이라 동시에 실행해 왕복을
    // 5회 → 2회(조회 묶음 1회 + upsert 묶음 1회)로 줄인다.
    // (count를 읽은 뒤 +1해서 다시 쓰는 read-then-write 방식 자체는 동시
    // 투표 시 카운트가 누락될 수 있는 레이스 컨디션 소지가 있음 — 이건
    // 병렬화와는 별개의 정합성 이슈라 별도로 안내함)

    const [, winnerResult, loserResult] = await Promise.all([
      // 1. 투표 기록 저장
      supabase.from('olympic_votes').insert({
        user_id:     params.userId,
        machine_id:  params.machineId,
        opponent_id: params.opponentId,
        body_part:   params.bodyPart,
        category:    params.category,
        round:       params.round,
        gym_id:      params.gymId,
      }),
      // 2. 승자 현재 카운트 조회
      supabase
        .from('olympic_rankings')
        .select('win_count, lose_count')
        .eq('machine_id', params.machineId)
        .single(),
      // 3. 패자 현재 카운트 조회
      supabase
        .from('olympic_rankings')
        .select('win_count, lose_count')
        .eq('machine_id', params.opponentId)
        .single(),
    ]);

    const winner = winnerResult.data;
    const loser  = loserResult.data;

    await Promise.all([
      // 승자 랭킹 upsert (win_count +1)
      supabase.from('olympic_rankings').upsert({
        machine_id:  params.machineId,
        body_part:   params.bodyPart,
        category:    params.category || null,
        win_count:   (winner?.win_count ?? 0) + 1,
        lose_count:  winner?.lose_count ?? 0,
        updated_at:  new Date().toISOString(),
      }, { onConflict: 'machine_id' }),
      // 패자 랭킹 upsert (lose_count +1)
      supabase.from('olympic_rankings').upsert({
        machine_id:  params.opponentId,
        body_part:   params.bodyPart,
        category:    params.category || null,
        win_count:   loser?.win_count ?? 0,
        lose_count:  (loser?.lose_count ?? 0) + 1,
        updated_at:  new Date().toISOString(),
      }, { onConflict: 'machine_id' }),
    ]);

  } catch (e) {
    if (__DEV__) console.warn('[olympicRankings] saveVoteToSupabase 오류:', e);
  }
}

/** Supabase에서 올림픽 랭킹 fetch (부위별 필터 가능) */
export async function fetchOlympicRankings(bodyPart?: string): Promise<OlympicRankingEntry[]> {
  try {
    let query = supabase
      .from('olympic_rankings')
      .select('machine_id, body_part, category, win_count, lose_count')
      .gt('win_count', 0)
      .order('win_count', { ascending: false })
      .limit(50);

    if (bodyPart && bodyPart !== 'ALL') {
      query = query.eq('body_part', bodyPart);
    }

    const { data, error } = await query;
    if (error) throw error;

    const { MACHINES } = await import('../../data');

    return (data ?? []).map((r, idx) => {
      const machine = MACHINES.find(m => m.id === r.machine_id);
      const total   = r.win_count + r.lose_count;
      const winRate = total > 0 ? Math.round((r.win_count / total) * 100) : 0;
      return {
        machineId:    r.machine_id,
        bodyPart:     r.body_part,
        category:     r.category,
        winCount:     r.win_count,
        loseCount:    r.lose_count,
        winRate,
        rank:         idx + 1,
        machineName:  machine?.name ?? r.machine_id,
        machineBrand: machine?.brand ?? '',
      };
    });
  } catch (e) {
    if (__DEV__) console.warn('[olympicRankings] fetchOlympicRankings 오류:', e);
    return [];
  }
}
