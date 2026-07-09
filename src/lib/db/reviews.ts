import { supabase } from '../supabase';
import { MachineReview, FavoriteMachine } from '../../data/types';
import {
  MACHINE_REVIEWS,
  FAVORITE_MACHINES,
  getMachineReviews  as mockGetMachineReviews,
  getUserFavorites   as mockGetUserFavorites,
  isUserFavorite     as mockIsUserFavorite,
} from '../../data/machineReviews';

// --- Row types

type ReviewRow = {
  id:            string;
  machine_id:    string;
  user_id:       string;
  user_name:     string;
  user_initials: string;
  rating:        number;
  text:          string;
  created_at:    string;
};

type FavoriteRow = {
  id:         string;
  user_id:    string;
  machine_id: string;
  created_at: string;
};

function rowToReview(r: ReviewRow): MachineReview {
  return {
    id:           r.id,
    machineId:    r.machine_id,
    userId:       r.user_id,
    userName:     r.user_name,
    userInitials: r.user_initials,
    rating:       r.rating,
    text:         r.text,
    createdAt:    r.created_at,
  };
}

function rowToFavorite(r: FavoriteRow): FavoriteMachine {
  return {
    id:        r.id,
    userId:    r.user_id,
    machineId: r.machine_id,
    createdAt: r.created_at,
  };
}

/**
 * Given already-mapped MachineReview[], overwrite each review's userName
 * with the reviewer's CURRENT nickname from `profiles` (live), falling back
 * to the review's originally-stored userName if the profile lookup fails,
 * the profile has no nickname set, or the profile no longer exists.
 * userInitials is intentionally left as-is (no live equivalent field exists
 * on profiles) — only the display name is kept in sync with the user's
 * current nickname.
 */
async function withCurrentNicknames(reviews: MachineReview[]): Promise<MachineReview[]> {
  if (reviews.length === 0) return reviews;

  const uniqueUserIds = [...new Set(reviews.map(r => r.userId))];

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, nickname')
    .in('id', uniqueUserIds);

  if (error || !profiles) {
    if (__DEV__ && error) console.warn('[db/reviews] withCurrentNicknames profile lookup error, keeping stored names:', error.message);
    return reviews;
  }

  const nicknameById = new Map<string, string | null>(
    profiles.map((p: { id: string; nickname: string | null }) => [p.id, p.nickname])
  );

  return reviews.map(r => {
    const currentNickname = nicknameById.get(r.userId);
    return currentNickname ? { ...r, userName: currentNickname } : r;
  });
}

// --- machine_reviews

/** Fetch all reviews for a machine, newest-first. Falls back to mock. */
export async function fetchMachineReviews(machineId: string): Promise<MachineReview[]> {
  const { data, error } = await supabase
    .from('machine_reviews')
    .select('id, machine_id, user_id, user_name, user_initials, rating, text, created_at')
    .eq('machine_id', machineId)
    .order('created_at', { ascending: false });

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/reviews] fetchMachineReviews error, using mock:', error.message);
    return mockGetMachineReviews(machineId);
  }
  return withCurrentNicknames(data.map(rowToReview));
}

/** Fetch all reviews (admin use). Falls back to mock. */
export async function fetchAllReviews(): Promise<MachineReview[]> {
  const { data, error } = await supabase
    .from('machine_reviews')
    .select('id, machine_id, user_id, user_name, user_initials, rating, text, created_at')
    .order('created_at', { ascending: false });

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/reviews] fetchAllReviews error, using mock:', error.message);
    return MACHINE_REVIEWS;
  }
  return withCurrentNicknames(data.map(rowToReview));
}

/** Insert a review. Returns inserted row or throws. */
export async function insertMachineReview(
  review: Omit<MachineReview, 'id'> & { id?: string },
): Promise<MachineReview> {
  const { data, error } = await supabase
    .from('machine_reviews')
    .insert({
      id:            review.id,
      machine_id:    review.machineId,
      user_id:       review.userId,
      user_name:     review.userName,
      user_initials: review.userInitials,
      rating:        review.rating,
      text:          review.text,
      created_at:    review.createdAt,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'insertMachineReview failed');
  return rowToReview(data);
}

// --- favorite_machines

/** Fetch favorite machine ids for a user. Falls back to mock. */
export async function fetchUserFavorites(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('favorite_machines')
    .select('machine_id')
    .eq('user_id', userId);

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/reviews] fetchUserFavorites error, using mock:', error.message);
    return mockGetUserFavorites(userId);
  }
  return data.map((r: { machine_id: string }) => r.machine_id);
}

/** Fetch all favorite rows for a user. Falls back to mock. */
export async function fetchUserFavoriteRows(userId: string): Promise<FavoriteMachine[]> {
  const { data, error } = await supabase
    .from('favorite_machines')
    .select('id, user_id, machine_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/reviews] fetchUserFavoriteRows error, using mock:', error.message);
    return FAVORITE_MACHINES.filter(f => f.userId === userId);
  }
  return data.map(rowToFavorite);
}

/** Check whether a user has favorited a machine. Falls back to mock. */
export async function checkIsFavorite(userId: string, machineId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('favorite_machines')
    .select('id')
    .eq('user_id', userId)
    .eq('machine_id', machineId)
    .maybeSingle();

  if (error) {
    if (__DEV__) console.warn('[db/reviews] checkIsFavorite error, using mock:', error.message);
    return mockIsUserFavorite(userId, machineId);
  }
  return data !== null;
}

/** Add a machine to a user's favorites. Returns inserted row or throws. */
export async function addFavorite(
  userId: string,
  machineId: string,
): Promise<FavoriteMachine> {
  const { data, error } = await supabase
    .from('favorite_machines')
    .insert({ user_id: userId, machine_id: machineId, created_at: new Date().toISOString() })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'addFavorite failed');
  return rowToFavorite(data);
}

/** Remove a machine from a user's favorites. Throws on error. */
export async function removeFavorite(userId: string, machineId: string): Promise<void> {
  const { error } = await supabase
    .from('favorite_machines')
    .delete()
    .eq('user_id', userId)
    .eq('machine_id', machineId);

  if (error) throw new Error(error.message);
}
