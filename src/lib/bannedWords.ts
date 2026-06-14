import { supabase } from './supabase';

let cachedWords: string[] | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 1000 * 60 * 10; // 10분 캐시

export async function fetchBannedWords(): Promise<string[]> {
  const now = Date.now();
  if (cachedWords && now - cacheTime < CACHE_TTL) return cachedWords;

  try {
    const { data } = await supabase
      .from('banned_words')
      .select('word');
    cachedWords = (data ?? []).map((r: { word: string }) => r.word.toLowerCase());
    cacheTime = now;
    return cachedWords;
  } catch {
    return cachedWords ?? [];
  }
}

export async function containsBannedWord(text: string): Promise<string | null> {
  const words = await fetchBannedWords();
  const lower = text.toLowerCase();
  const found = words.find(w => lower.includes(w));
  return found ?? null;
}
