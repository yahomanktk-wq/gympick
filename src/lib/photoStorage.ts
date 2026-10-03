import { supabase } from './supabase';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { generatePhotoBlurhash } from './blurhash';

const BUCKET = 'workout-photos';

// 썸네일 — 홈/피드 그리드 카드(가장 큰 컨텍스트가 WorkoutFeedScreen의 절반 화면 폭
// 그리드 카드)보다 여유 있게 크리스프하도록 세로변 기준 480px, WebP 0.8 품질로 생성.
// WebP는 JPEG와 달리 알파 채널을 지원해 합성 이미지의 둥근 모서리 투명도를 보존한다.
// 원본은 그대로 유지되고 별도 파일로만 업로드된다.
const THUMB_LONG_EDGE = 480;
const THUMB_QUALITY   = 0.8;

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
    .upload(fileName, arrayBuffer, { contentType, upsert: false });

  if (error || !data) {
    console.warn('[photoStorage] upload failed:', error?.message, fileName);
    return null;
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

interface ThumbnailResult {
  url:       string | undefined;
  blurhash?: string;
}

/** 원본은 건드리지 않고, 그리드 썸네일 전용의 작은 별도 변형만 생성해 업로드한다. */
async function uploadThumbnail(
  localUri: string,
  userId: string,
  sessionId: string,
): Promise<ThumbnailResult> {
  try {
    const context  = ImageManipulator.manipulate(localUri);
    const rendered = await context.resize({ height: THUMB_LONG_EDGE }).renderAsync();
    // WebP — JPEG와 달리 알파 채널을 보존해 합성 이미지의 둥근 모서리 투명도가 깨지지 않는다
    // (JPEG는 알파를 지원하지 않아 저장 시 모서리가 불투명 색상으로 채워짐 — iOS는 흰색으로 채움)
    const result   = await rendered.saveAsync({ compress: THUMB_QUALITY, format: SaveFormat.WEBP });

    // blurhash는 이미 리사이즈된 작은 썸네일 로컬 파일에서 바로 계산 — 네트워크
    // 왕복 없이 기기에서 즉시 생성되고, 실패해도(undefined) 업로드는 계속 진행된다.
    const [url, blurhash] = await Promise.all([
      (async () => {
        const thumbFileName = `${userId}/${sessionId}_${Date.now()}_thumb.webp`;
        return uploadToBucket(result.uri, thumbFileName, 'image/webp');
      })(),
      generatePhotoBlurhash(result.uri),
    ]);
    return { url: url ?? undefined, blurhash };
  } catch (err) {
    console.warn('[photoStorage] thumbnail generation failed:', err);
    return { url: undefined };
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
    const fileName  = `${userId}/${sessionId}_${Date.now()}.png`;
    const publicUrl = await uploadToBucket(localUri, fileName, 'image/png');

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

    const thumbnail = await uploadThumbnail(localUri, userId, sessionId);

    return { url: publicUrl, thumbnailUrl: thumbnail.url, blurhash: thumbnail.blurhash };
  } catch (err) {
    console.warn('[photoStorage] upload error:', err);
    return { url: localUri };
  }
}
