const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const BUCKET       = 'machine-images';
const DEFAULT_QUALITY = 75;

/**
 * Supabase Dashboard → Storage → Settings에서 "Enable Image Transformations"를
 * 켜고 프로젝트가 Pro 플랜 이상인 것을 직접 확인한 뒤에만 true로 바꿀 것.
 * false인 동안은 width/quality 옵션을 전부 무시하고 항상 원본(object/public)
 * URL을 반환한다 — render 엔드포인트 자체를 호출하지 않으므로, 사전 조건이
 * 아직 갖춰지지 않은 상태에서도 기존과 동일하게 안전하게 동작한다.
 */
const IMAGE_TRANSFORM_ENABLED = false;

export interface MachineImageUrlOptions {
  width?:   number;
  quality?: number;
}

/**
 * 머신 이미지(machine-images 버킷, 800×800 WebP) URL을 생성한다.
 * - options 없이 호출하거나 IMAGE_TRANSFORM_ENABLED가 false면 원본 그대로의
 *   public URL을 반환한다.
 * - width를 주고 변환이 활성화된 경우에만 Supabase Storage의 Image
 *   Transformation render 엔드포인트로 리사이즈된 URL을 반환한다.
 * - 같은 machineId + 같은 width/quality 조합이면 항상 같은 문자열을 반환하므로
 *   (랜덤/타임스탬프 쿼리 없음) 클라이언트 이미지 캐시가 정상적으로 재사용된다.
 */
export function getMachineImageUrl(
  machineId: string,
  options?: MachineImageUrlOptions,
): string {
  const path        = `${BUCKET}/${machineId}.webp`;
  const originalUrl = `${SUPABASE_URL}/storage/v1/object/public/${path}`;

  if (!IMAGE_TRANSFORM_ENABLED || !options?.width) {
    return originalUrl;
  }

  const width   = Math.round(options.width);
  const quality = options.quality ?? DEFAULT_QUALITY;

  return `${SUPABASE_URL}/storage/v1/render/image/public/${path}?width=${width}&quality=${quality}`;
}
