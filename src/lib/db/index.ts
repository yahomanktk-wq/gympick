// --- Supabase DB query layer
// Each module mirrors the mock data helpers in src/data/ but uses Supabase.
// All functions fall back to mock data when Supabase is unreachable or empty,
// so the existing UI continues to work during gradual migration.
//
// Migration pattern for a screen:
//   Before: import { GYMS } from '../../data';
//   After:  import { fetchGyms } from '../../lib/db';
//           const gyms = await fetchGyms();   // or via useFetch() hook

export * from './gyms';
export * from './machines';
export * from './gymMachines';
export * from './workouts';
export * from './reviews';
export * from './managerRequests';
export * from './notifications';
export * from './userProfiles';
export * from './gymReports';
export * from './machineLevels';
export * from './feedPosts';
export * from './rankings';
