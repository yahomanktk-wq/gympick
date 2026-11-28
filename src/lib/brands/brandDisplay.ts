// 2026-11-28: 필터 칩·브랜드 목록에서 브랜드명을 대문자로 통일해 보여준다.
// 표시만 바꾸고 DB 값·필터 비교 값은 그대로 둔다.
// '전체'처럼 한글이 들어간 옵션은 그대로.
export function displayBrand(name: string | null | undefined): string {
  if (!name) return '';
  if (/[ㄱ-ㆎ가-힣]/.test(name)) return name;
  return name.toUpperCase();
}
