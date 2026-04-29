// =============================================================================
// SECTION 1 - Core database entity types
// Each interface maps 1:1 to a single backend table.
// No cross-entity ID arrays - relationships live in join tables.
// =============================================================================

// --- Shared primitive enums

export type UserRole       = 'user' | 'manager' | 'admin';
export type GymStatus      = 'pending' | 'approved' | 'rejected' | 'flagged';
export type ReviewStatus   = 'pending' | 'approved' | 'rejected';
export type FlagType       = 'duplicate' | 'incorrect_info' | 'closed';
export type MachineCondition = 'good' | 'fair' | 'poor';

// --- profiles

export interface Profile {
  id:            string;
  name:          string;
  email:         string;
  role:          UserRole;
  managedGymIds: string[];   // denormalized convenience field for manager role
  createdAt:     string;     // ISO 8601
}

// --- gyms

export interface Gym {
  id:          string;
  name:        string;
  location:    string;
  description: string;
  latitude?:   number | null;
  longitude?:  number | null;
}

// --- machines

export type ExerciseKind = 'machine' | 'freeweight';

export interface Machine {
  id:           string;
  name:         string;       // internal/management label (e.g. "Arsenal Back 1")
  displayName?: string;       // real user-facing name (e.g. "PEC FLY REAR DELT") — populate when available
  brand:        string;
  targetMuscle: string;
  category:     string;
  exerciseKind: ExerciseKind;
  copyright?:   string;
  imageUrl?:    string;
}

// --- gym_machines (join table)

export interface GymMachineLink {
  gymId:     string;
  machineId: string;
  unitCount: number;
  condition: MachineCondition;
}

// --- workout_sessions

export interface WorkoutSession {
  id:          string;
  userId:      string;
  gymId:       string;
  date:        string;    // ISO 8601
  bodyWeight?: number;    // kg
  notes?:      string;
}

// --- workout_entries

export interface WorkoutEntry {
  id:           string;
  sessionId:    string;
  machineId:    string;
  machineName:  string;    // snapshot - display name at time of logging
  machineBrand: string;    // snapshot - brand at time of logging
  targetMuscle: string;    // snapshot - muscle group at time of logging
  exerciseKind: ExerciseKind; // snapshot - 'machine' | 'freeweight'
  order:        number;    // display order within the session
}

// --- workout_sets

export interface WorkoutSet {
  id:        string;
  entryId:   string;
  setNumber: number;
  weight:    number;    // kg; 0 for cardio / bodyweight exercises
  reps:      number;
  isPR?:     boolean;   // set at write time when a new PR is detected
}

// --- workout_photos

export type PhotoAspectRatio = '4:5' | '1:1' | '9:16';

export interface WorkoutPhoto {
  id:               string;
  sessionId:        string;
  userId:           string;
  capturedAt:       string;          // ISO 8601
  textColor:        string;          // hex - overlay text colour
  aspectRatio?:     PhotoAspectRatio; // defaults to '4:5' when omitted
  titleOverride?:   string;          // custom title instead of auto-generated "MUSCLE DAY"
  originalUrl?:     string;          // raw image from the camera roll
  overlayImageUrl?: string;          // rendered version with stats/text overlay
  compositeUri?:    string;          // Supabase Storage URL of overlay composite image
  photoUri?:        string;          // Supabase Storage URL of raw camera photo
}

// --- machine_reviews

export interface MachineReview {
  id:           string;
  machineId:    string;
  userId:       string;
  userName:     string;
  userInitials: string;
  rating:       number;   // 1-5
  text:         string;
  createdAt:    string;   // ISO 8601
}

// --- favorite_machines

export interface FavoriteMachine {
  id:        string;
  userId:    string;
  machineId: string;
  createdAt: string;   // ISO 8601
}

// =============================================================================
// SECTION 2 - UI-derived / read-model types
// Assembled by joining multiple tables. Not persisted directly.
// =============================================================================

// --- Machine enriched with gym availability
// Used wherever "Available At X gyms" is shown (MachineDetailModal, FindGymScreen).

export interface MachineWithGyms extends Machine {
  gymIds: string[];   // derived from GymMachineLink
}

// --- Gym with its full machine roster joined in
// The primary display type used throughout the app for gym cards and detail views.

export interface GymWithMachines extends Gym {
  machines:   MachineWithGyms[];
  machineIds: string[];   // convenience array, derived from GymMachineLink
}

// --- Aggregated exercise row within a workout log
// Represents a single machine/exercise entry in a displayed session.
// weight/reps = best-weight set for the entry; sets = total set count.

