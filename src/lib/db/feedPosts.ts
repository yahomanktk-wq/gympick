import { supabase } from '../supabase';
import { WorkoutFeedPost } from '../../data/types';

function rowToPost(r: any): WorkoutFeedPost {
  return {
    id:             r.id,
    userId:         r.user_id,
    nickname:       r.nickname,
    gymId:          r.gym_id,
    gymName:        r.gym_name,
    photoUri:       r.photo_uri,
    compositeUri:   r.composite_uri ?? undefined,
    thumbnailUri:   r.thumbnail_uri ?? undefined,
    routineCardUri: r.routine_card_uri ?? undefined,
    sessionId:      r.session_id ?? undefined,
    muscles:        r.muscles ?? [],
    createdAt:      r.created_at,
    isPublic:       r.is_public,
    reactions:      r.reactions ?? { muscle: 0, fire: 0, clap: 0, trophy: 0, flex: 0 },
    myReaction:     null,
  };
}

/**
 * 공개 피드 조회.
 * hoursWindow를 생략하면 기존과 동일하게 24시간 이내만 조회한다.
 * hoursWindow에 null을 넘기면 시간 제한 없이 전체 공개 게시물을 조회한다
 * (HomeScreen의 "오늘의 오운완" 폴백 전용 — 다른 호출부는 이 옵션을 쓰지 않는다).
 */
export async function fetchActiveFeedPosts(hoursWindow: number | null = 24): Promise<WorkoutFeedPost[]> {
  let query = supabase
    .from('workout_feed_posts')
    .select('*')
    .eq('is_public', true);

  if (hoursWindow !== null) {
    const cutoff = new Date(Date.now() - hoursWindow * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', cutoff);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[feedPosts] fetch error:', error.message);
    return [];
  }
  return data.map(rowToPost);
}

/** 피드 포스트 저장 */
export async function insertFeedPost(
  post: Pick<WorkoutFeedPost,
    'id' | 'userId' | 'nickname' | 'gymId' | 'gymName' |
    'photoUri' | 'compositeUri' | 'thumbnailUri' | 'routineCardUri' | 'sessionId' | 'muscles' | 'isPublic'
  >,
): Promise<void> {
  const { error } = await supabase
    .from('workout_feed_posts')
    .insert({
      id:               post.id,
      user_id:          post.userId,
      nickname:         post.nickname,
      gym_id:           post.gymId,
      gym_name:         post.gymName,
      photo_uri:        post.photoUri,
      composite_uri:    post.compositeUri ?? null,
      thumbnail_uri:    post.thumbnailUri ?? null,
      routine_card_uri: post.routineCardUri ?? null,
      session_id:       post.sessionId ?? null,
      muscles:          post.muscles,
      is_public:        post.isPublic,
    });

  if (error && __DEV__) {
    console.warn('[feedPosts] insert error:', error.message);
  }
}

/** 유저의 가장 최근 운동 세션의 gym_id를 반환 */
export async function fetchMyLatestGymId(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('gym_id')
      .eq('user_id', userId)
      .not('gym_id', 'is', null)
      .order('date', { ascending: false })
      .limit(1)
      .single();
    if (error || !data?.gym_id) return null;
    return data.gym_id as string;
  } catch (e) {
    if (__DEV__) console.warn('[feedPosts] fetchMyLatestGymId 오류:', e);
    return null;
  }
}

/** 특정 헬스장의 24시간 이내 공개 피드 조회 */
export async function fetchFeedPostsByGym(gymId: string): Promise<WorkoutFeedPost[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('workout_feed_posts')
    .select('*')
    .eq('is_public', true)
    .eq('gym_id', gymId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false });
  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[feedPosts] fetchFeedPostsByGym 오류:', error.message);
    return [];
  }
  return data.map(rowToPost);
}

/** session_id로 운동 세션 전체 데이터 fetch */
export async function fetchWorkoutSessionById(sessionId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select(`
        id, date, gym_id,
        workout_entries (
          id, machine_id, machine_name, machine_brand,
          workout_sets ( weight, reps, set_number )
        )
      `)
      .eq('id', sessionId)
      .single();

    console.log('[fetchWorkoutSessionById] sessionId:', sessionId);
    console.log('[fetchWorkoutSessionById] data:', JSON.stringify(data));
    console.log('[fetchWorkoutSessionById] error:', error);

    if (error || !data) return null;

    // gym_id로 헬스장명 별도 조회
    let gymName = data.gym_id ?? '';
    try {
      const { data: gymData } = await supabase
        .from('gyms')
        .select('name')
        .eq('id', data.gym_id)
        .single();
      if (gymData?.name) gymName = gymData.name;
    } catch {}

    return {
      id:      data.id,
      date:    data.date,
      gymName: gymName,
      machines: (data.workout_entries ?? []).map((e: any) => ({
        machineId:    e.machine_id,
        machineName:  e.machine_name,
        machineBrand: e.machine_brand,
        allSets: (e.workout_sets ?? [])
          .sort((a: any, b: any) => a.set_number - b.set_number)
          .map((s: any) => ({ weight: s.weight, reps: s.reps })),
      })),
    };
  } catch (e) {
    if (__DEV__) console.warn('[fetchWorkoutSessionById] error:', e);
    return null;
  }
}

