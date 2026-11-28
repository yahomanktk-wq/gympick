// 2026-11-27: 화면 이벤트 연결 + 시작 (마지막에 불러온다)
$('#csvBtn').addEventListener('click', () => {
  download(new Blob([toCsv()], { type: 'text/csv;charset=utf-8' }), `machines_${stamp()}.csv`);
});
$('#zipBtn').addEventListener('click', downloadZip);
$('#registerAllBtn').addEventListener('click', registerAll);

const drop = $('#drop');
$('#pickBtn').addEventListener('click', () => $('#fileInput').click());
$('#fileInput').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
$('#reloadBtn').addEventListener('click', loadDb);

$('#loginBtn').addEventListener('click', login);
$('#adminPassword').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
$('#logoutBtn').addEventListener('click', logout);
$('#reqReloadBtn').addEventListener('click', loadRequests);

(async () => {
  try {
    const saved = localStorage.getItem(KEY_STORAGE);
    if (saved) $('#anonKey').value = saved;
  } catch {}
  restoreSession();
  renderPresets();
  if (anonKey()) await loadDb();
  if (isAdminLoggedIn()) await loadRequests();
})();
