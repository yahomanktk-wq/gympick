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
    'photoUri' | 'compositeUri' | 'routineCardUri' | 'muscles' | 'isPublic'
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

    if (__DEV__) console.log('[feedPosts] deleteFeedPostBySession 완료');
  } catch (e) {
    if (__DEV__) console.warn('[feedPosts] deleteFeedPostBySession 오류:', e);
  }
}
