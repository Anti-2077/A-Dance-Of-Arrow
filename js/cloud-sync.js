/* A Dance Of Arrow — per-account cloud sync.
 * User-owned data is stored under users/{uid}; guest accounts stay local-only.
 */
import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-storage.js';

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
const auth = getAuth(app), db = getFirestore(app), storage = getStorage(app);
const PROJECT_KEY = 'adoa_editor_projects_v1';
const SKIP_KEYS = new Set(['rf_user']);
let activeUid = null, restoring = false, syncTimer = null, lastLocalSignature = '';
let cloudReady = false;
const statusId = 'adoaCloudSyncStatus';
function status(message, error=false) {
  let el = document.getElementById(statusId);
  if (!el) {
    el = document.createElement('div'); el.id = statusId;
    Object.assign(el.style, {position:'fixed',right:'12px',bottom:'12px',zIndex:'99999',padding:'8px 12px',borderRadius:'10px',fontSize:'12px',background:'#182234',color:'#eaf2ff',boxShadow:'0 4px 18px #0005',maxWidth:'min(90vw,420px)'});
    document.body.appendChild(el);
  }
  el.textContent = message; el.style.border = error ? '1px solid #ff7272' : '1px solid #526783';
}
function userRoot() { return doc(db, 'users', activeUid); }
function safeId(s) { return encodeURIComponent(String(s)).replaceAll('.', '%2E'); }
function getProjects() {
  try { const p = JSON.parse(localStorage.getItem(PROJECT_KEY) || '[]'); return Array.isArray(p) ? p : []; }
  catch { return []; }
}
function writeProjects(p) { localStorage.setItem(PROJECT_KEY, JSON.stringify(p)); }
function localKeys() { const out={}; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(!SKIP_KEYS.has(k) && k!==PROJECT_KEY && k!=='adoaCloudSyncStatus') out[k]=localStorage.getItem(k);} return out; }
function signature() { return JSON.stringify({kv:localKeys(),projects:getProjects().map(p=>({id:p.id,updatedAt:p.updatedAt, name:p.name}))}); }
async function uploadKV() {
  if(!activeUid || restoring) return;
  const local=localKeys();
  for(const [key,value] of Object.entries(local)) {
    if (value == null) continue;
    if (value.length > 900000) { console.warn('Skipping oversized local item',key); continue; }
    await setDoc(doc(userRoot(),'kv',safeId(key)), {key, value, updatedAt:serverTimestamp()});
  }
  // Deletions are synced explicitly so removed local preferences do not reappear on next login.
  const remote=await getDocs(collection(userRoot(),'kv'));
  for(const snap of remote.docs) { const key=snap.data()?.key; if(key && !(key in local) && !SKIP_KEYS.has(key)) await deleteDoc(snap.ref); }
}
async function uploadProjects() {
  if(!activeUid || restoring) return;
  const projects=getProjects();
  for(const p of projects) {
    if(!p || !p.id) continue;
    const payload=JSON.stringify(p);
    if(payload.length > 900000) { console.warn('Project too large for cloud document',p.id); continue; }
    await setDoc(doc(userRoot(),'projects',safeId(p.id)), {...p, cloudUpdatedAt:serverTimestamp()});
  }
  // A server-side project index makes deletions persist across devices.
  await setDoc(doc(userRoot(),'meta','projectIndex'), {ids:projects.map(p=>String(p.id)), updatedAt:serverTimestamp()});
}
async function pushAll() { if(!activeUid || restoring) return; try { await uploadKV(); await uploadProjects(); lastLocalSignature=signature(); cloudReady=true; status('클라우드 저장 완료 · 다른 기기에서 동기화할 수 있어요.'); } catch(e) { console.error('ADOA cloud save failed',e); status('클라우드 저장 실패: Firebase 보안 규칙과 Storage 설정을 확인해 주세요.',true); } }
async function restoreAll() {
  if(!activeUid) return;
  restoring=true;
  try {
    const kvSnap=await getDocs(collection(userRoot(),'kv'));
    const remoteKeys=new Set();
    for(const d of kvSnap.docs) { const x=d.data(); if(typeof x.key==='string' && typeof x.value==='string' && !SKIP_KEYS.has(x.key)) { localStorage.setItem(x.key,x.value); remoteKeys.add(x.key); } }
    // Preserve local-only values not yet present in the cloud; upload them after restore.
    const projectSnap=await getDocs(collection(userRoot(),'projects'));
    const remoteProjects=projectSnap.docs.map(d=>{const x=d.data(); delete x.cloudUpdatedAt; return x;}).filter(p=>p && p.id);
    const indexSnap=await getDoc(doc(userRoot(),'meta','projectIndex'));
    const indexed = indexSnap.exists() && Array.isArray(indexSnap.data().ids) ? new Set(indexSnap.data().ids.map(String)) : null;
    const localProjects=getProjects();
    const merged=new Map();
    for(const p of remoteProjects) merged.set(String(p.id),p);
    for(const p of localProjects) {
      const id=String(p.id); const old=merged.get(id);
      if(!old || (Date.parse(p.updatedAt||0)||0) > (Date.parse(old.updatedAt||0)||0)) merged.set(id,p);
    }
    // If this account has a project index, it is authoritative for cloud deletions.
    let finalProjects=[...merged.values()];
    if(indexed) finalProjects=finalProjects.filter(p=>indexed.has(String(p.id)) || !remoteProjects.some(r=>String(r.id)===String(p.id)));
    finalProjects.sort((a,b)=>(Date.parse(b.updatedAt||0)||0)-(Date.parse(a.updatedAt||0)||0));
    writeProjects(finalProjects.slice(0,100));
    cloudReady=true;
  } catch(e) { console.error('ADOA cloud restore failed',e); status('클라우드 불러오기 실패: Firestore 보안 규칙을 확인해 주세요.',true); throw e; }
  finally { restoring=false; }
  await pushAll();
}
function queueSync() { if(!activeUid || restoring || !cloudReady) return; clearTimeout(syncTimer); syncTimer=setTimeout(()=>{ const sig=signature(); if(sig!==lastLocalSignature) pushAll(); },1200); }
// Capture same-tab localStorage changes (the native storage event only fires in other tabs).
const originalSet=Storage.prototype.setItem, originalRemove=Storage.prototype.removeItem, originalClear=Storage.prototype.clear;
Storage.prototype.setItem=function(k,v){ originalSet.call(this,k,v); if(this===localStorage && !String(k).startsWith('adoaCloudSync')) queueSync(); };
Storage.prototype.removeItem=function(k){ originalRemove.call(this,k); if(this===localStorage) queueSync(); };
Storage.prototype.clear=function(){ originalClear.call(this); if(this===localStorage) queueSync(); };
window.addEventListener('storage',queueSync);
setInterval(()=>{ if(activeUid && cloudReady){const sig=signature(); if(sig!==lastLocalSignature) queueSync();} },3000);