export interface LoggedMachineEntry {
  machineId:    string;
  machineName:  string;
  machineBrand: string;
  targetMuscle: string;
  weight:       number;
  reps:         number;
  sets:         number;
  note?:        string;   // optional per-exercise note
}

// --- Full workout log view
// Denormalized view of a workout session - used by JournalScreen, PostWorkoutLogModal.
// Derived by joining WorkoutSession + WorkoutEntry + WorkoutSet + WorkoutPhoto + Gym.

export interface WorkoutLog {
  id:          string;
  gymId:       string;
  gymName:     string;
  gymLocation: string;
  date:        string;
  bodyWeight?: number;
  machines:    LoggedMachineEntry[];
  hasPhoto:      boolean;
  photoUri?:     string;   // local URI of the raw camera photo
  compositeUri?: string;   // local URI of the overlay composite image (captureRef result)
}

// --- Workout Overlay Badges

export type OverlayBadgeType = 'streak' | 'pr';

export type WorkoutBadge = {
  id:           string;
  type:         OverlayBadgeType;
  label:        string;        // 예: '30일 연속', 'PR 달성'
  achievedAt:   string;        // ISO 8601
  machineName?: string;        // PR 뱃지의 경우 머신명
};

// --- Machine Ranking

export type MachineRankingEntry = {
  rank:         number;                       // 1, 2, 3
  machineId:    string;
  machineName:  string;
  brandName:    string;
  muscle:       string;                       // 'CHEST', 'BACK' 등
  usageCount:   number;                       // 집계 사용 횟수
  usageChange:  'up' | 'down' | 'same';       // 전주 대비 순위 변동
};

// --- Machine Level System

export type MachineLevelData = {
  machineId:        string;
  level:            number;   // 1 ~ 99
  currentXP:        number;   // 현재 레벨 내 XP
  totalXP:          number;   // 전체 누적 XP (통계용)
  lastUsedAt:       string;   // ISO 8601
  weeklyUsageCount: number;   // 이번 주 사용 횟수 (연속 보너스 판단용)
};

// --- Filter UI helpers

export type FilterType = 'machine' | 'brand' | 'muscle' | 'category';

export interface FilterChip {
  label: string;
  type:  FilterType;
}

// --- Workout Feed

export type WorkoutFeedPost = {
  id:          string;
  userId:      string;
  nickname:    string;
  gymId:       string;
  gymName:     string;
  photoUri:     string;           // 오운완 사진 URI (원본)
  compositeUri?: string;          // 오버레이 합성 사진 URI (있으면 우선 표시)
  muscles:     string[];         // 운동 부위 (예: ['CHEST', 'BACK'])
  createdAt:   string;           // ISO 8601
  isPublic:    boolean;
  reactions: {
    muscle: number;              // 💪
    fire:   number;              // 🔥
    clap:   number;              // 👏
    trophy: number;              // 🏆
    flex:   number;              // 😤
  };
  myReaction?:  keyof WorkoutFeedPost['reactions'] | null;
  distanceKm?:  number;          // 주변 탭에서 사용
  isMyPost?:    boolean;         // 내가 저장한 오운완 여부
};

// =============================================================================
// SECTION 3 - Admin / manager workflow types
// Represent queue items and managed-gym profiles, not core data entities.
// =============================================================================

// --- Manager-owned gym profile
// Extended gym record visible to the manager who owns it.
// Machine inventory is accessed via GymMachineLink, not stored here.

export interface ManagedGym {
  id:          string;
  name:        string;
  location:    string;
  description: string;
  phone:       string;
  website:     string;
  hours:       string;
  managerId:   string;
  status:      GymStatus;
  submittedAt: string;
  photoCount:  number;
  machineIds:  string[];
}

// --- Admin review queue

export interface PendingGym {
  id:          string;
  name:        string;
  location:    string;
  description: string;
  phone:       string;
  website:     string;
  hours:       string;
  managerId:   string;
  managerName: string;
  submittedAt: string;
  status:      ReviewStatus;
}

export interface PendingEdit {
  id:          string;
  gymId:       string;
  gymName:     string;
  field:       string;
  oldValue:    string;
  newValue:    string;
  managerId:   string;
  managerName: string;
  submittedAt: string;
  status:      ReviewStatus;
}

export interface FlaggedItem {
  id:          string;
  type:        FlagType;
  gymId:       string;
  gymName:     string;
  description: string;
  reportedBy:  string;
  reportedAt:  string;
  status:      'open' | 'resolved';
}
