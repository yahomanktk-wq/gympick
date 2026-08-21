// appUpdate.ts — 앱 업데이트 필요 여부 확인
// Supabase의 app_update_config(싱글 로우) 테이블을 읽어 현재 설치된 버전과 비교한다.
// 테이블/네트워크 오류 시에는 항상 null을 반환해 업데이트 체크를 조용히 건너뛴다
// (앱 이용 자체를 막지 않기 위한 안전한 fallback — 다른 읽기 함수들과 동일한 컨벤션).

import { supabase } from '../supabase';

export interface AppUpdateConfig {
  minVersion: string;
  latestVersion: string;
  message?: string;
}

export type UpdateStatus = 'none' | 'recommended' | 'required';

export async function fetchAppUpdateConfig(): Promise<AppUpdateConfig | null> {
  try {
    const { data, error } = await supabase
      .from('app_update_config')
      .select('min_version, latest_version, message')
      .eq('id', 1)
      .single();

    if (error || !data) return null;

    return {
      minVersion:    data.min_version,
      latestVersion: data.latest_version,
      message:       data.message ?? undefined,
    };
  } catch {
    return null;
  }
}

/** '1.2.0' 형태의 버전 문자열 비교. a < b → -1, a === b → 0, a > b → 1 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na < nb ? -1 : 1;
  }
  return 0;
}

/** 현재 설치된 버전과 서버 설정을 비교해 업데이트 상태를 판단한다. */
export function getUpdateStatus(currentVersion: string, config: AppUpdateConfig): UpdateStatus {
  if (compareVersions(currentVersion, config.minVersion) < 0)    return 'required';
  if (compareVersions(currentVersion, config.latestVersion) < 0) return 'recommended';
  return 'none';
}
