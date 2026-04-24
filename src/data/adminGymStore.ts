// adminGymStore.ts — in-memory store for admin-registered gyms

export interface AdminRegisteredGym {
  id: string;
  name: string;
  location: string;
  phone: string;
  hours: string;
  machineIds: string[];
  createdAt: string;
}

let adminGyms: AdminRegisteredGym[] = [];

export function getAllAdminGyms(): AdminRegisteredGym[] {
  return [...adminGyms].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addAdminGym(
  gym: Omit<AdminRegisteredGym, 'id' | 'createdAt'>,
): AdminRegisteredGym {
  const g: AdminRegisteredGym = {
    id: `admin_gym_${Date.now()}`,
    ...gym,
    createdAt: new Date().toISOString(),
  };
  adminGyms = [g, ...adminGyms];
  return g;
}

export function updateAdminGym(
  id: string,
  update: Partial<Omit<AdminRegisteredGym, 'id' | 'createdAt'>>,
): void {
  adminGyms = adminGyms.map(g => g.id === id ? { ...g, ...update } : g);
}

export function deleteAdminGym(id: string): void {
  adminGyms = adminGyms.filter(g => g.id !== id);
}
