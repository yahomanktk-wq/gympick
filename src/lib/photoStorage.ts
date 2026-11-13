import { supabase } from './supabase';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { generatePhotoBlurhash } from './blurhash';
import { PHOTO_VARIANTS, PHOTO_VARIANT_QUALITY, type PhotoVariantTier } from './photoVariants';

const BUCKET = 'workout-photos';

// 표시용 변형 — Supabase Image Transformations(유료 한도 초과) 대신 업로드 시점에
// 미리 만들어 둔다. 규격·파일명 규칙은 photoVariants.ts / photoImageUrl.ts 참고.
//   {base}.png         원본 (보관용, 그대로 유지)
//   {base}_w1024.webp  그리드·홈·일지 칸 (DB thumbnail_uri에 저장)
//   {base}_w2048.webp  피드 상세 전체 화면
// WebP는 알파 채널을 지원해 합성 이미지의 둥근 모서리 투명도를 보존한다.

export interface UploadWorkoutPhotoResult {
  url:           string;
  thumbnailUrl?: string;
  blurhash?:     string;
}

async function uploadToBucket(
  localUri: string,
  fileName: string,
  contentType: string,
): Promise<string | null> {
  const response    = await fetch(localUri);
  const blob        = await response.blob();
  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, arrayBuffer, {
      contentType,
      upsert: false,
      // 파일명이 매번 고유하고 내용이 바뀌지 않으므로 기기·CDN 캐시를 길게 유지
      cacheControl: '31536000',
    });

  if (error || !data) {
    console.warn('[photoStorage] upload failed:', error?.message, fileName);
    return null;
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

interface VariantResult {
  gridUrl?:  string;
  blurhash?: string;
}

/** 원본은 건드리지 않고 표시용 WebP 변형(1024/2048)을 만들어 업로드한다. 원본보다 크게 늘리지 않는다. */
async function uploadVariants(localUri: string, baseName: string): Promise<VariantResult> {
  try {
    const source   = await ImageManipulator.manipulate(localUri).renderAsync();
    const isPortrait = source.height >= source.width;
    const longEdge = Math.max(source.width, source.height);

    const make = async (tier: PhotoVariantTier) => {
      const { longEdge: target, suffix } = PHOTO_VARIANTS[tier];
      const base = ImageManipulator.manipulate(localUri);
      const ctx  = longEdge > target
        ? base.resize(isPortrait ? { height: target } : { width: target })
        : base;
      const rendered = await ctx.renderAsync();
      const saved    = await rendered.saveAsync({ compress: PHOTO_VARIANT_QUALITY, format: SaveFormat.WEBP });
      const url      = await uploadToBucket(saved.uri, `${baseName}${suffix}`, 'image/webp');
      return { localUri: saved.uri, url };
    };

    const [grid, full] = await Promise.all([make('grid'), make('full')]);
    if (!full.url) console.warn('[photoStorage] full variant upload failed:', baseName);
    // blurhash는 작은 그리드 변형 로컬 파일에서 바로 계산 (네트워크 왕복 없음)
    const blurhash = await generatePhotoBlurhash(grid.localUri);
    return { gridUrl: grid.url ?? undefined, blurhash };
  } catch (err) {
    console.warn('[photoStorage] variant generation failed:', err);
    return {};
  }
}

export async function uploadWorkoutPhoto(
  localUri: string,
  userId: string,
  sessionId: string,
  isComposite: boolean = false,
): Promise<UploadWorkoutPhotoResult> {
  try {
    // PNG로 저장 (투명 배경 보존) — 원본 그대로, 기존 동작 변경 없음
    const baseName  = `${userId}/${sessionId}_${Date.now()}`;
    const fileName  = `${baseName}.png`;
    // 원본 업로드와 표시용 변형 생성·업로드를 동시에 진행해 기다리는 시간을 줄인다
    const [publicUrl, variants] = await Promise.all([
      uploadToBucket(localUri, fileName, 'image/png'),
      uploadVariants(localUri, baseName),
    ]);

    if (!publicUrl) {
      return { url: localUri };
    }

    await supabase
      .from('workout_photos')
      .upsert({
        session_id:    sessionId,
        user_id:       userId,
        captured_at:   new Date().toISOString(),
        text_color:    '#FFFFFF',
        composite_uri: isComposite ? publicUrl : null,
        photo_uri:     isComposite ? null : publicUrl,
      });

    return { url: publicUrl, thumbnailUrl: variants.gridUrl, blurhash: variants.blurhash };
  } catch (err) {
    console.warn('[photoStorage] upload error:', err);
    return { url: localUri };
  }
}
