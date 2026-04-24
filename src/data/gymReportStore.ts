// gymReportStore.ts — in-memory store for gym information reports (정보 제보)

export interface GymInfoReport {
  id: string;
  gymId: string;
  gymName: string;
  reporterUserId?: string;
  reportType: string;
  content: string;
  createdAt: string;
  status: 'pending' | 'reviewed';
}

let reports: GymInfoReport[] = [
  {
    id: 'rep1',
    gymId: 'g01',
    gymName: 'IronHub Fitness',
    reporterUserId: 'u1',
    reportType: 'wrong_hours',
    content: '운영시간이 실제와 다릅니다. 토요일은 오전 10시~오후 6시입니다.',
    createdAt: '2026-03-20T09:00:00Z',
    status: 'pending',
  },
  {
    id: 'rep2',
    gymId: 'g03',
    gymName: 'FitFactory Seoul',
    reporterUserId: 'u3',
    reportType: 'wrong_phone',
    content: '전화번호가 변경되었습니다. 새 번호: 02-5555-6789',
    createdAt: '2026-03-18T14:00:00Z',
    status: 'pending',
  },
];

export function getAllGymInfoReports(): GymInfoReport[] {
  return [...reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getPendingGymInfoReports(): GymInfoReport[] {
  return reports
    .filter(r => r.status === 'pending')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addGymInfoReport(
  report: Omit<GymInfoReport, 'id' | 'status' | 'createdAt'>,
): GymInfoReport {
  const r: GymInfoReport = {
    id: `rep${Date.now()}`,
    ...report,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  reports = [r, ...reports];
  return r;
}

export function markReportReviewed(id: string): void {
  const r = reports.find(x => x.id === id);
  if (r) r.status = 'reviewed';
}

export function deleteGymInfoReport(id: string): void {
  reports = reports.filter(r => r.id !== id);
}
