// 2026-11-28: 브랜드명 → 로고 키 (예: 'Life Fitness' → 'LIFE_FITNESS')
// brands 표의 key, constants/brandLogos.ts의 키와 같은 규칙.
export function brandKeyOf(name: string | null | undefined): string {
  return (name ?? '').trim().toUpperCase().replace(/\s+/g, '_');
}
