import { useCallback, useEffect, useState } from 'react';
import {
  fetchMyMembership, requestGymMembership, cancelMyMembershipRequest, removeGymMember,
  type MembershipStatus,
} from '../../../lib/db/gymMembers';

// 2026-11-09: 헬스장 상세에서 쓰는 내 회원 상태 + 동작

export function useGymMembership(gymId: string | null, userId: string | null | undefined) {
  const [status,  setStatus]  = useState<MembershipStatus>('none');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!gymId || !userId) { setStatus('none'); setLoading(false); return; }
    setLoading(true);
    try { setStatus(await fetchMyMembership(gymId, userId)); }
    finally { setLoading(false); }
  }, [gymId, userId]);

  useEffect(() => { reload(); }, [reload]);

  const request = useCallback(async () => {
    if (!gymId) return 'duplicate' as const;
    const r = await requestGymMembership(gymId);
    setStatus(r === 'already_member' ? 'member' : 'pending');
    return r;
  }, [gymId]);

  const cancelRequest = useCallback(async () => {
    if (!gymId || !userId) return;
    await cancelMyMembershipRequest(gymId, userId);
    setStatus('none');
  }, [gymId, userId]);

  const leave = useCallback(async () => {
    if (!gymId || !userId) return;
    await removeGymMember(gymId, userId);
    setStatus('none');
  }, [gymId, userId]);

  return { status, loading, reload, setStatus, request, cancelRequest, leave };
}
