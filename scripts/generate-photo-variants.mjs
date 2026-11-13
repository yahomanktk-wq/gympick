// generate-photo-variants.mjs
// 오운완 사진(workout-photos 버킷)의 표시용 WebP 변형을 일괄 생성한다.
//
//   {base}.png  →  {base}_w1024.webp (긴 변 1024px), {base}_w2048.webp (긴 변 2048px)
//
// 앱(src/lib/photoVariants.ts)과 같은 규격이다. 숫자를 바꾸면 두 곳을 함께 바꿀 것.
// 이미 변형이 있는 사진은 건너뛰므로 여러 번 실행해도 안전하다(구버전 앱이 올린
// 사진이 쌓였을 때 다시 돌리면 빠진 것만 채운다). DB는 수정하지 않는다.
//
// 실행 (PowerShell, 프로젝트 폴더에서):
//   npm i --no-save sharp
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<Supabase 대시보드 > Settings > API Keys 의 service_role 키>"
//   node scripts/generate-photo-variants.mjs --dry-run   # 무엇을 만들지 목록만 출력
//   node scripts/generate-photo-variants.mjs             # 실제 생성·업로드
//
// service_role 키는 이 터미널 환경변수로만 전달한다 — 파일에 저장하거나 커밋하지 말 것.

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const BUCKET   = 'workout-photos';
const VARIANTS = [
  { suffix: '_w1024.webp', longEdge: 1024 },
  { suffix: '_w2048.webp', longEdge: 2048 },
];
const QUALITY  = 85; // 앱의 PHOTO_VARIANT_QUALITY(0.85)와 동일
const DERIVED  = ['_thumb.webp', ...VARIANTS.map(v => v.suffix)];
const DRY_RUN  = process.argv.includes('--dry-run');

function readEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = readEnvFile();
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('EXPO_PUBLIC_SUPABASE_URL을 찾지 못했습니다 (.env 확인).');
  process.exit(1);
}
if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다. 파일 상단 실행 방법을 참고하세요.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** 버킷 전체 파일 경로 목록 (폴더 재귀) */
async function listAll(prefix = '') {
  const files = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`목록 조회 실패 (${prefix || '/'}): ${error.message}`);
    if (!data || data.length === 0) break;
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) files.push(...await listAll(full)); // 폴더
      else files.push(full);
    }
    if (data.length < 1000) break;
    offset += data.length;
  }
  return files;
}

function baseOf(name) {
  const dot = name.lastIndexOf('.');
  return dot > name.lastIndexOf('/') ? name.slice(0, dot) : name;
}

async function main() {
  console.log(`${DRY_RUN ? '[미리보기] ' : ''}${BUCKET} 버킷 조회 중...`);
  const all      = await listAll();
  const existing = new Set(all);
  const originals = all.filter(n => !DERIVED.some(sfx => n.endsWith(sfx)) && /\.(png|jpe?g|webp|heic)$/i.test(n));

  const jobs = [];
  for (const name of originals) {
    const missing = VARIANTS.filter(v => !existing.has(`${baseOf(name)}${v.suffix}`));
    if (missing.length > 0) jobs.push({ name, missing });
  }
  console.log(`원본 ${originals.length}개 중 변형이 필요한 사진 ${jobs.length}개`);
  if (DRY_RUN) {
    for (const j of jobs) console.log(` - ${j.name} → ${j.missing.map(v => v.suffix).join(', ')}`);
    return;
  }

  let ok = 0, fail = 0;
  for (const [i, job] of jobs.entries()) {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(job.name);
      if (error || !data) throw new Error(error?.message ?? '다운로드 실패');
      const input = Buffer.from(await data.arrayBuffer());

      for (const v of job.missing) {
        const output = await sharp(input)
          .rotate() // EXIF 방향 반영
          .resize({ width: v.longEdge, height: v.longEdge, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: QUALITY, alphaQuality: 100 })
          .toBuffer();
        const target = `${baseOf(job.name)}${v.suffix}`;
        const up = await supabase.storage.from(BUCKET).upload(target, output, {
          contentType: 'image/webp',
          upsert: false,
          cacheControl: '31536000',
        });
        if (up.error && !/exists|Duplicate/i.test(up.error.message)) throw new Error(`${target}: ${up.error.message}`);
      }
      ok++;
      console.log(`[${i + 1}/${jobs.length}] 완료 ${job.name}`);
    } catch (err) {
      fail++;
      console.warn(`[${i + 1}/${jobs.length}] 실패 ${job.name}: ${err.message}`);
    }
  }
  console.log(`\n끝: 성공 ${ok}개, 실패 ${fail}개`);
  if (fail > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
