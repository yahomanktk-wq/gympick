// 브랜드별 제품 라인 (machines.line) — 공백 정리, 대소문자만 다른 값은 하나로
interface LineSource {
  brand?: string | null;
  line?:  string | null;
}

export function normalizeLine(line?: string | null): string {
  return (line ?? '').trim();
}

/** 이 브랜드에 있는 라인 목록 (없으면 빈 배열 → 라인 칩·목록을 보여주지 않음) */
export function getLinesForBrand(machines: LineSource[], brand: string): string[] {
  if (!brand || brand === 'All' || brand === '전체') return [];
  const b = brand.toLowerCase();
  const seen = new Map<string, string>();
  for (const m of machines) {
    if ((m.brand ?? '').toLowerCase() !== b) continue;
    const line = normalizeLine(m.line);
    if (!line) continue;
    const key = line.toLowerCase();
    if (!seen.has(key)) seen.set(key, line);
  }
  return [...seen.values()].sort((x, y) => x.localeCompare(y, 'en', { numeric: true, sensitivity: 'base' }));
}

export function machineHasLine(m: LineSource, line: string): boolean {
  return normalizeLine(m.line).toLowerCase() === line.toLowerCase();
}
