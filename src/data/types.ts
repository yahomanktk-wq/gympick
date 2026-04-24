export interface Machine {
  id: string;
  name: string;
  brand: string;
  targetMuscle: string;
  category: string;
  gymIds: string[];
}

export interface Gym {
  id: string;
  name: string;
  location: string;
  description: string;
  machineIds: string[];
}

export interface GymWithMachines extends Gym {
  machines: Machine[];
}

export type FilterType = 'machine' | 'brand' | 'muscle' | 'category';

export interface FilterChip {
  label: string;
  type: FilterType;
}

// ─── Role & status types ──────────────────────────────────────────────────────

export type UserRole = 'user' | 'manager' | 'admin';
export type GymStatus = 'pending' | 'approved' | 'rejected' | 'flagged';
export type FlagType = 'duplicate' | 'incorrect_info' | 'closed';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

// ─── Manager-specific types ───────────────────────────────────────────────────

export interface ManagedGym {
  id: string;
  name: string;
  location: string;
  description: string;
  phone: string;
  website: string;
  hours: string;
  machineIds: string[];
  managerId: string;
  status: GymStatus;
  submittedAt: string;
  photoCount: number;
}

// ─── Admin queue types ────────────────────────────────────────────────────────

export interface PendingGym {
  id: string;
  name: string;
  location: string;
  description: string;
  phone: string;
  website: string;
  hours: string;
  managerId: string;
  managerName: string;
  submittedAt: string;
  status: ReviewStatus;
}

export interface PendingEdit {
  id: string;
  gymId: string;
  gymName: string;
  field: string;
  oldValue: string;
  newValue: string;
  managerId: string;
  managerName: string;
  submittedAt: string;
  status: ReviewStatus;
}

export interface FlaggedItem {
  id: string;
  type: FlagType;
  gymId: string;
  gymName: string;
  description: string;
  reportedBy: string;
  reportedAt: string;
  status: 'open' | 'resolved';
}
