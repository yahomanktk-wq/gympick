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

const managedGyms: ManagedGymRecord[] = [];

export function getGymMachineIds(gymId: string): string[] {
  const record = managedGyms.find(g => g.id === gymId);
  if (!record) return getGymMachineIdsFromJoinTable(gymId);
  if (record.machineIds.length === 0) {
    record.machineIds = getGymMachineIdsFromJoinTable(gymId);
  }
  return [...record.machineIds];
}

export function updateGymMachines(gymId: string, machineIds: string[]): void {
  const gym = managedGyms.find(g => g.id === gymId);
  if (gym) gym.machineIds = [...machineIds];
}
