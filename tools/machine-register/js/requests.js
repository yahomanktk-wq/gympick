// 2026-11-27: 매니저 머신 등록 신청(machine_requests) 목록 → 카드로 가져오기
let requests = [];        // [{id, gym_id, gym_name, requester_id, brand, machine_name, target_muscle, photo_url, created_at, nickname, gymExists}]

// 신청 화면의 한글 부위 → 도구의 부위 값
const MUSCLE_FROM_KO = {
  '가슴': 'Chest', '등': 'Back', '하체': 'Leg', '다리': 'Leg', '어깨': 'Shoulder',
  '팔': 'Arms', '둔근': 'Glutes', '엉덩이': 'Glutes', '기타': 'Other',
  chest: 'Chest', back: 'Back', leg: 'Leg', legs: 'Leg', shoulder: 'Shoulder', shoulders: 'Shoulder',
  arm: 'Arms', arms: 'Arms', glute: 'Glutes', glutes: 'Glutes', other: 'Other',
};

function musclesFromRequest(text) {
  return splitList(text).map(t => MUSCLE_FROM_KO[t] ?? MUSCLE_FROM_KO[keyOf(t)]).filter(Boolean)
    .filter((m, i, a) => a.indexOf(m) === i);
}

/** 신청에 적힌 브랜드를 DB 표기로 맞춘다 (대소문자·공백 차이만). 못 찾으면 입력값 그대로 */
function brandFromRequest(text) {
  const k = keyOf(text).replace(/\s+/g, ' ');
  const hit = db.brands.find(b => b.key.replace(/\s+/g, ' ') === k)
    || db.brands.find(b => b.key.replace(/[^a-z0-9]/g, '') === k.replace(/[^a-z0-9]/g, '') && k.replace(/[^a-z0-9]/g, ''));
  return hit ? hit.name : String(text ?? '').trim();
}

async function loadRequests() {
  if (!isAdminLoggedIn()) return;
  const box = $('#reqList');
  box.innerHTML = '<div class="hint">불러오는 중...</div>';
  try {
    const rows = await adminRest('machine_requests?status=eq.pending&order=created_at.asc&select=*');
    const userIds = [...new Set(rows.map(r => r.requester_id).filter(Boolean))];
    const gymIds = [...new Set(rows.map(r => r.gym_id).filter(Boolean))];
    const [profiles, gyms] = await Promise.all([
      userIds.length ? adminRest(`profiles?id=in.(${userIds.join(',')})&select=id,nickname,name`) : [],
      gymIds.length ? adminRest(`gyms?id=in.(${gymIds.map(encodeURIComponent).join(',')})&select=id,name`) : [],
    ]);
    const nick = new Map(profiles.map(p => [p.id, p.nickname || p.name]));
    const gymMap = new Map(gyms.map(g => [g.id, g.name]));
    requests = rows.map(r => ({ ...r, nickname: nick.get(r.requester_id) || '', gymExists: gymMap.has(r.gym_id) }));
    renderRequests();
  } catch (e) {
    box.innerHTML = `<div class="hint" style="color:var(--err)">${esc(e.message)}</div>`;
  }
}

function clearRequests() {
  requests = [];
  $('#reqCount').textContent = '-';
  $('#reqList').innerHTML = '<div class="hint">어드민으로 로그인하면 대기 중인 신청이 여기에 보여요.</div>';
}

function renderRequests() {
  $('#reqCount').textContent = String(requests.length);
  const box = $('#reqList');
  if (!isAdminLoggedIn()) { clearRequests(); return; }
  if (requests.length === 0) { box.innerHTML = '<div class="hint">대기 중인 신청이 없어요.</div>'; return; }
  box.innerHTML = '';
  for (const r of requests) {
    const imported = cards.some(c => c.request?.id === r.id);
    const row = document.createElement('div');
    row.className = 'req' + (imported ? ' imported' : '');
    row.innerHTML = `
      <div class="rthumb" style="${r.photo_url ? `background-image:url('${esc(r.photo_url)}')` : ''}"></div>
      <div>
        <div class="rname">${esc(r.machine_name || '(이름 없음)')} <span style="font-weight:400;color:var(--sub)">· ${esc(r.brand || '브랜드 없음')} · ${esc(r.target_muscle || '부위 없음')}</span></div>
        <div class="rsub">${esc(r.gym_name || '')}${r.gymExists ? '' : ' <b style="color:var(--err)">(헬스장을 찾을 수 없음)</b>'} · ${esc(r.nickname || r.requester_id || '')} · ${new Date(r.created_at).toLocaleDateString('ko-KR')}</div>
      </div>
      <div class="racts">
        <button class="primary" data-act="import"${imported ? ' disabled' : ''}>${imported ? '가져옴' : '카드로 가져오기'}</button>
        <button data-act="close" title="등록하지 않고 신청만 처리 완료로 바꿔요 (알림 없음)">처리 완료만</button>
      </div>`;
    $('[data-act="import"]', row).addEventListener('click', () => importRequest(r));
    $('[data-act="close"]', row).addEventListener('click', () => closeRequestOnly(r));
    box.appendChild(row);
  }
}

async function importRequest(r) {
  if (!db.loaded) await loadDb();
  let file = null;
  if (r.photo_url) {
    try {
      const res = await fetch(r.photo_url);
      if (res.ok) {
        const blob = await res.blob();
        const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        file = new File([blob], `신청사진_${slugify(r.machine_name) || 'machine'}.${ext}`, { type: blob.type || 'image/jpeg' });
      }
    } catch {}
  }
  const c = newCard({
    name: String(r.machine_name ?? '').trim().toUpperCase(),
    brand: brandFromRequest(r.brand),
    muscles: musclesFromRequest(r.target_muscle),
    request: {
      id: r.id, gymId: r.gymExists ? r.gym_id : '', gymName: r.gym_name || '',
      requesterId: r.requester_id, brand: r.brand, machineName: r.machine_name, targetMuscle: r.target_muscle,
    },
  });
  setCardFile(c, file);
  cards.unshift(c);
  renderList();
  renderRequests();
  c.el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function closeRequestOnly(r) {
  if (!confirm(`"${r.machine_name}" 신청을 등록 없이 처리 완료로 바꿀까요?\n(매니저에게 알림은 가지 않아요)`)) return;
  try {
    await adminRest(`machine_requests?id=eq.${r.id}`, { method: 'PATCH', body: { status: 'resolved' }, prefer: 'return=minimal' });
    requests = requests.filter(x => x.id !== r.id);
    renderRequests();
  } catch (e) {
    alert(e.message);
  }
}
