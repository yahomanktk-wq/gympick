// gymAnnouncementStore.ts — in-memory store for gym announcements
// Announcements are posted by gym operators/managers (not users).

export interface GymAnnouncement {
  id: string;
  gymId: string;
  title: string;
  content: string;
  createdAt: string; // ISO date string
}

// ── Mock seed data ─────────────────────────────────────────────

let announcements: GymAnnouncement[] = [
  {
    id: 'ann01',
    gymId: 'g01',
    title: '3월 운영시간 변경 안내',
    content: '3월 15일(토)부터 토요일 운영시간이 오전 6시 ~ 오후 8시로 변경됩니다. 이용에 참고 부탁드립니다.',
    createdAt: '2026-03-10T09:00:00.000Z',
  },
  {
    id: 'ann02',
    gymId: 'g01',
    title: '새 머신 입고 완료 — Cable Station',
    content: '요청 많으셨던 Cable Station이 2대 추가 입고되었습니다. 3층 자유중량 구역에서 이용 가능합니다.',
    createdAt: '2026-03-05T11:30:00.000Z',
  },
  {
    id: 'ann03',
    gymId: 'g01',
    title: '3월 PT 특가 이벤트',
    content: '3월 한 달간 10회 PT 등록 시 2회 추가 제공됩니다. 프런트 데스크 또는 앱 내 문의로 신청하세요.',
    createdAt: '2026-03-01T08:00:00.000Z',
  },
  {
    id: 'ann04',
    gymId: 'g02',
    title: '정기 기구 점검 안내 (3/20)',
    content: '3월 20일(금) 오전 6시 ~ 10시 사이 기구 정기 점검이 진행됩니다. 일부 머신 이용이 제한될 수 있습니다.',
    createdAt: '2026-03-08T10:00:00.000Z',
  },
  {
    id: 'ann05',
    gymId: 'g02',
    title: '샤워실 리모델링 완료',
    content: '남성 샤워실 리모델링이 완료되었습니다. 더욱 쾌적한 환경에서 이용하세요.',
    createdAt: '2026-02-28T14:00:00.000Z',
  },
  {
    id: 'ann06',
    gymId: 'g03',
    title: '회원권 갱신 이벤트',
    content: '4월 이전 갱신 시 1개월 추가 혜택을 드립니다. 자세한 내용은 프런트에 문의해주세요.',
    createdAt: '2026-03-09T09:00:00.000Z',
  },
];

// ── Queries ────────────────────────────────────────────────────

/** 최신순으로 정렬된 공지사항 반환 */
export function getAnnouncements(gymId: string): GymAnnouncement[] {
  return announcements
    .filter((a) => a.gymId === gymId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getAnnouncementById(id: string): GymAnnouncement | undefined {
  return announcements.find((a) => a.id === id);
}

export function getAnnouncementsByGymId(gymId: string): GymAnnouncement[] {
  return getAnnouncements(gymId);
}

// ── Mutations (manager-side, for future use) ──────────────────

export function addAnnouncement(
  gymId: string,
  title: string,
  content: string,
): GymAnnouncement {
  const ann: GymAnnouncement = {
    id: `ann${Date.now()}`,
    gymId,
    title,
    content,
    createdAt: new Date().toISOString(),
  };
  announcements = [ann, ...announcements];
  return ann;
}

export function deleteAnnouncement(id: string): void {
  announcements = announcements.filter((a) => a.id !== id);
}
