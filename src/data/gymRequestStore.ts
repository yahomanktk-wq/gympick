// gymRequestStore.ts — in-memory store for anonymous gym requests
// 완전 익명 — user_id 없음, 다른 유저에게 비공개.

export interface GymRequest {
  id: string;
  gymId: string;
  message: string;
  createdAt: string; // ISO date string
  read?: boolean;
}

// ── In-memory storage ──────────────────────────────────────────

let requests: GymRequest[] = [];

// ── Mutations ─────────────────────────────────────────────────

/** 익명 요청 전송 — user_id 저장 안 함 */
export function sendRequest(gymId: string, message: string): GymRequest {
  const req: GymRequest = {
    id: `req${Date.now()}`,
    gymId,
    message: message.trim(),
    createdAt: new Date().toISOString(),
    read: false,
  };
  requests = [req, ...requests];
  return req;
}

export function deleteRequest(id: string): void {
  requests = requests.filter((r) => r.id !== id);
}

export function markRequestAsRead(id: string): void {
  const req = requests.find((r) => r.id === id);
  if (req) (req as any).read = true;
}

// ── Queries ───────────────────────────────────────────────────

/** 최신순으로 정렬된 요청 목록 (매니저 전용) */
export function getRequests(gymId: string): GymRequest[] {
  return requests
    .filter((r) => r.gymId === gymId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 특정 헬스장의 최신순 요청 목록 */
export function getRequestsByGymId(gymId: string): GymRequest[] {
  return getRequests(gymId);
}
