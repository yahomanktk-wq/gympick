// 2026-11-09: 헬스장 회원 초대 코드 / QR 내용
// QR에는 웹 주소를 담는다: https://gympick.kr/gym/{gymId}?join={CODE}
// - 짐픽 앱 안의 스캐너로 찍으면 → 코드를 꺼내 바로 가입
// - 휴대폰 기본 카메라로 찍으면 → 헬스장 웹페이지가 열림 (앱 설치 유도)

import { WEB_FALLBACK_BASE_URL } from './share';

export const JOIN_CODE_LENGTH = 6;
const CODE_RE = /^[23456789A-HJ-NP-Z]{6}$/;

export function normalizeJoinCode(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidJoinCode(raw: string): boolean {
  return CODE_RE.test(normalizeJoinCode(raw));
}

export function buildJoinUrl(gymId: string, code: string): string {
  return `${WEB_FALLBACK_BASE_URL}/gym/${encodeURIComponent(gymId)}?join=${code}`;
}

/** QR 내용(주소 또는 코드 자체)에서 초대 코드를 꺼낸다. 없으면 null */
export function parseJoinCode(data: string): string | null {
  const text = (data ?? '').trim();
  const m = /[?&#]join=([A-Za-z0-9-]+)/.exec(text);
  const candidate = m ? m[1] : text;
  return isValidJoinCode(candidate) ? normalizeJoinCode(candidate) : null;
}
