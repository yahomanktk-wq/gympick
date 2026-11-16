// 다른 사람에게 보이는 이름(오운완·인증샷·후기 등) — 실명 노출 방지용 공용 규칙.
// 닉네임은 서버가 가입 시 자동 생성("형용사 동물")하므로 거의 항상 있지만,
// 혹시 비어 있으면 실명(name) 대신 아래 기본값을 쓴다.

export const FALLBACK_NICKNAME = '짐픽 회원';

export function publicNickname(user: { nickname?: string | null } | null | undefined): string {
  const nick = user?.nickname?.trim();
  return nick ? nick : FALLBACK_NICKNAME;
}
