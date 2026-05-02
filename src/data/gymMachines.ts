import { GymMachineLink } from './types';

// Mock 데이터 제거 — Supabase gym_machines 테이블에서 fetch하여 사용
export const GYM_MACHINES: GymMachineLink[] = [];

export function getGymMachineIds(gymId: string): string[] {
  return [];
}

export function getMachineGymIds(machineId: string): string[] {
  return [];
}

export function getGymMachineLinks(gymId: string): GymMachineLink[] {
  return [];
}
