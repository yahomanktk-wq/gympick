// 오운완 사진(workout-photos 버킷) 표시용 URL 선택.
//
// Supabase Image Transformations(render 엔드포인트)는 "변환된 원본 이미지 수"로
// 과금되어 매달 한도를 초과했으므로 더 이상 사용하지 않는다. 대신 업로드 시
// (photoStorage.ts) 또는 일괄 스크립트(scripts/generate-photo-variants.mjs)로
// 미리 만들어 둔 WebP 변형을 그대로 불러온다.
//
//   원본: {base}.png
//   그리드용: {base}_w1024.webp  (긴 변 1024px)
//   상세용:   {base}_w2048.webp  (긴 변 2048px)
//
// 크기는 고해상도 폰(배율 3~4) 기준 — 저화질로 보이지 않는 것이 최우선.
// 변형 파일이 아직 없는 사진(구버전 앱이 올린 사진 등)을 위해 항상
// 대체 URL 목록을 함께 돌려주고, FallbackImage가 순서대로 시도한다.

import { PHOTO_VARIANTS, type PhotoVariantTier } from './photoVariants';

const OBJECT_PATH_MARKER = '/storage/v1/object/public/';
const PHOTO_BUCKET_PATH  = `${OBJECT_PATH_MARKER}workout-photos/`;

export type { PhotoVariantTier };

/** 원본 URL → 해당 크기 변형 URL. 변형을 만들 수 없는 URL(로컬 파일 등)이면 undefined. */
export function getPhotoVariantUrl(
  originalUrl: string | undefined,
  tier: PhotoVariantTier,
): string | undefined {
  if (!originalUrl || !originalUrl.includes(PHOTO_BUCKET_PATH)) return undefined;
  const clean = originalUrl.split('?')[0];
  if (clean.endsWith('_thumb.webp')) return undefined; // 구 썸네일은 원본이 아님
  const dot = clean.lastIndexOf('.');
  if (dot <= clean.lastIndexOf('/')) return undefined;
  return `${clean.slice(0, dot)}${PHOTO_VARIANTS[tier].suffix}`;
}

export interface OunwanImageInput {
  /** 원본(합성 이미지 또는 사진) URL */
  original?:  string;
  /** DB의 thumbnail_uri — 구버전 480px 썸네일이거나 새 1024 변형 */
  thumbnail?: string;
}

/**
 * 화면에 표시할 URL 후보를 우선순위대로 반환한다.
 * - grid: 1024 변형 → (구)썸네일 → 원본
 * - full: 2048 변형 → 원본
 * 중복과 빈 값은 제거된다.
 */
export function getOunwanImageSources(
  input: OunwanImageInput,
  tier: PhotoVariantTier,
): string[] {
  const list: (string | undefined)[] = [getPhotoVariantUrl(input.original, tier)];
  if (tier === 'grid') list.push(input.thumbnail);
  list.push(input.original);
  if (tier === 'grid' && !input.original) list.push(input.thumbnail);
  return Array.from(new Set(list.filter((u): u is string => !!u)));
}
