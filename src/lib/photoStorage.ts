import { supabase } from './supabase';

const BUCKET = 'workout-photos';

/**
 * 로컬 URI의 이미지를 Supabase Storage에 업로드하고 public URL 반환
 * 실패 시 원본 로컬 URI 반환 (fallback)
 */
export async function uploadWorkoutPhoto(
  localUri: string,
  userId: string,
  sessionId: string,
): Promise<string> {
  try {
    const ext      = localUri.split('.').pop() ?? 'jpg';
    const fileName = `${userId}/${sessionId}_${Date.now()}.${ext}`;

    const response    = await fetch(localUri);
    const blob        = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, arrayBuffer, {
        contentType: `image/${ext}`,
        upsert:      false,
      });

    if (error || !data) {
      console.warn('[photoStorage] upload failed:', error?.message);
      return localUri;
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (err) {
    console.warn('[photoStorage] upload error:', err);
    return localUri;
  }
}
