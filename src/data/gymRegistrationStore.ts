// gymRegistrationStore.ts — in-memory store for gym registration and edit requests

export type GymRegStatus = 'pending' | 'approved' | 'rejected';

export interface RegistrationGym {
  id: string;
  name: string;
  location: string;
  managerId: string;
  managerName: string;
  submittedAt: string;
  status: GymRegStatus;
}

export interface EditRequest {
  id: string;
  gymId: string;
  gymName: string;
  field: string;
  oldValue: string;
  newValue: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
}

// ── Mock data ─────────────────────────────────────────────────

let pendingGyms: RegistrationGym[] = [
  { id: 'pg1', name: 'PowerFit 강남점', location: '서울 강남구', managerId: 'u2', managerName: 'Jordan Kim', submittedAt: '2026-03-10T09:00:00Z', status: 'pending' },
  { id: 'pg2', name: 'IronZone 홍대점', location: '서울 마포구', managerId: 'u4', managerName: 'Chris Oh', submittedAt: '2026-03-12T14:00:00Z', status: 'pending' },
  { id: 'pg3', name: 'FlexGym 분당점', location: '경기 성남시', managerId: 'u5', managerName: 'Min Park', submittedAt: '2026-03-13T11:00:00Z', status: 'pending' },
];

let editRequests: EditRequest[] = [
  { id: 'er1', gymId: 'g01', gymName: 'IronHub Fitness', field: '운영시간', oldValue: '09:00~22:00', newValue: '06:00~24:00', status: 'pending', submittedAt: '2026-03-11T10:00:00Z' },
  { id: 'er2', gymId: 'g04', gymName: 'MaxLift Arena', field: '전화번호', oldValue: '02-1234-5678', newValue: '02-9876-5432', status: 'pending', submittedAt: '2026-03-13T15:00:00Z' },
];

// ── Gym registration queries / mutations ──────────────────────

export function getPendingGyms(): RegistrationGym[] {
  return pendingGyms.filter((g) => g.status === 'pending');
}

export function getAllGymsForAdmin(): RegistrationGym[] {
  return [...pendingGyms];
}

export function updateGymStatus(gymId: string, status: GymRegStatus): void {
  const gym = pendingGyms.find((g) => g.id === gymId);
  if (gym) gym.status = status;
}

// ── Edit request queries / mutations ─────────────────────────

export function getPendingEditRequests(): EditRequest[] {
  return editRequests.filter((r) => r.status === 'pending');
}

export function getAllEditRequests(): EditRequest[] {
  return [...editRequests];
}

export function updateEditRequestStatus(
  requestId: string,
  status: 'approved' | 'rejected',
): void {
  const req = editRequests.find((r) => r.id === requestId);
  if (req) req.status = status;
}
