// upload-gymvisual-gifs.js
// Gym Visual에서 구매한 129개 GIF(360px, D:\시작\gympick\gymvisual-gifs\360\)를
// Supabase Storage의 machine-images 버킷에 fw45.gif ~ fw173.gif 이름으로 업로드한다.
//
// ⚠️ service-role 키가 필요합니다. 이 키는 절대 파일/코드/채팅에 저장하지 말고,
//    실행할 때마다 터미널 환경변수로만 넘겨주세요.
//
// 사용법 (프로젝트 루트에서, PowerShell 기준):
//   $env:SUPABASE_SERVICE_ROLE_KEY = "여기에 매번 직접 붙여넣기 — 이 파일에 절대 저장하지 말 것"
//   node scripts/upload-gymvisual-gifs.js
//
// service-role 키는 Supabase 대시보드 → 프로젝트 → Project Settings → API →
// "service_role" (secret) 값입니다. (anon/public 키가 아닙니다 — anon 키로는
// 버킷 쓰기 권한이 없어서 업로드가 실패합니다.)
//
// 이 스크립트는 @supabase/supabase-js(이미 package.json에 있음)와 Node 내장
// fs/path 모듈만 사용합니다. 별도 설치 없이 프로젝트 루트에서 바로 실행 가능합니다.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Node는 Expo 앱과 달리 .env를 자동으로 안 읽으므로, EXPO_PUBLIC_SUPABASE_URL만
// 프로젝트 루트 .env에서 직접 읽어온다. service-role 키는 여기서 절대 읽지 않고
// 항상 터미널 환경변수(SUPABASE_SERVICE_ROLE_KEY)로만 받는다 — 파일에 저장 금지.
if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^EXPO_PUBLIC_SUPABASE_URL=(.*)$/m);
    if (match) {
      process.env.EXPO_PUBLIC_SUPABASE_URL = match[1].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('EXPO_PUBLIC_SUPABASE_URL이 설정되어 있지 않습니다. 프로젝트 루트의 .env를 확인하세요.');
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.');
  console.error('PowerShell 예시: $env:SUPABASE_SERVICE_ROLE_KEY = "..."');
  process.exit(1);
}

const BUCKET = 'machine-images';
const GIF_DIR = path.join(__dirname, '..', 'gymvisual-gifs', '360');
const MAPPING_PATH = path.join(__dirname, '..', 'gymvisual-gifs', 'fw_gif_upload_mapping.json');

async function main() {
  const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
  console.log(`총 ${mapping.length}개 항목, 소스 폴더: ${GIF_DIR}`);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let ok = 0;
  let failed = [];

  for (const item of mapping) {
    const localPath = path.join(GIF_DIR, item.local_gif_filename);
    if (!fs.existsSync(localPath)) {
      console.error(`[SKIP] 파일 없음: ${localPath}`);
      failed.push({ ...item, reason: 'local file missing' });
      continue;
    }
    const buffer = fs.readFileSync(localPath);

    let attempt = 0;
    let lastErr = null;
    while (attempt < 2) {
      attempt++;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(item.upload_filename, buffer, {
          contentType: 'image/gif',
          upsert: true,
        });
      if (!error) {
        lastErr = null;
        break;
      }
      lastErr = error;
    }

    if (lastErr) {
      console.error(`[FAIL] ${item.id} (${item.upload_filename}): ${lastErr.message}`);
      failed.push({ ...item, reason: lastErr.message });
    } else {
      ok++;
      console.log(`[OK]   ${item.id} <- ${item.local_gif_filename}`);
    }
  }

  console.log('\n──────────────────────────────');
  console.log(`성공: ${ok}/${mapping.length}`);
  if (failed.length > 0) {
    console.log(`실패: ${failed.length}개`);
    fs.writeFileSync(
      path.join(__dirname, '..', 'gymvisual-gifs', 'upload_failures.json'),
      JSON.stringify(failed, null, 2),
    );
    console.log('실패 목록을 gymvisual-gifs/upload_failures.json 에 저장했습니다.');
  }
}

main().catch(err => {
  console.error('업로드 중 오류:', err);
  process.exit(1);
});
