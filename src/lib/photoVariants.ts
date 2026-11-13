// 오운완 사진 사전 생성 변형 규격 — 앱(업로드·표시)과 일괄 생성 스크립트가 같은 값을 쓴다.
// 스크립트(scripts/generate-photo-variants.mjs)에도 같은 숫자가 있으니 바꿀 때 함께 바꿀 것.

export type PhotoVariantTier = 'grid' | 'full';

export const PHOTO_VARIANTS: Record<PhotoVariantTier, { longEdge: number; suffix: string }> = {
  grid: { longEdge: 1024, suffix: '_w1024.webp' },
  full: { longEdge: 2048, suffix: '_w2048.webp' },
};

/** WebP 압축 품질 (0~1) — 고해상도 폰에서도 압축 티가 나지 않도록 높게 유지 */
export const PHOTO_VARIANT_QUALITY = 0.85;
