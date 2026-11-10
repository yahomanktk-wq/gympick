import { useEffect, useState } from 'react';
import { checkIsGymMember } from '../../../lib/db/gymMembers';

// 2026-11-09: '우리 헬스장만'을 고를 수 있는지 (그 헬스장 회원·트레이너·관장님). null = 확인 중

export function useIsGymMember(gymId: string | null | undefined, userId: string | null | undefined): boolean | null {
  const [member, setMember] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    if (!gymId || !userId) { setMember(false); return; }
    setMember(null);
    checkIsGymMember(gymId, userId).then(v => { if (alive) setMember(v); });
    return () => { alive = false; };
  }, [gymId, userId]);
  return member;
}
