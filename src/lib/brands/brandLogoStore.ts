// 2026-11-28: 브랜드 로고 소스 — 앱 번들 로고 + Supabase(brands 표 / brand-logos 버킷)
//
// 속도 우선 규칙
//  - 번들에 있는 로고는 그대로 번들 이미지를 쓴다 (네트워크 0, 지금과 동일한 속도)
//  - 어드민이 로고를 바꾸면 brands.logo_path의 파일명(버전)이 바뀐다 → 그 브랜드만 원격 이미지 사용
//  - 번들에 없는 새 브랜드도 logo_path가 있으면 원격 이미지 사용
//  - 원격 이미지는 앱 시작 시 미리 받아(prefetch) 둔다
//  - brands 목록은 기기 파일 캐시에 저장 → 다음 실행엔 저장본으로 바로 판단, 뒤에서 갱신
//
// 버전이 들어간 파일명은 내용이 바뀌지 않으므로 이미지 캐시를 오래 써도 안전하다.

import { Image as RNImage } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { brandLogos } from '../../constants/brandLogos';
import { supabase } from '../supabase';
import { readPersistedCache, writePersistedCache } from '../db/persistentCache';
import { brandKeyOf } from './brandKey';

/** 번들 로고를 처음 Storage에 올릴 때 쓴 파일명(버전). 이 버전이면 번들 이미지와 같은 그림이다. */
const BUNDLED_VERSION = 've983c02b595e';
const BUCKET = 'brand-logos';
const CACHE_KEY = 'brands-v1';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

interface BrandRow { key: string; logo_path: string | null }

/** RN Image·expo-image 둘 다 받는 형태 (번들 require 번호 또는 원격 주소) */
export type BrandLogoSource = number | { uri: string };

let remoteUrls: Record<string, string> = {}; // 번들 대신 원격 이미지를 쓸 브랜드
let removed = new Set<string>();             // 어드민이 로고를 지운 브랜드 (번들도 숨김)
let started = false;

function publicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

function apply(rows: BrandRow[]): string[] {
  const nextRemote: Record<string, string> = {};
  const nextRemoved = new Set<string>();
  for (const r of rows) {
    const bundled = brandLogos[r.key];
    if (!r.logo_path) {
      if (bundled) nextRemoved.add(r.key);
      continue;
    }
    if (bundled && r.logo_path.endsWith(`/${BUNDLED_VERSION}.webp`)) continue;
    nextRemote[r.key] = publicUrl(r.logo_path);
  }
  remoteUrls = nextRemote;
  removed = nextRemoved;
  return Object.values(nextRemote);
}

function prefetch(urls: string[]) {
  for (const u of urls) {
    RNImage.prefetch(u).catch(() => {});
  }
  if (urls.length > 0) ExpoImage.prefetch(urls, 'memory-disk').catch(() => {});
}

/** 앱 시작 시 한 번. 이 모듈을 처음 import하면 자동 호출된다. */
export function initBrandLogos(): void {
  if (started) return;
  started = true;
  (async () => {
    const cached = await readPersistedCache<BrandRow[]>(CACHE_KEY);
    if (cached) prefetch(apply(cached.data));
    try {
      const { data, error } = await supabase.from('brands').select('key, logo_path');
      if (error || !data) return;
      prefetch(apply(data as BrandRow[]));
      writePersistedCache(CACHE_KEY, data);
    } catch {
      // 오프라인 등 — 번들/저장본으로 계속 동작
    }
  })();
}

/** 로고 키(LIFE_FITNESS)로 이미지 소스. 없으면 undefined. */
export function getBrandLogoByKey(key: string): BrandLogoSource | undefined {
  if (removed.has(key)) return undefined;
  const url = remoteUrls[key];
  if (url) return { uri: url };
  return brandLogos[key];
}

/** 브랜드명('Life Fitness')으로 이미지 소스. 없으면 undefined. */
export function getBrandLogo(brand: string | null | undefined): BrandLogoSource | undefined {
  if (!brand) return undefined;
  return getBrandLogoByKey(brandKeyOf(brand));
}

initBrandLogos();
