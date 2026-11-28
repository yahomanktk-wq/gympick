// 2026-11-27: 어드민 로그인 (Supabase Auth 비밀번호 로그인)
// 머신 등록 신청 조회·DB 쓰기는 RLS상 어드민만 가능하므로 어드민 계정 토큰이 필요하다.
// 세션은 sessionStorage에만 둔다 — 브라우저 탭을 닫으면 로그아웃된다. 비밀번호는 저장하지 않는다.
const SESSION_STORAGE = 'gympick_admin_session';
let session = null;   // { access_token, refresh_token, expires_at, userId, email }

function isAdminLoggedIn() { return !!session; }

function saveSession(s) {
  session = s;
  try {
    if (s) sessionStorage.setItem(SESSION_STORAGE, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_STORAGE);
  } catch {}
  renderAuth();
}

function renderAuth() {
  $('#authForm').hidden = !!session;
  $('#authInfo').hidden = !session;
  $('#whoText').textContent = session ? `어드민: ${session.email}` : '';
  refreshAll();
}

async function authRequest(grant, body) {
  const key = anonKey();
  if (!key) throw new Error('anon key를 먼저 입력해주세요');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error_description || json.msg || `로그인 실패 (${res.status})`);
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + (json.expires_in ?? 3600) * 1000,
    userId: json.user?.id,
    email: json.user?.email,
  };
}

async function login() {
  const email = $('#adminEmail').value.trim();
  const password = $('#adminPassword').value;
  if (!email || !password) { alert('이메일과 비밀번호를 입력해주세요'); return; }
  const btn = $('#loginBtn');
  btn.disabled = true; btn.textContent = '로그인 중...';
  try {
    const s = await authRequest('password', { email, password });
    // 어드민인지 확인 (profiles는 본인 행 조회 가능)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${s.userId}&select=role`, {
      headers: { apikey: anonKey(), Authorization: `Bearer ${s.access_token}` },
    });
    const rows = res.ok ? await res.json() : [];
    if (rows[0]?.role !== 'admin') throw new Error('어드민 계정이 아니에요');
    $('#adminPassword').value = '';
    saveSession(s);
    if (!db.loaded) await loadDb();
    await loadRequests();
  } catch (e) {
    alert(e.message);
  } finally {
    btn.disabled = false; btn.textContent = '어드민 로그인';
  }
}

function logout() {
  saveSession(null);
  if (typeof clearRequests === 'function') clearRequests();
}

/** 만료 1분 전이면 갱신한 뒤 어드민 헤더를 돌려준다 */
async function adminHeaders(extra = {}) {
  if (!session) throw new Error('어드민 로그인이 필요해요');
  if (Date.now() > session.expires_at - 60_000) {
    try {
      const s = await authRequest('refresh_token', { refresh_token: session.refresh_token });
      saveSession({ ...s, email: s.email || session.email });
    } catch {
      saveSession(null);
      throw new Error('로그인이 만료됐어요. 다시 로그인해주세요');
    }
  }
  return { apikey: anonKey(), Authorization: `Bearer ${session.access_token}`, ...extra };
}

/** PostgREST 호출 (어드민 토큰) — 실패하면 메시지를 담아 throw */
async function adminRest(path, { method = 'GET', body, prefer } = {}) {
  const headers = await adminHeaders(body ? { 'Content-Type': 'application/json' } : {});
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { msg = JSON.parse(text).message || text; } catch {}
    throw new Error(`${method} ${path.split('?')[0]} 실패 (${res.status}): ${msg}`);
  }
  return text ? JSON.parse(text) : null;
}

function restoreSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE);
    if (raw) session = JSON.parse(raw);
  } catch {}
  renderAuth();
}
