// 2026-10-19 (F6-2a): 헬스장/머신 링크 파서 (React 비의존, 순수 함수).
// QR·웹 링크(https://gympick.app/gym/{id}[#machine={id}])와 커스텀 스킴
// (gympick://gym/{id}[...])을 앱에서 열 대상으로 바꾼다.
//
// 예:
//   https://gympick.app/gym/g_1781705845440                       → { gymId: 'g_1781705845440' }
//   https://gympick.app/gym/g_1781705845440#machine=panatta_leg_38 → { gymId: 'g_1781705845440', machineId: 'panatta_leg_38' }
//   https://www.gympick.app/gym/g_1?machine=m_2                    → { gymId: 'g_1', machineId: 'm_2' }
//   gympick://gym/g_1/                                            → { gymId: 'g_1' }
//   gympick:///gym/g_1                                            → { gymId: 'g_1' }  (일부 런처의 슬래시 3개 형태)
//   gympick://reset-password#access_token=x                       → null
//   https://gympick.app/                                          → null

export interface GymLinkTarget { gymId: string; machineId?: string; }

const ID_RE = /^[A-Za-z0-9_-]+$/;

// scheme + host 부분: https?://(www.)gympick.app/  또는  gympick:// (gympick:/// 도 허용)
const GYM_LINK_RE = /^(?:https?:\/\/(?:www\.)?gympick\.app\/|gympick:\/\/\/?)gym\/([^/?#]+)\/?(\?[^#]*)?(#.*)?$/i;

function safeDecode(v: string): string | null {
  try { return decodeURIComponent(v); } catch { return null; }
}

function validId(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const decoded = safeDecode(raw);
  return decoded && ID_RE.test(decoded) ? decoded : undefined;
}

// 'a=1&machine=x' 형태에서 machine 값 추출
function machineParam(part: string | undefined): string | undefined {
  if (!part) return undefined;
  for (const pair of part.replace(/^[?#]/, '').split('&')) {
    const [k, v] = pair.split('=');
    if (k === 'machine') return validId(v);
  }
  return undefined;
}

/** gympick.app/gym/{id}[#machine=..|?machine=..] 또는 gympick://gym/{id}[...] → 대상. 해당 없으면 null */
export function parseGymLink(url: string): GymLinkTarget | null {
  if (!url) return null;
  const m = GYM_LINK_RE.exec(url.trim());
  if (!m) return null;

  const gymId = validId(m[1]);
  if (!gymId) return null;

  const machineId = machineParam(m[3]) ?? machineParam(m[2]);   // #machine= 우선, 없으면 ?machine=
  return machineId ? { gymId, machineId } : { gymId };
}
