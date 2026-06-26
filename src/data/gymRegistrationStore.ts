// gymRegistrationStore.ts — in-memory store for gym registration

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

// ── Mock data ─────────────────────────────────────────────────

let pendingGyms: RegistrationGym[] = [
  { id: 'pg1', name: 'PowerFit 강남점', location: '서울 강남구', managerId: 'u2', managerName: 'Jordan Kim', submittedAt: '2026-03-10T09:00:00Z', status: 'pending' },
  { id: 'pg2', name: 'IronZone 홍대점', location: '서울 마포구', managerId: 'u4', managerName: 'Chris Oh', submittedAt: '2026-03-12T14:00:00Z', status: 'pending' },
  { id: 'pg3', name: 'FlexGym 분당점', location: '경기 성남시', managerId: 'u5', managerName: 'Min Park', submittedAt: '2026-03-13T11:00:00Z', status: 'pending' },
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
