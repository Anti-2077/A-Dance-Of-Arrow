import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInAnonymously, signOut, updateProfile, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';

// Firebase web config. These client-side values are not password secrets.
const firebaseConfig = {
  apiKey: "AIzaSyAdDjMKY59ZA2q56CV2cGgNMlU0HbtPc8",
  authDomain: "a-dance-of-arrow.firebaseapp.com",
  databaseURL: "https://a-dance-of-arrow-default-rtdb.firebaseio.com",
  projectId: "a-dance-of-arrow",
  storageBucket: "a-dance-of-arrow.firebasestorage.app",
  messagingSenderId: "417615296079",
  appId: "1:417615296079:web:e4cb24b966a2c30d5d1c3a",
  measurementId: "G-Y3GN9RBL3H"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const $ = id => document.getElementById(id);
const modal = $('loginModal');
const modalBox = modal.querySelector('.modal');
let mode = 'login';
let busy = false;

// Firebase's email/password provider requires an email-shaped identifier.
// This deterministic internal identifier means the player only enters a username.
function usernameToEmail(name) {
  const clean = name.trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,20}$/.test(clean)) {
    throw new Error('아이디는 영문 소문자, 숫자, _ 또는 -로 3~20자 입력해 주세요.');
  }
  return `${clean}@accounts.adoa.invalid`;
}
function setMessage(message, isError = false) {
  let el = $('authMessage');
  if (!el) {
    el = document.createElement('p'); el.id = 'authMessage'; el.className = 'muted';
    const actions = $('authActions');
    modalBox.insertBefore(el, actions);
  }
  el.textContent = message;
  el.style.color = isError ? '#ff8c8c' : '';
}
function ensureAuthUI() {
  modalBox.innerHTML = `
    <button class="close" id="closeModal" type="button" aria-label="닫기">×</button>
    <h2 id="authTitle">로그인</h2>
    <p class="muted">이메일 없이 아이디와 비밀번호로 이용할 수 있어요.</p>
    <label for="authUsername">아이디</label>
    <input id="authUsername" autocomplete="username" placeholder="영문 소문자·숫자 3~20자" maxlength="20">
    <label for="authPassword">비밀번호</label>
    <input id="authPassword" type="password" autocomplete="current-password" placeholder="비밀번호 (6자 이상)" minlength="6">
    <div id="authMessage" class="muted" role="status"></div>
    <div id="authActions" style="display:grid;gap:8px;margin-top:12px">
      <button class="primary wide" id="authSubmit" type="button">로그인</button>
      <button class="wide" id="authSwitch" type="button">처음이신가요? 회원가입</button>
      <button class="wide" id="guestFromModal" type="button">게스트로 시작</button>
    </div>`;
  $('closeModal').onclick = () => modal.classList.add('hidden');
  $('authSubmit').onclick = submitAuth;
  $('authSwitch').onclick = () => { mode = mode === 'login' ? 'register' : 'login'; updateMode(); };
  $('guestFromModal').onclick = startGuest;
  $('authPassword').addEventListener('keydown', e => { if (e.key === 'Enter') submitAuth(); });
  $('authUsername').addEventListener('keydown', e => { if (e.key === 'Enter') $('authPassword').focus(); });
}
function updateMode() {
  $('authTitle').textContent = mode === 'login' ? '로그인' : '회원가입';
  $('authSubmit').textContent = mode === 'login' ? '로그인' : '계정 만들기';
  $('authSwitch').textContent = mode === 'login' ? '처음이신가요? 회원가입' : '이미 계정이 있나요? 로그인';
  $('authPassword').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  setMessage('');
}
function mapError(error) {
  const code = error?.code || '';
  if (code.includes('email-already-in-use')) return '이미 사용 중인 아이디예요. 다른 아이디를 선택해 주세요.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return '아이디 또는 비밀번호가 맞지 않아요.';
  if (code.includes('weak-password')) return '비밀번호는 6자 이상으로 설정해 주세요.';
  if (code.includes('network-request-failed')) return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
  if (code.includes('operation-not-allowed')) return 'Firebase에서 이메일/비밀번호 로그인 사용 설정을 확인해 주세요.';
  return `처리하지 못했어요: ${error?.message || '알 수 없는 오류'}`;
}
async function submitAuth() {
  if (busy) return;
  const username = $('authUsername').value.trim().toLowerCase();
  const password = $('authPassword').value;
  let email;
  try { email = usernameToEmail(username); }
  catch (e) { setMessage(e.message, true); return; }
  if (password.length < 6) { setMessage('비밀번호는 6자 이상 입력해 주세요.', true); return; }
  busy = true; $('authSubmit').disabled = true; setMessage(mode === 'login' ? '로그인 중…' : '계정을 만드는 중…');
  try {
    if (mode === 'register') {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: username });
    } else {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      if (!credential.user.displayName) await updateProfile(credential.user, { displayName: username });
    }
    modal.classList.add('hidden');
  } catch (error) { setMessage(mapError(error), true); }
  finally { busy = false; $('authSubmit').disabled = false; }
}
async function startGuest() {
  try { await signInAnonymously(auth); modal.classList.add('hidden'); }
  catch (error) { setMessage(mapError(error), true); }
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.toggle('active', el.id === id));
}
ensureAuthUI();
$('openLogin').onclick = () => { mode = 'login'; updateMode(); modal.classList.remove('hidden'); };
$('startGuest').onclick = startGuest;
$('logout').onclick = async () => {
  try { await signOut(auth); } catch (e) { console.error(e); setMessage(mapError(e), true); }
};
onAuthStateChanged(auth, user => {
  if (user) {
    const label = user.isAnonymous ? '게스트' : (user.displayName || '사용자');
    $('userStatus').textContent = label;
    localStorage.setItem('rf_user', label);
    showScreen('menu');
  } else {
    $('userStatus').textContent = '로그인 전';
    localStorage.removeItem('rf_user');
    showScreen('home');
  }
});
