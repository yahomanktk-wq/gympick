// gymAnnouncementStore.ts — in-memory store for gym announcements
// Announcements are posted by gym operators/managers (not users).

export interface GymAnnouncement {
  id: string;
  gymId: string;
  title: string;
  content: string;
  createdAt: string; // ISO date string
}

let announcements: GymAnnouncement[] = [];

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
