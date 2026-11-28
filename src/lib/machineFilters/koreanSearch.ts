// 머신 한글 검색 — 브랜드·머신 종류·머신 이름을 한글로 입력해도 찾을 수 있게 한다.
// 예) "해머" → Hammer Strength, "체스트프레스" → Chest Press, "랫 풀다운" → Lat Pulldown
// 띄어쓰기·대소문자·기호(_ - / ·)는 무시하고, 일부만 입력해도 찾는다.

interface SearchSource {
  name:      string;
  brand?:    string | null;
  category?: string | null;
  line?:     string | null;
}

/** 브랜드 한글 이름 (여러 표기 허용) */
const BRAND_KO: Record<string, string[]> = {
  'arsenal':           ['아스널', '아세날', '아스날'],
  'atlantis':          ['아틀란티스'],
  'body master':       ['바디마스터'],
  'booty builder':     ['부티빌더'],
  'citadel':           ['시타델'],
  'cross axes tech':   ['크로스액시스', '크로스엑시스'],
  'cybex':             ['사이벡스'],
  'defiant strength':  ['디파이언트'],
  'drax':              ['드랙스', '드락스'],
  'dyna body':         ['다이나바디'],
  'dyna force':        ['다이나포스'],
  'dynamic':           ['다이나믹'],
  'flex fitness':      ['플렉스피트니스', '플렉스'],
  'focus':             ['포커스'],
  'forward':           ['포워드'],
  'free weight':       ['프리웨이트'],
  'freemotion':        ['프리모션'],
  'gaonfit':           ['가온핏'],
  'glutebuilder':      ['글루트빌더', '글룻빌더'],
  'gym80':             ['짐80', '짐에이티', '짐팔십'],
  'gymbox':            ['짐박스'],
  'gymleco':           ['짐레코'],
  'hammer strength':   ['해머스트렝스', '해머스트랭스', '햄머스트렝스', '해머', '햄머'],
  'hara sports':       ['하라스포츠'],
  'hoist':             ['호이스트'],
  'icarian':           ['이카리안'],
  'ikk sports':        ['아이케이케이'],
  'imagine strength':  ['이매진스트렝스', '이매진'],
  'intenza':           ['인텐자'],
  'iron core':         ['아이언코어'],
  'king strength':     ['킹스트렝스'],
  'legend fitness':    ['레전드피트니스', '레전드'],
  'lexco':             ['렉스코'],
  'life fitness':      ['라이프피트니스', '라이프'],
  'magnum':            ['매그넘', '맥넘'],
  'matrix':            ['매트릭스'],
  'maxpump':           ['맥스펌프'],
  'medx':              ['메드엑스', '메덱스'],
  'megamass':          ['메가매스'],
  'mk strength':       ['엠케이스트렝스', '엠케이'],
  'nautilus':          ['노틸러스', '너틸러스'],
  'nebula':            ['네뷸라', '네불라'],
  'newtech':           ['뉴텍'],
  'none':              ['노브랜드', '스탠다드'],
  'nytram':            ['니트람', '나이트램'],
  'panatta':           ['파나타', '파나따'],
  'paramount':         ['파라마운트'],
  'peachbuilder':      ['피치빌더'],
  'phd':               ['피에이치디'],
  'power lift':        ['파워리프트'],
  'precor':            ['프리코어'],
  'predator strength': ['프레데터'],
  'prime':             ['프라임'],
  'promaxima':         ['프로맥시마'],
  'quantum':           ['퀀텀'],
  'real reader usa':   ['리얼리더'],
  'repcon':            ['렙콘'],
  'rogers':            ['로저스'],
  'rosen':             ['로젠'],
  'salus':             ['살루스'],
  'segym':             ['세짐'],
  'sinco':             ['신코'],
  'southern xercise':  ['서던엑서사이즈', '서던'],
  'stair master':      ['스테어마스터'],
  'star trac':         ['스타트랙'],
  'strive':            ['스트라이브'],
  'techno21':          ['테크노21'],
  'technogym':         ['테크노짐'],
  'telju':             ['텔주', '텔쥬'],
  'true':              ['트루'],
  'tuffstuff':         ['터프스터프'],
  'universal':         ['유니버설', '유니버셜'],
  'usp':               ['유에스피'],
  'watson':            ['왓슨'],
};

