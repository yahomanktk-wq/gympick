// insert-gymvisual-freeweights.js
// Gym Visual에서 구매한 129개 프리웨이트(fw45~fw173)를 Supabase의 `machines` 테이블에
// upsert한다. 이게 빠져 있으면 앱은 fetchFreeWeights()가 DB에서 성공적으로 데이터를
// 가져오는 순간 로컬 freeWeights.ts를 완전히 무시하기 때문에, GIF 이미지를 Storage에
// 올려도 카드 자체가 화면에 안 뜬다 (fw01~44만 계속 보이는 원인).
//
// ⚠️ service-role 키가 필요합니다 (업로드 스크립트와 동일한 키). 파일/코드/채팅에
//    저장하지 말고 실행할 때마다 터미널 환경변수로만 넘겨주세요.
//
// 사용법 (프로젝트 루트에서, PowerShell 기준):
//   $env:SUPABASE_SERVICE_ROLE_KEY = "..."
//   node scripts/insert-gymvisual-freeweights.js

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const MAPPING_PATH = path.join(__dirname, '..', 'gymvisual-gifs', 'fw_gif_upload_mapping.json');

async function main() {
  const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
  console.log(`총 ${mapping.length}개 항목을 machines 테이블에 upsert합니다.`);

  const rows = mapping.map(item => ({
    id: item.id,
    name: item.name,
    brand: 'Free Weight',
    target_muscle: item.category,   // Chest/Back/Shoulder/Arms/Leg
    category: 'Free Weight',
    exercise_kind: 'freeweight',
    image_url: null,                // getMachineImageUrl()이 id로 직접 만들어서 씀 — 이 컬럼은 안 씀
    line: null,
  }));

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from('machines')
    .upsert(rows, { onConflict: 'id' })
    .select('id');

  if (error) {
    console.error('upsert 실패:', error.message);
    process.exit(1);
  }

  console.log(`성공: ${data?.length ?? 0}/${rows.length}개 upsert 완료`);
  console.log('fetchFreeWeights()는 캐시 없이 매번 새로 조회하므로, 앱에서 화면을 나갔다');
  console.log('다시 들어오면(또는 앱 재시작) 바로 반영됩니다.');
}

main().catch(err => {
  console.error('실행 중 오류:', err);
  process.exit(1);
});
