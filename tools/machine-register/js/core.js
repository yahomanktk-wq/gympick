// 2026-11-05: GymPick 머신 등록용 CSV/이미지 생성 도구 — 공통 상태·카드·ID·내보내기
// 2026-11-27: 파일 분리(core/auth/requests/dbWrite/main) + 신청 카드·이미지 교체·등록 완료 상태
const SUPABASE_URL = 'https://okrouzqqvfioodfieljv.supabase.co';
const KEY_STORAGE = 'gympick_anon_key';
const MUSCLES = ['Chest', 'Back', 'Leg', 'Shoulder', 'Arms', 'Glutes', 'Other'];
const MUSCLE_SLUG = { Chest: 'chest', Back: 'back', Leg: 'leg', Shoulder: 'shoulder', Arms: 'arm', Glutes: 'glute', Other: 'other' };
const CAT_JOIN = ' , ';     // DB에 가장 많이 쓰인 카테고리 구분 형식
const MUSCLE_JOIN = ', ';   // 기존 복합 부위 형식 ("Chest, Shoulder")
const ID_PATTERN = /^(.*?)_(chest|back|legs?|arms?|shoulders?|glutes?|others?)_(\d+)$/;

const db = {
  loaded: false,
  machines: [],
  idsLower: new Set(),
  prefixMax: new Map(),
  brands: [],                 // [{name, key, slug, count}]
  brandByKey: new Map(),
  catsByMuscle: new Map(),    // muscle -> Map(cat -> count)
  allCats: new Map(),
  linesByBrand: new Map(),
  namesByBrand: new Map(),    // brandKey -> Set(upper name)
  nameLineKeys: new Set(),    // 2026-11-27: 'brand|NAME|line' — 같은 이름이라도 라인이 다르면 다른 머신
  brandLogoByKey: new Map(),  // 2026-11-28: brands 표 — 'LIFE_FITNESS' -> logo_path (null = 로고 없음)
};

// 2026-11-28: 앱과 같은 브랜드 키 규칙 (src/lib/brands/brandKey.ts)
const logoKeyOf = s => String(s ?? '').trim().toUpperCase().replace(/\s+/g, '_');
let cards = [];
let seq = 0;

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const keyOf = s => String(s ?? '').trim().toLowerCase();
const slugify = s => keyOf(s).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const splitList = s => String(s ?? '').split(',').map(x => x.trim()).filter(Boolean);
const bump = (map, k, n = 1) => map.set(k, (map.get(k) || 0) + n);

function anonKey() { return $('#anonKey').value.trim(); }

// ── DB 읽기 ───────────────────────────────────────────────
async function loadDb() {
  const key = anonKey();
  if (!key) { setStatus('anon key를 입력해주세요', true); return; }
  try { localStorage.setItem(KEY_STORAGE, key); } catch {}
  setStatus('기존 머신 불러오는 중...');
  const rows = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const url = `${SUPABASE_URL}/rest/v1/machines?select=id,name,brand,target_muscle,category,line,exercise_kind&order=id&limit=${page}&offset=${offset}`;
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) { setStatus(`불러오기 실패 (${res.status}). anon key를 확인해주세요`, true); return; }
    const part = await res.json();
    rows.push(...part);
    if (part.length < page) break;
  }
  buildIndex(rows);
  // 2026-11-28: 브랜드 표(brands)도 읽어 로고 등록 여부를 판단한다. 실패해도 머신 등록은 계속 가능.
  try {
    const br = await fetch(`${SUPABASE_URL}/rest/v1/brands?select=key,logo_path`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (br.ok) db.brandLogoByKey = new Map((await br.json()).map(b => [b.key, b.logo_path]));
  } catch {}
  setStatus(`기존 머신 ${rows.length.toLocaleString()}개 · 브랜드 ${db.brands.length}개 불러옴`);
  cards.forEach(c => refreshCardOptions(c));
  refreshAll();
}