// Editor audio blobs live in IndexedDB locally; mirror them to Firebase Storage for cross-device use.
window.ADOACloudUploadAudio = async (projectId, blob, name) => {
  if(!activeUid || !blob) return false;
  try { const path=`users/${activeUid}/audio/${safeId(projectId)}`; await uploadBytes(ref(storage,path),blob,{contentType:blob.type||'application/octet-stream',customMetadata:{fileName:String(name||'audio')}}); return true; }
  catch(e){ console.error('Audio cloud upload failed',e); status('프로젝트는 저장했지만 음원 클라우드 저장에 실패했어요. Storage 규칙을 확인해 주세요.',true); return false; }
};
window.ADOACloudDownloadAudio = async (projectId) => {
  if(!activeUid) return null;
  try { const url=await getDownloadURL(ref(storage,`users/${activeUid}/audio/${safeId(projectId)}`)); const response=await fetch(url); if(!response.ok) throw new Error('음원 다운로드 실패'); return await response.blob(); }
  catch(e){ console.warn('Cloud audio unavailable',e); return null; }
};

onAuthStateChanged(auth, async user => {
  activeUid = user && !user.isAnonymous ? user.uid : null;
  cloudReady=false;
  if(!activeUid) { status(user?.isAnonymous ? '게스트 모드 · 이 기기에만 저장됩니다.' : '로그인하면 클라우드 저장이 활성화됩니다.'); return; }
  status('계정 저장 데이터를 확인하는 중…');
  try { await restoreAll(); } catch { /* Error is shown by restoreAll. */ }
});
