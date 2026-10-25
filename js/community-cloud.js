// 1) Firebase Console > 프로젝트 설정 > 내 앱 > SDK 설정에서 받은 웹 앱 설정으로 아래 값을 바꾸세요.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
// 원하는 개발자 코드로 바꾸세요. HTML에 들어 있으므로 보안용 비밀번호로 사용하지 마세요.
const DEVELOPER_CODE = '9292';
let db = null;
let developerUnlocked = false;
let selectedJson = null;
const $id = id => document.getElementById(id);
const safeText = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setCloudStatus(message){ $id('cloudStatus').textContent = message; }
function configReady(){ return firebaseConfig.apiKey !== 'YOUR_API_KEY' && firebaseConfig.projectId !== 'YOUR_PROJECT_ID' && firebaseConfig.appId !== 'YOUR_APP_ID'; }
try {
  if(configReady()){
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    setCloudStatus('Firebase 연결 준비 완료');
    await refreshCharts();
  } else {
    setCloudStatus('먼저 HTML 안의 firebaseConfig 값을 입력하세요.');
  }
} catch(error){ console.error(error); setCloudStatus('Firebase 초기화 실패: 설정 값을 확인하세요.'); }

$id('unlockDeveloper').addEventListener('click',()=>{
  if($id('developerCodeInput').value === DEVELOPER_CODE){
    developerUnlocked = true; $id('developerTools').hidden = false; $id('developerCodeInput').value = ''; setCloudStatus('개발자 메뉴가 열렸습니다.');
  } else { developerUnlocked = false; $id('developerTools').hidden = true; alert('개발자 코드가 틀렸습니다.'); }
});
$id('lockDeveloper').addEventListener('click',()=>{developerUnlocked=false;$id('developerTools').hidden=true;$id('developerCodeInput').value='';});
$id('chartJsonFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0]; if(!file){selectedJson=null;return;}
  try { if(file.size>2*1024*1024) throw new Error('JSON 파일은 2MB 이하만 지원합니다.'); selectedJson=JSON.parse(await file.text()); if(!selectedJson || !Array.isArray(selectedJson.notes)) throw new Error('notes 배열이 없는 채보 JSON입니다.'); $id('jsonTitle').value=$id('jsonTitle').value||file.name.replace(/\.json$/i,''); alert('JSON 채보를 읽었습니다. 업로드 버튼을 눌러 등록하세요.'); }
  catch(err){selectedJson=null;alert('JSON 읽기 실패: '+err.message);}
});
async function uploadChart(chart,title,artist,difficulty){
  if(!developerUnlocked){alert('먼저 개발자 메뉴를 열어 주세요.');return;}
  if(!db){alert('Firebase 설정을 먼저 완료해야 서버에 업로드할 수 있습니다.');return;}
  if(!title.trim()){alert('곡 이름을 입력하세요.');return;}
  if(!chart || !Array.isArray(chart.notes)){alert('유효한 채보 데이터가 없습니다.');return;}
  if(JSON.stringify(chart).length>850000){alert('채보 데이터가 너무 큽니다. 이미지/오디오 원본은 포함하지 말고 다시 시도하세요.');return;}
  try{
    await addDoc(collection(db,'publicCharts'),{title:title.trim(),artist:artist.trim()||'Unknown',difficulty,format:chart.format||'RhythmForgeChart',version:chart.version||1,bpm:Number(chart.bpm)||180,keyCount:Number(chart.keyCount)||4,noteCount:chart.notes.length,chart,createdAt:serverTimestamp()});
    alert('공개 채보를 서버에 등록했습니다.'); await refreshCharts();
  }catch(err){console.error(err);alert('업로드 실패: '+err.message+'\nFirestore 보안 규칙과 Firebase 설정을 확인하세요.');}
}
$id('uploadCurrentChart').addEventListener('click',()=>{const chart=window.ADOAChartBridge?.getCurrentChart();if(!developerUnlocked){alert('먼저 개발자 메뉴를 열어 주세요.');return;}window.ADOAAddLocalChart?.(chart,$id('uploadTitle').value,$id('uploadArtist').value,$id('uploadDifficulty').value);if(db)uploadChart(chart,$id('uploadTitle').value,$id('uploadArtist').value,$id('uploadDifficulty').value);else alert('이 브라우저에 채보를 저장했습니다. 다른 기기와 공유하려면 Firebase 설정이 필요합니다.');});
$id('uploadJsonChart').addEventListener('click',()=>{if(!developerUnlocked){alert('먼저 개발자 메뉴를 열어 주세요.');return;}window.ADOAAddLocalChart?.(selectedJson,$id('jsonTitle').value,$id('jsonArtist').value,$id('jsonDifficulty').value);if(db)uploadChart(selectedJson,$id('jsonTitle').value,$id('jsonArtist').value,$id('jsonDifficulty').value);else alert('이 브라우저에 채보를 저장했습니다. 다른 기기와 공유하려면 Firebase 설정이 필요합니다.');});
$id('refreshCharts').addEventListener('click',refreshCharts);
async function refreshCharts(){
  const list=$id('publicChartList'); if(!db){setCloudStatus('Firebase 설정을 완료하면 공개 서버 목록이 표시됩니다.');window.ADOARefreshGameCharts?.();return;}
  setCloudStatus('채보 목록을 불러오는 중…');
  try{
    const q=query(collection(db,'publicCharts'),orderBy('createdAt','desc'),limit(50));
    const snap=await getDocs(q);
    if(snap.empty){list.innerHTML='<div class="listitem">아직 등록된 채보가 없습니다.</div>';setCloudStatus('공개 채보 0개');return;}
    list.innerHTML=snap.docs.map(doc=>{const d=doc.data();return `<div class="listitem" style="align-items:flex-start"><div><strong>${safeText(d.title||'제목 없음')}</strong><div class="muted">${safeText(d.artist||'Unknown')} · ${safeText(d.difficulty||'Normal')} · ${safeText(d.bpm||'?')} BPM · ${safeText(d.keyCount||'?')}키 · 노트 ${safeText(d.noteCount??'?')}개</div></div><button data-load-chart="${doc.id}">에디터에 불러오기</button></div>`;}).join('');
    snap.docs.forEach(doc=>{const button=list.querySelector(`[data-load-chart="${doc.id}"]`);button?.addEventListener('click',()=>{try{window.ADOAChartBridge.loadChart(doc.data().chart);}catch(err){alert('채보 불러오기 실패: '+err.message);}});});
    setCloudStatus(`공개 채보 ${snap.size}개 표시 중 (최대 50개)`);window.ADOASetServerCharts?.(snap.docs.map(doc=>({id:doc.id,...doc.data(),source:'server'})));window.ADOARefreshGameCharts?.();
  }catch(err){console.error(err);list.innerHTML='<div class="listitem">목록을 불러오지 못했습니다. Firestore 규칙과 인덱스 설정을 확인하세요.</div>';setCloudStatus('오류: '+err.message);}
}
