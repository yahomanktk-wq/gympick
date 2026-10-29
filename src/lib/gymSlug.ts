// 헬스장 영어 이름(slug) 검증 — gympick.kr/{slug} 짧은 주소용.
// DB(gyms.slug CHECK 제약 + public.is_reserved_gym_slug)와 같은 규칙을 클라이언트에서
// 먼저 검사해 즉시 안내하고, 최종 판정은 저장 시 DB 제약이 한다.

export const GYM_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

// public.is_reserved_gym_slug(text)의 배열과 동일하게 유지할 것
export const RESERVED_GYM_SLUGS: readonly string[] = [
  'g', 'gym', 'gyms', 'api', 'assets', 'static', 'public', 'images', 'img', 'css', 'js', 'fonts',
  'privacy', 'terms', 'admin', 'manager', 'login', 'signup', 'auth', 'www', 'app', 'index', 'home',
  'about', 'help', 'support', 'robots.txt', 'sitemap.xml', 'favicon.ico', 'well-known', '.well-known',
  'brandlogos', 'brandscreen', 'config', 'detail', 'logo', 'modal', 'muscles', 'ounwan', 'store',
  'supabase', 'styles', 'og-image', 'readme', 'vercel',
  'download', 'favicon', 'robots', 'sitemap',
];

export type GymSlugValidation = 'empty' | 'invalid_format' | 'reserved' | 'ok';

export const GYM_SLUG_FORMAT_MESSAGE = '영어 소문자, 숫자, 하이픈(-)만 사용할 수 있어요 (3~30자, 하이픈으로 시작·끝 불가)';
export const GYM_SLUG_RESERVED_MESSAGE = '사용할 수 없는 이름이에요';
export const GYM_SLUG_TAKEN_MESSAGE = '이미 사용 중인 이름이에요';

/** 입력값 정리 — 앞뒤 공백 제거 + 소문자 변환 */
export function normalizeGymSlugInput(text: string): string {
  return text.trim().toLowerCase();
}

export function validateGymSlug(slug: string): GymSlugValidation {
  if (!slug) return 'empty';
  if (!GYM_SLUG_REGEX.test(slug)) return 'invalid_format';
  if (RESERVED_GYM_SLUGS.includes(slug.toLowerCase())) return 'reserved';
  return 'ok';
}
