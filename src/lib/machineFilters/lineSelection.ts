// 검색 필터의 라인 선택 (여러 브랜드·여러 라인 동시 선택).
// 키 = "브랜드::라인" (소문자). 어떤 브랜드에 라인을 하나도 안 고르면 그 브랜드 전체.
import { normalizeLine } from './machineLines';

interface LineSource {
  brand?: string | null;
  line?:  string | null;
}

export function lineKey(brand: string, line: string): string {
  return `${brand.toLowerCase()}::${normalizeLine(line).toLowerCase()}`;
}

/** 이 브랜드에 고른 라인이 있는지 */
export function hasLinesForBrand(lines: Set<string>, brand: string): boolean {
  const prefix = `${brand.toLowerCase()}::`;
  for (const k of lines) if (k.startsWith(prefix)) return true;
  return false;
}

/** 라인 조건을 통과하는지 (브랜드 조건은 따로 검사) */
export function machinePassesLines(m: LineSource, lines: Set<string>): boolean {
  if (lines.size === 0 || !m.brand) return true;
  if (!hasLinesForBrand(lines, m.brand)) return true;
  return lines.has(lineKey(m.brand, m.line ?? ''));
}

/** 선택이 풀린 브랜드의 라인은 지운다 */
export function pruneLines(lines: Set<string>, brands: Set<string>): Set<string> {
  const keep = new Set([...brands].map(b => `${b.toLowerCase()}::`));
  const next = new Set([...lines].filter(k => [...keep].some(p => k.startsWith(p))));
  return next.size === lines.size ? lines : next;
}
