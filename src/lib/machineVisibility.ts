// 머신 찾기 탭 노출 규칙 — 유산소(cardio) 머신은 기본 목록에서 숨기고,
// 부위 필터가 OTHER이거나 검색어가 있을 때만 보여준다.

// DB category 값은 'CARDIO'(대문자)로 저장되어 있음 — 대소문자 무시로 비교
export function isCardioMachine(m: { category?: string | null }): boolean {
  return (m.category ?? '').trim().toLowerCase() === 'cardio';
}

export function shouldShowCardio(selectedPart: string, searchQuery: string): boolean {
  return selectedPart.trim().toLowerCase() === 'other' || searchQuery.trim().length > 0;
}
