/* A Dance Of Arrow — browser-local chart library (no Firebase / no network). */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const DEVELOPER_CODE = '9292';
  let unlocked = false;
  let selectedJson = null;
  const status = message => { const el = $('cloudStatus'); if (el) el.textContent = message; };

  $('unlockDeveloper')?.addEventListener('click', () => {
    if ($('developerCodeInput')?.value === DEVELOPER_CODE) {
      unlocked = true;
      $('developerTools').hidden = false;
      $('developerCodeInput').value = '';
      status('저장 도구가 열렸습니다.');
    } else {
      unlocked = false;
      $('developerTools').hidden = true;
      alert('개발자 코드가 틀렸습니다.');
    }
  });
  $('lockDeveloper')?.addEventListener('click', () => {
    unlocked = false;
    $('developerTools').hidden = true;
    $('developerCodeInput').value = '';
    status('저장 도구가 잠겼습니다.');
  });
  $('chartJsonFile')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) { selectedJson = null; return; }
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('JSON 파일은 2MB 이하만 지원합니다.');
      selectedJson = JSON.parse(await file.text());
      if (!selectedJson || !Array.isArray(selectedJson.notes)) throw new Error('notes 배열이 없는 채보 JSON입니다.');
      $('jsonTitle').value = $('jsonTitle').value || file.name.replace(/\.json$/i, '');
      alert('JSON 채보를 읽었습니다. 저장 버튼을 눌러 등록하세요.');
    } catch (err) { selectedJson = null; alert('JSON 읽기 실패: ' + err.message); }
  });
  $('uploadCurrentChart')?.addEventListener('click', () => {
    if (!unlocked) { alert('먼저 저장 도구를 열어 주세요.'); return; }
    const chart = window.ADOAChartBridge?.getCurrentChart();
    window.ADOAAddLocalChart?.(chart, $('uploadTitle').value, $('uploadArtist').value, $('uploadDifficulty').value);
    status('현재 채보를 이 브라우저에 저장했습니다.');
  });
  $('uploadJsonChart')?.addEventListener('click', () => {
    if (!unlocked) { alert('먼저 저장 도구를 열어 주세요.'); return; }
    if (!selectedJson) { alert('먼저 JSON 채보 파일을 선택하세요.'); return; }
    window.ADOAAddLocalChart?.(selectedJson, $('jsonTitle').value, $('jsonArtist').value, $('jsonDifficulty').value);
    status('JSON 채보를 이 브라우저에 저장했습니다.');
  });
  $('refreshCharts')?.addEventListener('click', () => {
    window.ADOARefreshGameCharts?.();
    status('이 브라우저에 저장된 채보 목록을 새로고침했습니다.');
  });
  status('기기 내 저장 모드 · 서버 연결 없음');
})();
