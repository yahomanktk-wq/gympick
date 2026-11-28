// 2026-11-27: 프리셋(제조사 시리즈 목록) → 카드 한 번에 만들기
// presets/*.js 가 window.GYMPICK_PRESETS 에 목록을 넣고, 여기서 버튼을 그린다.
// 이미지는 이 브라우저에서 바로 받아온다. 못 받으면 카드에 링크를 남기고 직접 넣게 한다.
function renderPresets() {
  const bar = $('#presetBar');
  const presets = window.GYMPICK_PRESETS || [];
  if (!presets.length) { bar.hidden = true; return; }
  bar.hidden = false;
  $('#presetButtons').innerHTML = presets.map(p =>
    `<button data-preset="${esc(p.key)}">${esc(p.label)} 카드 만들기</button>`).join('');
  bar.querySelectorAll('[data-preset]').forEach(btn =>
    btn.addEventListener('click', () => loadPreset(presets.find(p => p.key === btn.dataset.preset), btn)));
}

async function fetchImageFile(url, baseName) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  const blob = await res.blob();
  const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  return new File([blob], `${baseName}.${ext}`, { type: blob.type || 'image/jpeg' });
}

async function loadPreset(preset, btn) {
  if (!preset) return;
  if (!db.loaded) await loadDb();
  const dupNames = preset.items.filter(it => db.nameLineKeys.has(nameLineKey(it.brand, it.name, it.line)));
  if (dupNames.length && !confirm(`이미 같은 브랜드·라인·이름의 머신이 ${dupNames.length}개 있어요 (${dupNames.map(d => d.name).join(', ')}).\n그래도 카드를 만들까요?`)) return;
  btn.disabled = true;
  const label = btn.textContent;
  let failed = 0;
  const made = [];
  for (const [i, it] of preset.items.entries()) {
    btn.textContent = `불러오는 중 ${i + 1}/${preset.items.length}...`;
    const c = newCard({
      name: it.name, brand: it.brand, line: it.line || '', kind: it.kind || 'machine',
      muscles: [...it.muscles], cats: [...it.cats], displayName: it.displayName || '',
      note: it.note || '',
    });
    try {
      setCardFile(c, await fetchImageFile(it.image, `${slugify(it.brand)}_${slugify(it.line)}_${slugify(it.name)}`));
    } catch (e) {
      failed++;
      c.errorText = `이미지를 못 받았어요 (${e.message}) — 아래 주소에서 받아 사진 칸에 끌어다 놓아주세요: ${it.image}`;
    }
    made.push(c);
  }
  cards = [...made, ...cards];
  renderList();
  btn.disabled = false;
  btn.textContent = label;
  alert(`${made.length}개 카드를 만들었어요${failed ? ` (이미지 실패 ${failed}개 — 카드의 빨간 메시지 확인)` : ''}.\n카테고리·부위를 확인한 뒤 등록하세요.`);
}
