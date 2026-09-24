import { supabase } from './supabase';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// 어드민 머신 등록 화면 전용 이미지 업로드 모듈.
// 정사각형 합성(흰 배경 800×800, contain 배치) 자체는 UI 컴포넌트에서
// react-native-view-shot의 captureRef로 수행하고, 이 파일은 그 결과물을
// webp로 변환해 Storage에 올리는 것만 담당한다(photoStorage.ts와 동일한
// 책임 분리 — uploadToBucket 헬퍼도 같은 패턴을 그대로 따름).

const BUCKET        = 'machine-images';
const IMAGE_SIZE    = 800;  // 기존 1,984개 머신 이미지와 동일한 800×800 규격
const IMAGE_QUALITY = 0.9;

async function uploadToBucket(
  localUri:    string,
  fileName:    string,
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
    console.warn('[machineImageUpload] upload failed:', error?.message, fileName);
    return null;
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

/**
 * 이미 흰 배경 정사각형으로 합성된 로컬 이미지(오프스크린 캡처 결과)를
 * webp로 변환해 `machine-images` 버킷에 `${machineId}.webp`로 업로드하고
 * 공개 URL을 반환한다. 캡처 결과가 이미 800×800이어도 기기별 캡처 오차에
 * 대비해 한 번 더 정확히 리사이즈한다.
 */
export async function uploadMachineImage(
  squareLocalUri: string,
  machineId:      string,
): Promise<string | null> {
  try {
    const context  = ImageManipulator.manipulate(squareLocalUri);
    const rendered = await context.resize({ width: IMAGE_SIZE, height: IMAGE_SIZE }).renderAsync();
    const result   = await rendered.saveAsync({ compress: IMAGE_QUALITY, format: SaveFormat.WEBP });

    return await uploadToBucket(result.uri, `${machineId}.webp`, 'image/webp');
  } catch (err) {
    console.warn('[machineImageUpload] convert/upload error:', err);
    return null;
  }
}
