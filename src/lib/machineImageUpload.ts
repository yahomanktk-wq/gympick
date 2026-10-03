import { supabase } from './supabase';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { generatePhotoBlurhash } from './blurhash';

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
  upsert:      boolean,
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
    .upload(fileName, arrayBuffer, { contentType, upsert });

  if (error || !data) {
    console.warn('[machineImageUpload] upload failed:', error?.message, fileName);
    return null;
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

export interface UploadMachineImageResult {
  url:       string | null;
  blurhash?: string;
}

/**
 * 이미 흰 배경 정사각형으로 합성된 로컬 이미지(오프스크린 캡처 결과)를
 * webp로 변환해 `machine-images` 버킷에 `${machineId}.webp`로 업로드하고
 * 공개 URL을 반환한다. 캡처 결과가 이미 800×800이어도 기기별 캡처 오차에
 * 대비해 한 번 더 정확히 리사이즈한다.
 *
 * blurhash도 이 변환된 로컬 webp 파일에서 바로 함께 계산한다 — 어드민 앱에서
 * 등록하는 경로는 이미지가 이미 기기 메모리에 있으므로 네트워크 왕복 없이
 * 즉시 생성 가능하다(Supabase SQL Editor로 직접 벌크 insert하는 경로는 이
 * 함수를 거치지 않으므로, 그 경로는 기존 DB 트리거+Edge Function이 그대로
 * 커버한다 — 두 경로가 상호 보완적으로 동작).
 *
 * options.upsert — 기존 머신 수정 시 같은 id의 이미지를 새로 교체할 때 true로
 * 전달한다(기본값 false = 신규 등록, 파일이 이미 있으면 실패해야 정상).
 */
export async function uploadMachineImage(
  squareLocalUri: string,
  machineId:      string,
  options?:       { upsert?: boolean },
): Promise<UploadMachineImageResult> {
  try {
    const context  = ImageManipulator.manipulate(squareLocalUri);
    const rendered = await context.resize({ width: IMAGE_SIZE, height: IMAGE_SIZE }).renderAsync();
    const result   = await rendered.saveAsync({ compress: IMAGE_QUALITY, format: SaveFormat.WEBP });

    const [url, blurhash] = await Promise.all([
      uploadToBucket(result.uri, `${machineId}.webp`, 'image/webp', options?.upsert ?? false),
      generatePhotoBlurhash(result.uri),
    ]);
    return { url, blurhash };
  } catch (err) {
    console.warn('[machineImageUpload] convert/upload error:', err);
    return { url: null };
  }
}
