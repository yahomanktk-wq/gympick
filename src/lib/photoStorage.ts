import { supabase } from './supabase';

const BUCKET = 'workout-photos';

export async function uploadWorkoutPhoto(
  localUri: string,
  userId: string,
  sessionId: string,
  isComposite: boolean = false,
): Promise<string> {
  try {
    const ext      = localUri.split('.').pop()?.split('?')[0] ?? 'jpg';
    const fileName = `${userId}/${sessionId}_${Date.now()}.${ext}`;

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
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        upsert:      false,
      });

    if (error || !data) {
      console.warn('[photoStorage] upload failed:', error?.message);
      return localUri;
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(data.path);

    const publicUrl = urlData.publicUrl;

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

    return publicUrl;
  } catch (err) {
    console.warn('[photoStorage] upload error:', err);
    return localUri;
  }
}