/** 머신 종류(category) 한글 이름 */
const CATEGORY_KO: Record<string, string[]> = {
  'chest press':        ['체스트프레스', '가슴'],
  'incline press':      ['인클라인프레스', '인클라인'],
  'decline press':      ['디클라인프레스', '디클라인'],
  'fly':                ['플라이', '펙덱', '펙플라이'],
  'incline fly':        ['인클라인플라이'],
  'pull down':          ['풀다운', '랫풀다운', '렛풀다운', '랫풀'],
  'high row':           ['하이로우'],
  'middle row':         ['미들로우', '시티드로우', '로우'],
  'low row':            ['로우로우', '로우'],
  't-bar':              ['티바', '티바로우'],
  'pullover':           ['풀오버'],
  'chin dip':           ['친딥', '어시스트친업', '딥스'],
  'leg press':          ['레그프레스'],
  'hack squat':         ['핵스쿼트', '핵'],
  'pendulum squat':     ['펜듈럼스쿼트', '펜듈럼'],
  'squat machine':      ['스쿼트'],
  'leg curl':           ['레그컬'],
  'leg extention':      ['레그익스텐션', '레그익스텐전'],
  'leg extension':      ['레그익스텐션'],
  'calf':               ['카프', '카프레이즈', '종아리'],
  'viking press':       ['바이킹프레스'],
  'shoulder press':     ['숄더프레스', '어깨'],
  'raise_side lateral': ['사이드레터럴', '레터럴레이즈', '사레레', '사이드레이즈'],
  'rear delt':          ['리어델트', '후면'],
  'pec fly / rear delt':['펙플라이', '리어델트'],
  'rear delt / pec fly':['펙플라이', '리어델트'],
  'biceps':             ['바이셉스', '이두', '암컬', '바이셉컬'],
  'triceps':            ['트라이셉스', '삼두', '트라이셉'],
  'hip press':          ['힙프레스'],
  'hip thrust':         ['힙쓰러스트', '힙스러스트', '힙트러스트'],
  'hip abduction':      ['힙어브덕션', '어브덕션', '아웃타이'],
  'hip adduction':      ['힙어덕션', '어덕션', '이너타이'],
  'inner outer':        ['이너아우터', '이너타이', '아웃타이'],
  'free weight':        ['프리웨이트'],
  'cardio':             ['유산소', '러닝머신', '런닝머신', '트레드밀', '사이클'],
  'glute_etc':          ['힙', '둔근', '엉덩이'],
  'leg_etc':            ['하체'],
  'back_etc':           ['등'],
  'arm_etc':            ['팔'],
  'shoulder_etc':       ['어깨'],
  'chest_etc':          ['가슴'],
};

