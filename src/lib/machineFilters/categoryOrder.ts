// 부위별 세부 종류(머신 category) 목록과 순서 — 검색 화면·보유 머신 수정 화면 공용
import { parseMuscles, toEnMuscle } from '../splitUtils';

interface CategorySource {
  targetMuscle?: string | null;
  category?:     string | null;
}

export const CATEGORY_ORDER: Record<string, string[]> = {
  Chest: [
    'Chest Press', 'Incline Press', 'Decline Press',
    'Fly', 'Incline Fly', 'Chest_Etc',
  ],
  Back: [
    'Pull Down', 'High Row', 'Middle Row', 'Low Row',
    'T-Bar', 'Pullover', 'Chin Dip', 'Back_Etc',
  ],
  Leg: [
    'Leg Press', 'Hack Squat', 'Pendulum Squat', 'Squat Machine',
    'Leg Curl', 'Leg Extention', 'Calf', 'Viking Press', 'Leg_Etc',
  ],
  Shoulder: [
    'Shoulder Press', 'Raise_Side Lateral', 'Rear Delt',
    'Rear Delt / Pec Fly', 'Shoulder_Etc',
  ],
  Arms: [
    'Biceps', 'Triceps', 'Arm_Etc',
  ],
  'Hip (Glutes)': [
    'Hip Press', 'Hip Thrust', 'Hip Abduction', 'Inner Outer', 'Glute_Etc',
  ],
  Other: [
    'Free Weight', 'Etc',
  ],
};

/** 머신 category 문자열 → 종류 배열 ("Chest Press , Incline Press" → 2개) */
export function splitCategories(category?: string | null): string[] {
  if (!category) return [];
  return category.split(',').map(c => c.trim()).filter(c => c.length > 0);
}

/** 칩에 보여줄 이름 (Raise_Side Lateral → Raise · Side Lateral, Chest_Etc → 기타) */
export function categoryLabel(category: string): string {
  if (/_etc$/i.test(category) || category.toLowerCase() === 'etc') return '기타';
  return category.replace(/_/g, ' · ');
}

/** 이 부위 머신들에 실제로 있는 세부 종류 (정해진 순서 → 나머지 알파벳순 → 기타는 맨 뒤) */
export function getCategoriesForMuscle(machines: CategorySource[], muscle: string): string[] {
  if (!muscle || muscle === 'All' || muscle === '전체') return [];
  const lower = muscle.toLowerCase();
  const available = new Set(
    machines
      .filter(m => parseMuscles(m.targetMuscle).some(t => t.toLowerCase() === lower))
      .flatMap(m => splitCategories(m.category)),
  );
  const muscleEn = toEnMuscle(muscle) || muscle;
  const orderKey = muscleEn === 'Glutes' ? 'Hip (Glutes)' : muscleEn;
  const orderedList = CATEGORY_ORDER[orderKey] ?? [];
  const ordered   = orderedList.filter(cat => available.has(cat));
  const remaining = [...available].filter(cat => !orderedList.includes(cat)).sort();
  const combined  = [...ordered, ...remaining];
  const nonEtc    = combined.filter(cat => !cat.toLowerCase().includes('etc'));
  const etcOnly   = combined.filter(cat => cat.toLowerCase().includes('etc'));
  return [...nonEtc, ...etcOnly];
}

export function machineHasCategory(m: CategorySource, category: string): boolean {
  return splitCategories(m.category).includes(category);
}
