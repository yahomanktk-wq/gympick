import AsyncStorage from '@react-native-async-storage/async-storage';

// 2026-10-19 (F1-5): 오운완이 운동한 헬스장 페이지에도 노출된다는 안내를
// 이 버전에서 첫 오운완을 올릴 때 업로드 화면에 1회만 보여주기 위한 기록.

function seenKey(userId: string): string {
  return `ounwan_gym_notice_seen:${userId}`;
}

/** 이 유저가 헬스장 노출 안내를 이미 봤는지(= 이 버전에서 오운완을 한 번 이상 올렸는지) */
export async function hasSeenOunwanGymNotice(userId: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(seenKey(userId));
    return v === 'true';
  } catch {
    return true; // 읽기 실패 시 "본 것"으로 간주 — 안내를 반복해서 띄우는 것보단 나은 쪽으로
  }
}

/** 헬스장 노출 안내를 봤다고 기록 (첫 오운완 저장 후 호출) */
export async function markOunwanGymNoticeSeen(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(seenKey(userId), 'true');
  } catch {}
}