function buildIndex(rows) {
  db.machines = rows;
  db.idsLower = new Set(rows.map(r => keyOf(r.id)));
  db.prefixMax = new Map();
  db.catsByMuscle = new Map(MUSCLES.map(m => [m, new Map()]));
  db.allCats = new Map();
  db.linesByBrand = new Map();
  db.namesByBrand = new Map();
  db.nameLineKeys = new Set();
  const brandAgg = new Map();     // key -> {names: Map, slugs: Map, count}

  for (const r of rows) {
    const idl = keyOf(r.id);
    const m = idl.match(/^(.+)_(\d+)$/);
    if (m) db.prefixMax.set(m[1], Math.max(db.prefixMax.get(m[1]) || 0, parseInt(m[2], 10)));

    const bk = keyOf(r.brand);
    if (bk && bk !== 'none' && bk !== 'free weight') {
      if (!brandAgg.has(bk)) brandAgg.set(bk, { names: new Map(), slugs: new Map(), count: 0 });
      const a = brandAgg.get(bk);
      a.count++;
      bump(a.names, String(r.brand).trim());
      const sm = idl.match(ID_PATTERN);
      if (sm) bump(a.slugs, sm[1].replace(/\s+/g, '_'));
    }
    if (bk) {
      if (r.line) { if (!db.linesByBrand.has(bk)) db.linesByBrand.set(bk, new Map()); bump(db.linesByBrand.get(bk), r.line.trim()); }
      if (!db.namesByBrand.has(bk)) db.namesByBrand.set(bk, new Set());
      db.namesByBrand.get(bk).add(String(r.name ?? '').trim().toUpperCase());
      db.nameLineKeys.add(nameLineKey(r.brand, r.name, r.line));
    }
    const muscles = splitList(r.target_muscle);
    for (const cat of splitList(r.category)) {
      bump(db.allCats, cat);
      for (const mu of muscles) if (db.catsByMuscle.has(mu)) bump(db.catsByMuscle.get(mu), cat);
    }
  }

  const top = map => [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  db.brands = [...brandAgg.entries()].map(([k, a]) => ({
    key: k, name: top(a.names), slug: top(a.slugs) || slugify(k), count: a.count,
  })).sort((a, b) => b.count - a.count);
  db.brandByKey = new Map(db.brands.map(b => [b.key, b]));
  db.loaded = true;

  $('#brandList')?.remove();
  const dl = document.createElement('datalist');
  dl.id = 'brandList';
  dl.innerHTML = db.brands.map(b => `<option value="${esc(b.name)}">`).join('');
  document.body.appendChild(dl);
  $('#catAll')?.remove();
  const cl = document.createElement('datalist');
  cl.id = 'catAll';
  cl.innerHTML = [...db.allCats.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => `<option value="${esc(c)}">`).join('');
  document.body.appendChild(cl);
}

/** 2026-11-27: DB에 방금 등록한 머신을 인덱스에 반영 (다음 ID가 이어서 매겨지도록) */
function addToIndex(row) {
  db.machines.push(row);
  const idl = keyOf(row.id);
  db.idsLower.add(idl);
  const m = idl.match(/^(.+)_(\d+)$/);
  if (m) db.prefixMax.set(m[1], Math.max(db.prefixMax.get(m[1]) || 0, parseInt(m[2], 10)));
  const bk = keyOf(row.brand);
  if (!db.namesByBrand.has(bk)) db.namesByBrand.set(bk, new Set());
  db.namesByBrand.get(bk).add(String(row.name ?? '').toUpperCase());
  db.nameLineKeys.add(nameLineKey(row.brand, row.name, row.line));
}

function nameLineKey(brand, name, line) {
  return `${keyOf(brand)}|${String(name ?? '').trim().toUpperCase()}|${keyOf(line)}`;
}

function setStatus(text, isErr) {
  const el = $('#dbStatus');
  el.textContent = text;
  el.style.color = isErr ? '#ff8a8a' : '#bbb';
}

// ── 카드(이미지 1장 = 머신 1개) ─────────────────────────────
function defaultName(file) {
  return file.name.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

function newCard(fields) {
  return {
    uid: ++seq, file: null, url: '',
    name: '', displayName: '', brand: '', muscles: [], cats: [],
    kind: 'machine', line: '', id: '',
    request: null,      // 2026-11-27: 매니저 신청에서 가져온 카드면 {id, gymId, gymName, requesterId, brand, machineName, targetMuscle}
    linkId: '',         // '기존 머신으로 연결만'에 쓸 머신 id
    done: false, doneText: '', busy: false,
    ...fields,
  };
}

function setCardFile(c, file) {
  if (c.url) URL.revokeObjectURL(c.url);
  c.file = file;
  c.url = file ? URL.createObjectURL(file) : '';
}

function addFiles(files) {
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    const c = newCard({ name: defaultName(f) });
    setCardFile(c, f);
    cards.push(c);
  }
  renderList();
}

function renderList() {
  const list = $('#list');
  if (cards.length === 0) { list.innerHTML = '<div class="empty">아직 추가한 이미지가 없어요</div>'; refreshAll(); return; }
  list.innerHTML = '';
  for (const c of cards) list.appendChild(renderCard(c));
  refreshAll();
}

function renderCard(c) {
  const el = document.createElement('div');
  el.className = 'card' + (c.done ? ' done' : '');
  el.dataset.uid = c.uid;
  const req = c.request;
  el.innerHTML = `
    <div class="thumbwrap">
      <div class="thumb${c.url ? '' : ' noimg'}" data-role="thumb" style="${c.url ? `background-image:url('${c.url}')` : ''}">${c.url ? '' : '이미지 없음'}</div>
      <div class="fname">${esc(c.file?.name ?? '')}</div>
      <button class="swap" data-role="swap">이미지 바꾸기</button>
      <input type="file" accept="image/*" data-role="swapInput" hidden>
    </div>
    <div>
      ${req ? `<div class="reqbox">매니저 신청 · <b>${esc(req.gymName)}</b> · 입력값: ${esc(req.brand || '-')} / ${esc(req.machineName || '-')} / ${esc(req.targetMuscle || '-')}${req.gymId ? '' : ' · <b style="color:var(--err)">헬스장 id 없음</b>'}</div>` : ''}
      <div class="grid">
        <div class="field span2"><label>머신명 <i>*</i></label><input data-k="name" list="names-${c.uid}" value="${esc(c.name)}"><datalist id="names-${c.uid}"></datalist></div>
        <div class="field"><label>브랜드 <i>*</i></label><input data-k="brand" list="brandList" value="${esc(c.brand)}" placeholder="브랜드 검색"></div>
        <div class="field"><label>라인</label><input data-k="line" list="lines-${c.uid}" value="${esc(c.line)}" placeholder="선택"><datalist id="lines-${c.uid}"></datalist></div>
        <div class="field span2"><label>표시 이름 (선택, 긴 이름 줄임용)</label><input data-k="displayName" value="${esc(c.displayName)}"></div>
        <div class="field"><label>종류</label>
          <select data-k="kind"><option value="machine"${c.kind === 'machine' ? ' selected' : ''}>machine</option><option value="freeweight"${c.kind === 'freeweight' ? ' selected' : ''}>freeweight</option></select>
        </div>
        <div></div>
        <div class="field span4"><label>타겟부위 <i>*</i> (여러 개 가능, 먼저 고른 것이 주 부위)</label><div class="chips" data-role="muscles"></div></div>
        <div class="field span4"><label>세부 카테고리 <i>*</i> (여러 개 가능, 고른 순서대로 저장)</label>
          <div class="selected" data-role="catSelected"></div>
          <div class="chips" data-role="catChips"></div>
          <div class="catpick" style="margin-top:8px"><input data-role="catInput" list="catAll" placeholder="목록에 없으면 검색하거나 새로 입력 후 Enter"><button data-role="catAdd">추가</button></div>
        </div>
      </div>
      <div class="actrow">
        <button class="accent" data-role="register">DB에 바로 등록</button>
        ${req ? `<input data-role="linkId" list="link-${c.uid}" value="${esc(c.linkId)}" placeholder="이미 있는 머신이면 id를 골라 연결만"><datalist id="link-${c.uid}"></datalist>
        <button data-role="link">기존 머신으로 연결만</button>` : ''}
      </div>
      <div class="idrow">
        <span class="id" data-role="id">—</span>
        <span class="msgs" data-role="msgs"></span>
        <button class="remove" data-role="remove">삭제</button>
      </div>
    </div>`;

  el.querySelectorAll('[data-k]').forEach(inp => {
    inp.addEventListener('input', () => {
      c[inp.dataset.k] = inp.value;
      if (inp.dataset.k === 'brand') refreshCardOptions(c);
      refreshAll();
    });
  });
  $('[data-role="remove"]', el).addEventListener('click', () => {
    if (c.url) URL.revokeObjectURL(c.url);
    cards = cards.filter(x => x !== c);
    renderList();
    if (typeof renderRequests === 'function') renderRequests();
  });
  const catInput = $('[data-role="catInput"]', el);
  const addCat = () => {
    const v = catInput.value.trim();
    if (v && !c.cats.includes(v)) { c.cats.push(v); renderCats(c); refreshAll(); }
    catInput.value = '';
  };
  $('[data-role="catAdd"]', el).addEventListener('click', addCat);
  catInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addCat(); } });

  // 2026-11-27: 이미지 바꾸기 (버튼 또는 사진 위에 끌어다 놓기)
  const thumb = $('[data-role="thumb"]', el);
  const swapInput = $('[data-role="swapInput"]', el);
  const replace = file => {
    if (!file || !file.type.startsWith('image/')) return;
    setCardFile(c, file);
    thumb.classList.remove('noimg');
    thumb.textContent = '';
    thumb.style.backgroundImage = `url('${c.url}')`;
    $('.fname', el).textContent = file.name;
    refreshAll();
  };
  $('[data-role="swap"]', el).addEventListener('click', () => swapInput.click());
  swapInput.addEventListener('change', e => { replace(e.target.files[0]); e.target.value = ''; });
  ['dragenter', 'dragover'].forEach(t => thumb.addEventListener(t, e => { e.preventDefault(); e.stopPropagation(); thumb.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => thumb.addEventListener(t, e => { e.preventDefault(); e.stopPropagation(); thumb.classList.remove('over'); }));
  thumb.addEventListener('drop', e => replace(e.dataTransfer.files[0]));

  $('[data-role="register"]', el).addEventListener('click', () => registerCard(c));
  if (req) {
    const linkInput = $('[data-role="linkId"]', el);
    linkInput.addEventListener('input', () => { c.linkId = linkInput.value.trim(); });
    $('[data-role="link"]', el).addEventListener('click', () => linkCardToExisting(c));
  }

  c.el = el;
  renderMuscles(c);
  renderCats(c);
  refreshCardOptions(c);
  return el;
}

function renderMuscles(c) {
  const box = $('[data-role="muscles"]', c.el);
  box.innerHTML = MUSCLES.map(m => {
    const i = c.muscles.indexOf(m);
    return `<span class="chip${i >= 0 ? ' on' : ''}" data-m="${m}">${i >= 0 ? `<span class="ord">${'①②③④⑤⑥⑦'[i]}</span>` : ''}${m.toUpperCase()}</span>`;
  }).join('');
  box.querySelectorAll('.chip').forEach(ch => ch.addEventListener('click', () => {
    const m = ch.dataset.m;
    c.muscles = c.muscles.includes(m) ? c.muscles.filter(x => x !== m) : [...c.muscles, m];
    renderMuscles(c);
    renderCats(c);
    refreshAll();
  }));
}

function renderCats(c) {
  const sel = $('[data-role="catSelected"]', c.el);
  sel.innerHTML = c.cats.length
    ? c.cats.map((cat, i) => `<span class="sel">${i + 1}. ${esc(cat)}<button data-i="${i}" title="빼기">×</button></span>`).join('')
    : '<span class="more">아직 고른 카테고리가 없어요</span>';
  sel.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    c.cats.splice(Number(b.dataset.i), 1);
    renderCats(c);
    refreshAll();
  }));

  // 고른 부위에서 많이 쓰인 카테고리부터 (부위를 안 골랐으면 전체)
  const counts = new Map();
  const sources = c.muscles.length ? c.muscles.map(m => db.catsByMuscle.get(m)).filter(Boolean) : [db.allCats];
  for (const src of sources) for (const [cat, n] of src) bump(counts, cat, n);
  const options = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([cat]) => cat).filter(cat => !c.cats.includes(cat)).slice(0, 24);
  const chips = $('[data-role="catChips"]', c.el);
  chips.innerHTML = db.loaded
    ? options.map(cat => `<span class="chip" data-c="${esc(cat)}">${esc(cat)}</span>`).join('')
    : '<span class="more">기존 데이터를 불러오면 추천 카테고리가 나와요</span>';
  chips.querySelectorAll('.chip').forEach(ch => ch.addEventListener('click', () => {
    c.cats.push(ch.dataset.c);
    renderCats(c);
    refreshAll();
  }));
}

