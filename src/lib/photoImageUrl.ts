import { IMAGE_TRANSFORM_ENABLED } from './machineImageUrl';

const SUPABASE_URL    = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const DEFAULT_QUALITY  = 75;

const OBJECT_PATH_MARKER = '/storage/v1/object/public/';
const RENDER_PATH_MARKER = '/storage/v1/render/image/public/';

export interface PhotoImageUrlOptions {
  width?:   number;
  height?:  number;
  quality?: number;
}

/**
 * 이미 완성된 Supabase Storage public URL을 받아서,
 * width/height가 주어지면 Image Transformation(render) URL로 변환한다.
 * IMAGE_TRANSFORM_ENABLED가 꺼져 있거나, width가 없거나,
 * 예상한 object/public 경로 패턴이 아니면 원본 URL을 그대로 반환한다.
 */
export function getTransformedImageUrl(
  publicUrl: string | undefined,
  options?: PhotoImageUrlOptions,
): string | undefined {
  if (!publicUrl) return undefined;
  if (!IMAGE_TRANSFORM_ENABLED || !options?.width) return publicUrl;
  if (!publicUrl.includes(OBJECT_PATH_MARKER)) return publicUrl;

  const width   = Math.round(options.width);
  const height  = Math.round(options.height ?? options.width);
  const quality = options.quality ?? DEFAULT_QUALITY;

  const transformedBase = publicUrl.replace(OBJECT_PATH_MARKER, RENDER_PATH_MARKER);
  return `${transformedBase}?width=${width}&height=${height}&quality=${quality}`;
}
