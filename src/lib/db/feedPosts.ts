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
    routineCardUri: r.routine_card_uri ?? undefined,
    sessionId:      r.session_id ?? undefined,
    muscles:        r.muscles ?? [],
    createdAt:      r.created_at,
    isPublic:       r.is_public,
    reactions:      r.reactions ?? { muscle: 0, fire: 0, clap: 0, trophy: 0, flex: 0 },
    myReaction:     null,
  };
}

/** 24시간 이내 공개 피드 조회 */
export async function fetchActiveFeedPosts(): Promise<WorkoutFeedPost[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('workout_feed_posts')
    .select('*')
    .eq('is_public', true)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false });

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
    'photoUri' | 'compositeUri' | 'routineCardUri' | 'sessionId' | 'muscles' | 'isPublic'
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
    const { data: session, error } = await supabase
      .from('workout_sessions')
      .select('id, gym_id, date, notes')
      .eq('id', sessionId)
      .single();

    if (error || !session) return null;

    // workout_entries 조회 (order 컬럼은 예약어라 별칭 사용)
    const { data: entries } = await supabase
      .from('workout_entries')
      .select('id, machine_id, machine_name, machine_brand, target_muscle, exercise_kind')
      .eq('session_id', sessionId);

    // 각 entry의 sets 개별 조회
    const machines = await Promise.all(
      (entries ?? []).map(async (e: any) => {
        const { data: sets } = await supabase
          .from('workout_sets')
          .select('set_number, weight, reps, is_pr')
          .eq('entry_id', e.id)
          .order('set_number');

        const sortedSets = sets ?? [];
        const best = sortedSets.reduce(
          (b: any, s: any) => (!b || Number(s.weight) > Number(b.weight) ? s : b),
          null
        );

        return {
          machineId:    e.machine_id,
          machineName:  e.machine_name,
          machineBrand: e.machine_brand,
          targetMuscle: e.target_muscle,
          weight:       best?.weight ?? 0,
          reps:         best?.reps ?? 0,
          sets:         sortedSets.length,
          allSets:      sortedSets,
        };
      })
    );

    // gyms 이름 fetch
    const { data: gym } = await supabase
      .from('gyms')
      .select('name, location')
      .eq('id', session.gym_id)
      .single();

    return {
      id:          session.id,
      gymId:       session.gym_id,
      gymName:     gym?.name ?? '',
      gymLocation: gym?.location ?? '',
      date:        session.date,
      machines,
    };
  } catch (e) {
    if (__DEV__) console.warn('[feedPosts] fetchWorkoutSessionById 오류:', e);
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

/** 유저의 특정 날짜 오운완 피드 삭제 */
export async function deleteFeedPostBySession(
  userId: string,
  sessionDate: string,
): Promise<void> {
  try {
    const dayStart = new Date(sessionDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(sessionDate);
    dayEnd.setHours(23, 59, 59, 999);

    await supabase
      .from('workout_feed_posts')
      .delete()
      .eq('user_id', userId)
      .gte('created_at', dayStart.toISOString())
      .lte('created_at', dayEnd.toISOString());
  } catch (e) {
    if (__DEV__) console.warn('[feedPosts] deleteFeedPostBySession 오류:', e);
  }
}
