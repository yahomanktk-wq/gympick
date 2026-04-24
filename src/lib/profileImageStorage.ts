import { supabase } from './supabase';
import * as ImagePicker from 'expo-image-picker';

const BUCKET = 'profile-images';

export async function pickAndUploadProfileImage(
  userId: string,
): Promise<string | null> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return null;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return null;

    const asset    = result.assets[0];
    const uri      = asset.uri;
    const ext      = uri.split('.').pop()?.split('?')[0] ?? 'jpg';
    const fileName = `${userId}/profile.${ext}`;

    const response    = await fetch(uri);
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
        upsert:      true,
      });

    if (error || !data) {
      console.warn('[profileImage] upload failed:', error?.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(data.path);

    return `${urlData.publicUrl}?t=${Date.now()}`;
  } catch (err) {
    console.warn('[profileImage] error:', err);
    return null;
  }
}

export async function saveProfileImageUrl(
  userId: string,
  url: string,
): Promise<void> {
  await supabase
    .from('profiles')
    .upsert({ id: userId, avatar_url: url, updated_at: new Date().toISOString() });
}

export async function loadProfileImageUrl(
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', userId)
    .single();
  return data?.avatar_url ?? null;
}