/**
 * sessionId가 없을 때 userId + 날짜로 세션 조회 (fallback)
 */
export async function fetchWorkoutSessionByUserAndDate(
  userId:    string,
  createdAt: string,
): Promise<any | null> {
  try {
    const dayStart = new Date(createdAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(createdAt);
    dayEnd.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('workout_sessions')
      .select(`
        id, date, gym_id,
        workout_entries (
          id, machine_id, machine_name, machine_brand,
          workout_sets ( weight, reps, set_number )
        )
      `)
      .eq('user_id', userId)
      .gte('date', dayStart.toISOString())
      .lte('date', dayEnd.toISOString())
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    // gym_id로 헬스장명 별도 조회
    let gymName = data.gym_id ?? '';
    try {
      const { data: gymData } = await supabase
        .from('gyms')
        .select('name')
        .eq('id', data.gym_id)
        .single();
      if (gymData?.name) gymName = gymData.name;
    } catch {}

    return {
      id:      data.id,
      date:    data.date,
      gymName: gymName,
      machines: (data.workout_entries ?? []).map((e: any) => ({
        machineId:    e.machine_id,
        machineName:  e.machine_name,
        machineBrand: e.machine_brand,
        allSets: (e.workout_sets ?? [])
          .sort((a: any, b: any) => a.set_number - b.set_number)
          .map((s: any) => ({ weight: s.weight, reps: s.reps })),
      })),
    };
  } catch (e) {
    if (__DEV__) console.warn('[fetchWorkoutSessionByUserAndDate] error:', e);
    return null;
  }
}

/** 유저의 특정 날짜 오운완 피드 공개 여부 조회 */
export async function fetchFeedPostPublicStatus(
  userId: string,
  sessionDate: string,
): Promise<{ postId: string; isPublic: boolean } | null> {
  try {
    const dayStart = new Date(sessionDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(sessionDate);
    dayEnd.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('workout_feed_posts')
      .select('id, is_public')
      .eq('user_id', userId)
      .gte('created_at', dayStart.toISOString())
      .lte('created_at', dayEnd.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return { postId: data.id, isPublic: data.is_public };
  } catch {
    return null;
  }
}

/** 피드 게시물 공개 여부 업데이트 */
export async function updateFeedPostPublic(
  postId: string,
  isPublic: boolean,
): Promise<void> {
  try {
    await supabase
      .from('workout_feed_posts')
      .update({ is_public: isPublic })
      .eq('id', postId);
  } catch (e) {
    if (__DEV__) console.warn('[feedPosts] updateFeedPostPublic 오류:', e);
    throw e;
  }
}

/** session_id로 오운완 피드 삭제 */
export async function deleteFeedPostBySession(
  userId: string,
  sessionId: string,
): Promise<void> {
  try {
    // session_id가 있으면 정확하게 삭제
    const { data: bySession } = await supabase
      .from('workout_feed_posts')
      .select('id')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .limit(1);

    if (bySession?.length) {
      await supabase
        .from('workout_feed_posts')
        .delete()
        .eq('user_id', userId)
        .eq('session_id', sessionId);
      return;
    }

    // session_id가 없는 구버전 데이터 fallback: session의 date로 조회 후 삭제
    // 단, 동일 날짜 여러 세션이 있을 경우 가장 오래된 것만 삭제
    const { data: sessionData } = await supabase
      .from('workout_sessions')
      .select('date')
      .eq('id', sessionId)
      .single();

    if (!sessionData?.date) return;

    const dayStart = new Date(sessionData.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(sessionData.date);
    dayEnd.setHours(23, 59, 59, 999);

    // 날짜 범위에서 session_id가 null인 것만 1개 삭제 (구버전 데이터 대응)
    const { data: fallbackPosts } = await supabase
      .from('workout_feed_posts')
      .select('id')
      .eq('user_id', userId)
      .is('session_id', null)
      .gte('created_at', dayStart.toISOString())
      .lte('created_at', dayEnd.toISOString())
      .order('created_at', { ascending: true })
      .limit(1);

    if (fallbackPosts?.length) {
      await supabase
        .from('workout_feed_posts')
        .delete()
        .eq('id', fallbackPosts[0].id);
    }
  } catch (e) {
    if (__DEV__) console.warn('[feedPosts] deleteFeedPostBySession 오류:', e);
  }
}
