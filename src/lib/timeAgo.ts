// 2026-11-04: 댓글·후기용 상대 시간 표시 ("방금", "5분 전", "3시간 전", "2일 전", 그 이상은 날짜)
export function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffMin = Math.floor((Date.now() - t) / 60000);
  if (diffMin < 1)  return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH}시간 전`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7)    return `${diffD}일 전`;
  const d = new Date(t);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const md = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return sameYear ? md : `${d.getFullYear()}년 ${md}`;
}
