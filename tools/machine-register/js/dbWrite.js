// 2026-11-27: DB 바로 등록 (어드민 토큰)
// 순서: ID 중복 재확인 → 이미지 업로드(machine-images/{id}.webp) → machines insert
//       → (신청 카드면) 헬스장 연결(gym_machines) → 신청 처리(resolved) → 매니저 알림(machine_registered)
// 이미지를 먼저 올려야 machines insert 트리거(blurhash 생성)가 이미지를 읽을 수 있다.
// 이름 대문자 변환은 DB 트리거(trg_machines_uppercase_name)도 한다.

async function uploadMachineImage(id, blob) {
  const headers = await adminHeaders({ 'Content-Type': 'image/webp', 'x-upsert': 'true' });
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/machine-images/${encodeURIComponent(id)}.webp`, {
    method: 'POST', headers, body: blob,
  });
  if (!res.ok) throw new Error(`이미지 업로드 실패 (${res.status}): ${await res.text()}`);
}

/** 신청 카드 마무리: 헬스장 연결 → 신청 처리 → 매니저 알림. 실패한 단계는 메시지로 돌려준다 */
async function finishRequest(c, machineId, machineName) {
  const req = c.request;
  const notes = [];
  if (!req) return notes;
  if (!req.gymId) {
    notes.push('헬스장을 찾을 수 없어 연결·신청 처리는 하지 않았어요');
    return notes;
  }
  // 1) 헬스장 연결 — 이미 머신이 있는 헬스장이면 notify=true (앱 매니저 저장과 같은 기준: '새 머신 입고' 알림)
  const existing = await adminRest(`gym_machines?gym_id=eq.${encodeURIComponent(req.gymId)}&select=machine_id&limit=1`);
  await adminRest('gym_machines?on_conflict=gym_id,machine_id', {
    method: 'POST',
    body: { gym_id: req.gymId, machine_id: machineId, notify: existing.length > 0 },
    prefer: 'resolution=ignore-duplicates,return=minimal',
  });
  // 2) 신청 처리
  await adminRest(`machine_requests?id=eq.${req.id}`, { method: 'PATCH', body: { status: 'resolved' }, prefer: 'return=minimal' });
  // 3) 매니저 알림 (실패해도 등록은 끝난 상태)
  if (req.requesterId) {
    try {
      await adminRest('notifications', {
        method: 'POST',
        body: {
          user_id: req.requesterId,
          type: 'machine_registered',
          title: '머신 등록 완료',
          body: `신청하신 머신이 등록됐어요: ${req.gymName || '헬스장'} · ${machineName}`,
          related_id: req.gymId,
        },
        prefer: 'return=minimal',
      });
    } catch (e) {
      notes.push(`알림 실패: ${e.message}`);
    }
  }
  requests = requests.filter(r => r.id !== req.id);
  renderRequests();
  return notes;
}

function setBusy(c, busy) {
  c.busy = busy;
  if (busy) c.errorText = '';
  refreshAll();
}

function markDone(c, text) {
  c.done = true;
  c.busy = false;
  c.doneText = text;
  refreshAll();
}

async function registerCard(c, { silent = false } = {}) {
  if (c.done || c.busy) return false;
  refreshAll();
  if (!c.ok) { if (!silent) alert('빨간 항목을 먼저 채워주세요'); return false; }
  setBusy(c, true);
  const id = c.id;
  const row = machineRow(c);
  let inserted = false;
  try {
    // ID 중복 재확인 (불러온 뒤 다른 곳에서 등록됐을 수 있음)
    const dup = await adminRest(`machines?id=eq.${encodeURIComponent(id)}&select=id`);
    if (dup.length) throw new Error(`ID ${id}가 이미 DB에 있어요. '기존 데이터 불러오기'를 다시 눌러주세요`);

    await uploadMachineImage(id, await toWebp(c.file));
    await adminRest('machines', { method: 'POST', body: row, prefer: 'return=minimal' });
    inserted = true;
    addToIndex(row);

    const notes = await finishRequest(c, id, row.name);
    markDone(c, ['DB 등록 완료' + (c.request?.gymId ? ' · 헬스장 연결 · 신청 처리 · 매니저 알림' : ''), ...notes].join(' / '));
    return true;
  } catch (e) {
    c.busy = false;
    c.errorText = inserted ? `머신은 등록됐지만 마무리 실패: ${e.message}` : e.message;
    if (inserted) { c.done = true; c.doneText = `머신 등록됨 (${id}) · ${e.message}`; }
    refreshAll();
    if (!silent) alert(c.errorText);
    return false;
  }
}

async function linkCardToExisting(c) {
  if (c.done || c.busy) return;
  const machineId = (c.linkId || '').trim();
  const target = db.machines.find(m => keyOf(m.id) === keyOf(machineId));
  if (!target) { alert('연결할 기존 머신 id를 목록에서 골라주세요'); return; }
  if (!c.request?.gymId) { alert('이 신청의 헬스장을 찾을 수 없어요'); return; }
  if (!confirm(`${c.request.gymName}에 기존 머신 ${target.id} (${target.name})을 연결하고 신청을 처리할까요?`)) return;
  setBusy(c, true);
  try {
    const notes = await finishRequest(c, target.id, target.name);
    c.id = target.id;
    markDone(c, ['기존 머신으로 연결 · 신청 처리 · 매니저 알림', ...notes].join(' / '));
  } catch (e) {
    c.busy = false;
    c.errorText = e.message;
    refreshAll();
    alert(e.message);
  }
}

async function registerAll() {
  const targets = cards.filter(c => !c.done && c.ok);
  if (!targets.length) return;
  if (!confirm(`준비 완료된 ${targets.length}개를 DB에 등록할까요?`)) return;
  const btn = $('#registerAllBtn');
  btn.textContent = '등록 중...';
  let okCount = 0;
  for (const c of targets) if (await registerCard(c, { silent: true })) okCount++;
  btn.textContent = '준비된 카드 모두 DB에 등록';
  refreshAll();
  alert(`${okCount}/${targets.length}개 등록 완료${okCount < targets.length ? ' — 실패한 카드의 빨간 메시지를 확인해주세요' : ''}`);
}
