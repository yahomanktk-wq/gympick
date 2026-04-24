// managedGymStore.ts — in-memory store for manager's gym machine lists

import { getGymMachineIds as getGymMachineIdsFromJoinTable } from './gymMachines';

export interface ManagedGymRecord {
  id: string;
  name: string;
  location: string;
  status: 'live' | 'pending' | 'rejected' | 'flagged';
  managerId: string;
  machineIds: string[];
}

const managedGyms: ManagedGymRecord[] = [
  { id: 'g01', name: 'IronHub Fitness', location: '서울시 강남구', status: 'live', managerId: 'u2', machineIds: [] },
  { id: 'g02', name: 'PulseZone Gym',   location: '서울시 마포구', status: 'live', managerId: 'u2', machineIds: [] },
];

export function getManagedGymsByManager(managerId: string): ManagedGymRecord[] {
  return managedGyms.filter(g => g.managerId === managerId);
}

export function getManagedGymById(gymId: string): ManagedGymRecord | undefined {
  return managedGyms.find(g => g.id === gymId);
}

export function getGymMachineIds(gymId: string): string[] {
  const record = managedGyms.find(g => g.id === gymId);
  if (!record) return getGymMachineIdsFromJoinTable(gymId);
  if (record.machineIds.length === 0) {
    // Initialize from join table on first access
    record.machineIds = getGymMachineIdsFromJoinTable(gymId);
  }
  return [...record.machineIds];
}

export function updateGymMachines(gymId: string, machineIds: string[]): void {
  const gym = managedGyms.find(g => g.id === gymId);
  if (gym) gym.machineIds = [...machineIds];
}