function refreshCardOptions(c) {
  if (!c.el) return;
  const bk = keyOf(c.brand);
  const lines = db.linesByBrand.get(bk);
  $(`#lines-${c.uid}`, c.el).innerHTML = lines
    ? [...lines.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => `<option value="${esc(l)}">`).join('') : '';
  const names = db.namesByBrand.get(bk);
  $(`#names-${c.uid}`, c.el).innerHTML = names ? [...names].sort().map(n => `<option value="${esc(n)}">`).join('') : '';
  // 2026-11-27: 연결만 할 기존 머신 후보 — 같은 브랜드 머신 (이름이 비슷한 것부터)
  const linkList = c.el.querySelector(`#link-${c.uid}`);
  if (linkList) {
    const words = keyOf(c.name).split(/\s+/).filter(Boolean);
    const score = r => words.filter(w => keyOf(r.name).includes(w)).length;
    const cands = db.machines.filter(r => keyOf(r.brand) === bk)
      .map(r => ({ r, s: score(r) })).sort((a, b) => b.s - a.s || a.r.id.localeCompare(b.r.id)).slice(0, 60);
    linkList.innerHTML = cands.map(({ r }) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
  }
  renderCats(c);
}

// ── ID 자동 지정 + 검사 ────────────────────────────────────
function brandSlug(brand) {
  const b = db.brandByKey.get(keyOf(brand));
  return b ? b.slug : slugify(brand);
}

function assignIds() {
  const used = new Set(db.idsLower);
  const nextByPrefix = new Map();
  for (const c of cards) if (c.done && c.id) used.add(keyOf(c.id));
  for (const c of cards) {
    if (c.done) continue;   // 2026-11-27: 등록 완료된 카드는 ID 고정
    if (!c.brand.trim() || c.muscles.length === 0) { c.id = ''; continue; }
    const prefix = `${brandSlug(c.brand)}_${c.muscles.map(m => MUSCLE_SLUG[m]).join('_')}`;
    let n = nextByPrefix.has(prefix) ? nextByPrefix.get(prefix) : (db.prefixMax.get(prefix) || 0) + 1;
    while (used.has(`${prefix}_${n}`)) n++;
    c.id = `${prefix}_${n}`;
    used.add(c.id);
    nextByPrefix.set(prefix, n + 1);
  }
}

function checkCard(c) {
  const errs = [], warns = [];
  if (!c.file) errs.push('이미지 없음');
  if (!c.name.trim()) errs.push('머신명 없음');
  if (!c.brand.trim()) errs.push('브랜드 없음');
  if (c.muscles.length === 0) errs.push('타겟부위 없음');
  if (c.cats.length === 0) errs.push('카테고리 없음');
  if (!db.loaded) errs.push('기존 데이터를 먼저 불러오세요');
  const bk = keyOf(c.brand);
  // 2026-11-28: brands 표 기준 — 표에 있고 로고가 있으면 경고 없음
  if (db.loaded && c.brand.trim()) {
    const lk = logoKeyOf(c.brand);
    const known = db.brandByKey.has(bk) || db.brandLogoByKey.has(lk);
    if (!known) warns.push('새 브랜드예요 (브랜드 로고 등록 필요)');
    else if (db.brandLogoByKey.has(lk) && !db.brandLogoByKey.get(lk)) warns.push('브랜드 로고가 아직 연결되지 않았어요 (등록은 가능)');
  }
  const upper = c.name.trim().toUpperCase();
  // 2026-11-27: 라인까지 같아야 중복 (Prime ARM CURL은 Hybrid·Plate Loaded·Evolution이 각각 다른 머신)
  if (db.loaded && upper && db.nameLineKeys.has(nameLineKey(c.brand, upper, c.line))) warns.push('같은 브랜드·라인에 같은 이름의 머신이 이미 있어요 — 연결만 할지 확인');
  const dupInBatch = cards.filter(x => x !== c && !x.done && nameLineKey(x.brand, x.name, x.line) === nameLineKey(c.brand, upper, c.line) && upper).length;
  if (dupInBatch) warns.push('이번 목록에 같은 브랜드·라인·이름이 또 있어요');
  for (const cat of c.cats) if (db.loaded && !db.allCats.has(cat)) { warns.push(`새 카테고리: ${cat}`); }
  return { errs, warns };
}

function refreshAll() {
  assignIds();
  let ready = 0, pending = 0;
  const loggedIn = typeof isAdminLoggedIn === 'function' && isAdminLoggedIn();
  for (const c of cards) {
    if (!c.el) continue;
    $('[data-role="id"]', c.el).textContent = c.id || '—';
    c.el.classList.toggle('done', c.done);
    if (c.done) {
      c.ok = false;
      $('[data-role="msgs"]', c.el).innerHTML = `<span class="msg ok">${esc(c.doneText || '등록 완료')}</span>`;
      continue;
    }
    pending++;
    const { errs, warns } = checkCard(c);
    c.ok = errs.length === 0;
    if (c.ok) ready++;
    const regBtn = $('[data-role="register"]', c.el);
    regBtn.disabled = !c.ok || !loggedIn || c.busy;
    regBtn.title = !loggedIn ? '어드민 로그인이 필요해요' : (!c.ok ? '빨간 항목을 먼저 채워주세요' : '');
    const linkBtn = $('[data-role="link"]', c.el);
    if (linkBtn) linkBtn.disabled = !loggedIn || c.busy || !c.request?.gymId;
    $('[data-role="msgs"]', c.el).innerHTML =
      (c.busy ? '<span class="msg warn">처리 중...</span>' : '') +
      (c.errorText ? `<span class="msg err">${esc(c.errorText)}</span>` : '') +
      (c.note ? `<span class="msg warn">${esc(c.note)}</span>` : '') +
      errs.map(e => `<span class="msg err">${esc(e)}</span>`).join('') +
      warns.map(w => `<span class="msg warn">${esc(w)}</span>`).join('') +
      (c.ok && warns.length === 0 && !c.errorText && !c.note ? '<span class="msg ok">준비 완료</span>' : '');
  }
  const doneCount = cards.filter(c => c.done).length;
  $('#summary').textContent = cards.length
    ? `${pending}개 중 ${ready}개 준비 완료${doneCount ? ` · DB 등록 완료 ${doneCount}개` : ''}`
    : '0개';
  const exportable = cards.filter(c => !c.done);
  const allOk = exportable.length > 0 && ready === exportable.length;
  $('#csvBtn').disabled = !allOk;
  $('#zipBtn').disabled = !allOk;
  $('#registerAllBtn').disabled = !loggedIn || ready === 0;
}

// ── 내보내기 (등록 완료된 카드는 제외) ─────────────────────
function canonicalBrand(c) {
  return db.brandByKey.get(keyOf(c.brand))?.name ?? c.brand.trim();
}

function machineRow(c) {
  return {
    id: c.id,
    name: c.name.trim().toUpperCase(),
    display_name: c.displayName.trim() || null,
    brand: canonicalBrand(c),
    target_muscle: c.muscles.join(MUSCLE_JOIN),
    category: c.cats.join(CAT_JOIN),
    exercise_kind: c.kind,
    line: c.line.trim() || null,
  };
}

function toCsv() {
  const head = ['id', 'name', 'display_name', 'brand', 'target_muscle', 'category', 'exercise_kind', 'line'];
  const cell = v => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = cards.filter(c => !c.done).map(c => head.map(h => machineRow(c)[h] ?? ''));
  return [head, ...rows].map(r => r.map(cell).join(',')).join('\n') + '\n';
}

function stamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function toWebp(file) {
  const img = await createImageBitmap(file);
  const S = 800;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);
  const scale = Math.min(S / img.width, S / img.height);
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, Math.round((S - w) / 2), Math.round((S - h) / 2), w, h);
  return new Promise(res => canvas.toBlob(res, 'image/webp', 0.9));
}

async function downloadZip() {
  if (typeof JSZip === 'undefined') { alert('zip 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해주세요.'); return; }
  const btn = $('#zipBtn');
  btn.disabled = true; btn.textContent = '만드는 중...';
  try {
    const zip = new JSZip();
    const name = `machines_${stamp()}`;
    zip.file(`${name}.csv`, toCsv());
    const folder = zip.folder('machine-images');
    for (const c of cards.filter(x => !x.done)) {
      if ($('#optWebp').checked) {
        folder.file(`${c.id}.webp`, await toWebp(c.file));
      } else {
        const ext = (c.file.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
        folder.file(`${c.id}${ext}`, c.file);
      }
    }
    download(await zip.generateAsync({ type: 'blob' }), `${name}.zip`);
  } finally {
    btn.textContent = 'CSV + 이미지(zip) 받기';
    refreshAll();
  }
}
