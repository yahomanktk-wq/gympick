// managerApplicationStore.ts — in-memory store for manager role applications

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface ManagerApplication {
  id: string;
  applicantUserId: string;
  applicantName: string;
  gymName: string;
  location: string;
  phone: string;
  message: string;
  createdAt: string;
  status: ApplicationStatus;
}

let applications: ManagerApplication[] = [
  {
    id: 'app1',
    applicantUserId: 'u3',
    applicantName: 'Sam Lee',
    gymName: 'SunriseGym 신촌점',
    location: '서울 서대문구',
    phone: '02-3456-7890',
    message: '5년째 운영 중인 헬스장입니다. GymPick에 등록하고 싶습니다.',
    createdAt: '2026-03-21T10:00:00Z',
    status: 'pending',
  },
];

export function getAllManagerApplications(): ManagerApplication[] {
  return [...applications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getPendingManagerApplications(): ManagerApplication[] {
  return applications
    .filter(a => a.status === 'pending')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addManagerApplication(
  app: Omit<ManagerApplication, 'id' | 'status' | 'createdAt'>,
): ManagerApplication {
  const a: ManagerApplication = {
    id: `app${Date.now()}`,
    ...app,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  applications = [a, ...applications];
  return a;
}

export function updateApplicationStatus(id: string, status: 'approved' | 'rejected'): void {
  const a = applications.find(x => x.id === id);
  if (a) a.status = status;
}
