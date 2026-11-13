import { GYMVISUAL_GIF_IDS } from '../data/freeWeightsGymVisual';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const BUCKET       = 'machine-images';

/**
 * Supabase Image Transformations(render 엔드포인트)는 결제 주기마다 "변환된 원본
 * 이미지 수"로 과금되고 Pro 기본 제공량이 100장뿐이라, 머신 이미지 ~2,000장만으로도
 * 매달 한도를 초과했다(2026-11 기준 3,478장). 머신 원본은 이미 800×800 WebP
 * (평균 ~114KB)로 충분히 가볍고, 고해상도 폰의 카드 크기에서도 원본이 가장 선명하므로
 * 더 이상 변환을 쓰지 않고 항상 원본을 그대로 반환한다.
 */
export interface MachineImageUrlOptions {
  width?:   number;
  height?:  number;
  quality?: number;
}

/**
 * 머신 이미지(machine-images 버킷, 800×800 WebP / 애니메이션 GIF) 원본 public URL을 반환한다.
 * options(width/height/quality)는 기존 호출처 호환을 위해 받기만 하고 무시한다.
 * 항상 같은 machineId → 같은 URL이라 이미지 캐시가 화면 간에 그대로 공유된다.
 */
export function getMachineImageUrl(
  machineId: string,
  options?: MachineImageUrlOptions,
): string {
  const isGif = GYMVISUAL_GIF_IDS.has(machineId);
  const ext   = isGif ? 'gif' : 'webp';

  const path        = `${BUCKET}/${machineId}.${ext}`;
  const originalUrl = `${SUPABASE_URL}/storage/v1/object/public/${path}`;

  void options; // 호출처 호환용 — 크기 옵션은 더 이상 사용하지 않는다
  return originalUrl;
}