/** 머신 이름에 자주 나오는 영어 단어 → 한글 (이름을 단어별로 바꿔 붙여서 "랫풀다운" 같은 검색어와 맞춘다) */
const WORD_KO: Record<string, string> = {
  lat: '랫', pulldown: '풀다운', pull: '풀', down: '다운', chest: '체스트', press: '프레스',
  row: '로우', leg: '레그', curl: '컬', extension: '익스텐션', extention: '익스텐션',
  shoulder: '숄더', fly: '플라이', incline: '인클라인', decline: '디클라인', seated: '시티드',
  squat: '스쿼트', hack: '핵', calf: '카프', dip: '딥', pec: '펙', deck: '덱', rear: '리어',
  delt: '델트', deltoid: '델토이드', lateral: '레터럴', raise: '레이즈', biceps: '바이셉스',
  bicep: '바이셉', triceps: '트라이셉스', tricep: '트라이셉', hip: '힙', thrust: '쓰러스트',
  abduction: '어브덕션', adduction: '어덕션', abductor: '어브덕터', adductor: '어덕터',
  glute: '글루트', glutes: '글루트', ab: '앱', abdominal: '앱도미널', crunch: '크런치',
  back: '백', pullover: '풀오버', high: '하이', low: '로우', iso: '아이소', lateralraise: '레터럴레이즈',
  kickback: '킥백', pendulum: '펜듈럼', belt: '벨트', smith: '스미스', cable: '케이블',
  crossover: '크로스오버', multi: '멀티', bench: '벤치', preacher: '프리처', standing: '스탠딩',
  lying: '라잉', prone: '프론', vertical: '버티컬', horizontal: '호리젠탈', wide: '와이드',
  front: '프론트', overhead: '오버헤드', assisted: '어시스트', assist: '어시스트', chin: '친',
  rotary: '로터리', torso: '토르소', tbar: '티바', viking: '바이킹', inner: '이너', outer: '아우터',
  thigh: '타이', gripper: '그리퍼', combo: '콤보', station: '스테이션', machine: '머신',
  plate: '플레이트', loaded: '로디드', select: '셀렉트', selectorized: '셀렉터라이즈드',
  dual: '듀얼', super: '슈퍼', power: '파워', rack: '랙', cage: '케이지', jammer: '재머',
  shrug: '슈러그', deadlift: '데드리프트', lunge: '런지', donkey: '동키', hamstring: '햄스트링',
  quad: '쿼드', arm: '암', elbow: '엘보', wrist: '리스트', neck: '넥', reverse: '리버스',
  converging: '컨버징', diverging: '다이버징', mid: '미드', middle: '미들', upper: '어퍼',
};

export function normalizeSearch(s: string): string {
  return s.toLowerCase().replace(/[\s_\-/·.,()]+/g, '');
}

function nameToKorean(name: string): string {
  return name
    .toLowerCase()
    .split(/[\s_\-/·.,()]+/)
    .filter(Boolean)
    .map(w => WORD_KO[w] ?? '')
    .join('');
}

const cache = new WeakMap<object, string>();

/** 머신 하나의 검색용 문자열 (영문 + 한글 별칭, 정규화) — 같은 객체는 한 번만 계산 */
export function machineSearchText(m: SearchSource): string {
  const hit = cache.get(m as object);
  if (hit !== undefined) return hit;
  const brandKey = (m.brand ?? '').toLowerCase().trim();
  const cats = (m.category ?? '').split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
  const parts = [
    m.name, m.brand ?? '', m.category ?? '', m.line ?? '',
    ...(BRAND_KO[brandKey] ?? []),
    ...cats.flatMap(c => CATEGORY_KO[c] ?? []),
    nameToKorean(m.name),
  ];
  const text = parts.map(normalizeSearch).join('|');
  cache.set(m as object, text);
  return text;
}

/** 2026-11-25: 브랜드 이름만 검색할 때 (필터 시트 브랜드 검색, 어드민 브랜드 추천) — "해머" → Hammer Strength */
export function matchesBrandKeyword(brand: string, keyword: string): boolean {
  const kw = normalizeSearch(keyword);
  if (!kw) return true;
  const key = brand.toLowerCase().trim();
  return [brand, ...(BRAND_KO[key] ?? [])].some(b => normalizeSearch(b).includes(kw));
}

/** 검색어(한글·영문)가 이 머신에 맞는지 */
export function matchesMachineKeyword(m: SearchSource, keyword: string): boolean {
  const kw = normalizeSearch(keyword);
  if (!kw) return true;
  const text = machineSearchText(m);
  if (text.includes(kw)) return true;
  // "사이벡스 레그컬"처럼 띄어 쓴 여러 단어는 단어마다 모두 맞으면 찾은 것으로 본다
  const terms = keyword.split(/\s+/).map(normalizeSearch).filter(Boolean);
  return terms.length > 1 && terms.every(t => text.includes(t));
}
