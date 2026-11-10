// 2026-11-09: 오운완 공개 범위
// - public  전체 공개   : 누구나 (오늘의 오운완 · 헬스장 페이지 · 웹 보유머신 페이지)
// - gym     우리 헬스장만: 그 헬스장 회원·트레이너·관장님 + 나 (웹에는 안 보임)
// - private 나만 보기   : 나만
// DB에서는 visibility가 기준이고, is_public/show_on_gym은 트리거가 맞춰준다.

export type FeedVisibility = 'public' | 'gym' | 'private';

export const DEFAULT_FEED_VISIBILITY: FeedVisibility = 'public';

export const VISIBILITY_ORDER: FeedVisibility[] = ['public', 'gym', 'private'];

export const VISIBILITY_META: Record<FeedVisibility, { label: string; icon: 'earth-outline' | 'people-outline' | 'lock-closed-outline'; desc: string }> = {
  public:  { label: '전체 공개',     icon: 'earth-outline',       desc: '오늘의 오운완 · 헬스장 페이지에 보여요' },
  gym:     { label: '우리 헬스장만', icon: 'people-outline',      desc: '이 헬스장 회원에게만 보여요' },
  private: { label: '나만 보기',     icon: 'lock-closed-outline', desc: '나만 볼 수 있어요' },
};

export function toFeedVisibility(raw: unknown, isPublicFallback?: boolean): FeedVisibility {
  if (raw === 'public' || raw === 'gym' || raw === 'private') return raw;
  return isPublicFallback === false ? 'private' : 'public';
}
