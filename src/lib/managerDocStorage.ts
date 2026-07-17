import { supabase } from './supabase';

const BUCKET = 'manager-verification-docs';

/**
 * Uploads a manager-application verification document (사업자등록증/재직증명서)
 * to the private manager-verification-docs bucket. Returns the storage PATH,
 * not a public URL — the bucket is private (see add_manager_request_storage.sql),
 * so callers must resolve a display URL via getManagerDocSignedUrl().
 */
export async function uploadManagerDoc(
  localUri: string,
  userId: string,
): Promise<string | null> {
  try {
    const ext      = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
    const fileName = `${userId}/${Date.now()}.${ext}`;

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
      console.warn('[managerDocStorage] upload failed:', error?.message);
      return null;
    }
    return data.path;
  } catch (err) {
    console.warn('[managerDocStorage] upload error:', err);
    return null;
  }
}

/** Resolves a stored document path to a temporary signed URL (readable only by the owner or an admin, per bucket RLS). */
export async function getManagerDocSignedUrl(
  path: string,
  expiresInSeconds: number = 3600,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresInSeconds);
    if (error || !data) {
      console.warn('[managerDocStorage] signed url error:', error?.message);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.warn('[managerDocStorage] signed url exception:', err);
    return null;
  }
}
