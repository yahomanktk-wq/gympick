// src/lib/db/adminAnalytics.ts
//
// 2026-09-09: 어드민 "사용자 지표" 화면 확장용 신규 쿼리 모음.
// 전부 gympick_admin_analytics_v3_views.sql로 만든 읽기 전용 VIEW를 조회하며,
// 신규 클라이언트 트래킹 없이 기존 workout_sessions/entries/sets/photos,
// favorite_machines, machines, gyms 테이블만으로 계산되는 지표들이다.
// (퍼널 드롭오프 지표는 여기 없음 — 기존 admin_event_breakdown_30d의
// flow_* 이벤트를 AdminAnalyticsView.tsx에서 그대로 필터링해서 씀)
//
// AdminAnalyticsView.tsx의 화면 렌더링 로직과 분리하기 위해 파일을 나눔
// (프로젝트 규칙: 기능별 모듈화).

import { supabase } from '../supabase';

export interface CompletionStats {
  totalSessions:     number;
  sessionsWithSets:  number;
  sessionsWithPhoto: number;
}

export interface SessionAverages {
  avgMachines: number;
  avgSets:     number;
  avgVolume:   number;
}

export interface TopFavoriteMachine {
  machineId:     string;
  machineName:   string;
  machineBrand:  string;
  favoriteCount: number;
}

export interface NewVsReturning {
  newUsers:       number;
  returningUsers: number;
}

export interface WeekdayActivity {
  weekday:      number; // 0=일 ~ 6=토
  sessionCount: number;
}

export interface TopGym {
  gymId:        string;
  gymName:      string;
  sessionCount: number;
  uniqueUsers:  number;
}

export interface AtRiskUsers {
  active7d:       number;
  atRisk7to14d:   number;
  atRisk14to30d:  number;
  dormant30dPlus: number;
}

const EMPTY_COMPLETION: CompletionStats     = { totalSessions: 0, sessionsWithSets: 0, sessionsWithPhoto: 0 };
const EMPTY_AVERAGES: SessionAverages       = { avgMachines: 0, avgSets: 0, avgVolume: 0 };
const EMPTY_NEW_VS_RETURNING: NewVsReturning = { newUsers: 0, returningUsers: 0 };
const EMPTY_AT_RISK: AtRiskUsers            = { active7d: 0, atRisk7to14d: 0, atRisk14to30d: 0, dormant30dPlus: 0 };

/** 최근 30일 운동일지 완료율 (세트 기록 / 인증샷, 서로 독립 집계). VIEW 없으면 0으로. */
export async function fetchCompletionStats(): Promise<CompletionStats> {
  const { data, error } = await supabase.from('admin_completion_stats_30d').select('*').maybeSingle();
  if (error || !data) {
    if (__DEV__ && error) console.warn('[db/adminAnalytics] fetchCompletionStats error:', error.message);
    return EMPTY_COMPLETION;
  }
  return {
    totalSessions:     data.total_sessions ?? 0,
    sessionsWithSets:  data.sessions_with_sets ?? 0,
    sessionsWithPhoto: data.sessions_with_photo ?? 0,
  };
}

/** 최근 30일 세션당 평균 머신 수 / 세트 수 / 총 볼륨. */
export async function fetchSessionAverages(): Promise<SessionAverages> {
  const { data, error } = await supabase.from('admin_session_averages_30d').select('*').maybeSingle();
  if (error || !data) {
    if (__DEV__ && error) console.warn('[db/adminAnalytics] fetchSessionAverages error:', error.message);
    return EMPTY_AVERAGES;
  }
  return {
    avgMachines: Number(data.avg_machines ?? 0),
    avgSets:     Number(data.avg_sets ?? 0),
    avgVolume:   Number(data.avg_volume ?? 0),
  };
}

/** 즐겨찾기 TOP 5 머신. */
export async function fetchTopFavoriteMachines(): Promise<TopFavoriteMachine[]> {
  const { data, error } = await supabase.from('admin_top_favorite_machines').select('*');
  if (error || !data) {
    if (__DEV__ && error) console.warn('[db/adminAnalytics] fetchTopFavoriteMachines error:', error.message);
    return [];
  }
  return data.map((r: any) => ({
    machineId:     r.machine_id,
    machineName:   r.machine_name,
    machineBrand:  r.machine_brand,
    favoriteCount: r.favorite_count,
  }));
}

/** 최근 30일 활동 유저 중 신규 vs 재방문. */
export async function fetchNewVsReturning(): Promise<NewVsReturning> {
  const { data, error } = await supabase.from('admin_new_vs_returning_30d').select('*').maybeSingle();
  if (error || !data) {
    if (__DEV__ && error) console.warn('[db/adminAnalytics] fetchNewVsReturning error:', error.message);
    return EMPTY_NEW_VS_RETURNING;
  }
  return {
    newUsers:       data.new_users ?? 0,
    returningUsers: data.returning_users ?? 0,
  };
}

/** 최근 30일 요일별(일~토) 운동일지 작성 건수. */
export async function fetchWeekdayActivity(): Promise<WeekdayActivity[]> {
  const { data, error } = await supabase
    .from('admin_weekday_activity_30d')
    .select('*')
    .order('weekday', { ascending: true });
  if (error || !data) {
    if (__DEV__ && error) console.warn('[db/adminAnalytics] fetchWeekdayActivity error:', error.message);
    return [];
  }
  return data.map((r: any) => ({ weekday: r.weekday, sessionCount: r.session_count }));
}

/** 최근 30일 활동 상위 헬스장 TOP 5. */
export async function fetchTopGyms(): Promise<TopGym[]> {
  const { data, error } = await supabase.from('admin_top_gyms_30d').select('*');
  if (error || !data) {
    if (__DEV__ && error) console.warn('[db/adminAnalytics] fetchTopGyms error:', error.message);
    return [];
  }
  return data.map((r: any) => ({
    gymId:        r.gym_id,
    gymName:      r.gym_name,
    sessionCount: r.session_count,
    uniqueUsers:  r.unique_users,
  }));
}

/** 마지막 운동일지 기준 활동/위험/이탈 유저 수 (4구간). */
export async function fetchAtRiskUsers(): Promise<AtRiskUsers> {
  const { data, error } = await supabase.from('admin_at_risk_users').select('*').maybeSingle();
  if (error || !data) {
    if (__DEV__ && error) console.warn('[db/adminAnalytics] fetchAtRiskUsers error:', error.message);
    return EMPTY_AT_RISK;
  }
  return {
    active7d:       data.active_7d ?? 0,
    atRisk7to14d:   data.at_risk_7_14d ?? 0,
    atRisk14to30d:  data.at_risk_14_30d ?? 0,
    dormant30dPlus: data.dormant_30d_plus ?? 0,
  };
}
