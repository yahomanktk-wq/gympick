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
    const ext      = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const fileName = `${userId}/profile.${ext}`;

    // React Native에서는 FileReader 미지원 → FormData 방식 사용
    const formData = new FormData();
    formData.append('file', {
      uri,
      name:  `profile.${ext}`,
      type:  mimeType,
    } as any);

    const uploadUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${fileName}`;

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token ?? '';

    const response = await fetch(uploadUrl, {
      method:  'POST',
      headers: {
        'Authorization':  `Bearer ${accessToken}`,
        'apikey':         process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
        'x-upsert':       'true',
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn('[profileImage] upload failed:', text);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(fileName);

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
