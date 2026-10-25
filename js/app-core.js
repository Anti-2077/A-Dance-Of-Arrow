(()=> {
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const defaults={4:['D','F','J','K'],6:['S','D','F','J','K','L'],8:['A','S','D','F','J','K','L',';']};
let keys=JSON.parse(localStorage.getItem('rf_keys')||'null')||structuredClone(defaults), activeKey=4, offset=+(localStorage.getItem('rf_offset')||0), user=localStorage.getItem('rf_user')||'', audio=null, audioUrl=null;
let notes=[], selected=null, events=[], effects=[], images=[], undoStack=[];
const toast=(m)=>{const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)};
function show(id){
  $$('.screen').forEach(s=>s.classList.toggle('active',s.id===id));
  // The editor is hidden on initial load, so its timeline has width 0 until shown.
  if(id==='editor') requestAnimationFrame(()=>{buildGuides();renderNotes()});
}
function enter(name){user=name;localStorage.setItem('rf_user',name);$('#userStatus').textContent=name==='guest'?'게스트':name;show('menu')}
if(user){$('#userStatus').textContent=user==='guest'?'게스트':user;show('menu')}
$('#openLogin').onclick=()=>$('#loginModal').classList.remove('hidden');$('#closeModal').onclick=()=>$('#loginModal').classList.add('hidden');
$('#loginDemo').onclick=()=>{enter($('#nickname').value.trim()||'Player');$('#loginModal').classList.add('hidden')};
$('#guestFromModal').onclick=$('#startGuest').onclick=()=>{enter('guest');$('#loginModal').classList.add('hidden')};
$('#logout').onclick=()=>{user='';localStorage.removeItem('rf_user');$('#userStatus').textContent='로그인 전';show('home')};
$$('[data-screen]').forEach(b=>b.onclick=()=>show(b.dataset.screen));$$('.back').forEach(b=>b.onclick=()=>show('menu'));
function persistSettings(){localStorage.setItem('rf_keys',JSON.stringify(keys));localStorage.setItem('rf_offset',offset)}
function renderKeys(){const box=$('#keyRows');box.innerHTML='';keys[activeKey].forEach((k,i)=>{const row=document.createElement('div');row.className='key-row';row.innerHTML=`<span>레인 ${i+1}</span><button>${escapeHtml(k)}</button>`;row.querySelector('button').onclick=()=>{row.querySelector('button').textContent='키를 누르세요…';const handler=e=>{if(['Shift','Control','Alt','Meta'].includes(e.key))return;e.preventDefault();keys[activeKey][i]=e.key.length===1?e.key.toUpperCase():e.key;document.removeEventListener('keydown',handler);persistSettings();renderKeys();updateOffsetHint()};document.addEventListener('keydown',handler)};box.appendChild(row)})}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
$$('[data-keytab]').forEach(b=>b.onclick=()=>{$$('[data-keytab]').forEach(x=>x.classList.toggle('active',x===b));activeKey=+b.dataset.keytab;renderKeys()});
$('#resetKeys').onclick=()=>{keys=structuredClone(defaults);persistSettings();renderKeys();updateOffsetHint();toast('기본 키 배치로 초기화했습니다.')};renderKeys();
function updateOffset(){ $('#offsetValue').textContent=offset>0?'+'+offset:offset;localStorage.setItem('rf_offset',offset)}
window.__setRhythmForgeOffset=function(n){n=Number(n);if(Number.isFinite(n)){offset=n;updateOffset()}};window.__getRhythmForgeOffset=function(){return offset};
$('#offsetMinus').onclick=()=>{offset--;updateOffset()};$('#offsetPlus').onclick=()=>{offset++;updateOffset()};$('#offsetReset').onclick=()=>{offset=0;updateOffset()};updateOffset();
function updateOffsetHint(){$('#offsetHint').textContent='첫 번째 4키: '+keys[4][0]+' · 키를 눌러 테스트하세요.'}updateOffsetHint();
document.addEventListener('keydown',e=>{if(e.repeat||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;if(e.key.toUpperCase()===keys[4][0].toUpperCase()){$('#targetArrow').animate([{transform:'translateX(-50%) scale(1)'},{transform:'translateX(-50%) scale(1.45)'},{transform:'translateX(-50%) scale(1)'}],180);$('#offsetHint').textContent='입력 감지 · 현재 보정값 '+offset+'ms'}if(selected!==null&&e.key==='ArrowUp'){e.preventDefault();nudge(-1)}if(selected!==null&&e.key==='ArrowDown'){e.preventDefault();nudge(1)}if(selected!==null&&e.key==='Delete'){deleteSelected()}});
['musicVol','sfxVol','keyVol'].forEach((id,i)=>{const out=$('#'+['musicVal','sfxVal','keyVal'][i]);$('#'+id).oninput=e=>{out.textContent=e.target.value+'%';localStorage.setItem(id,e.target.value);if(i===0&&audio)audio.volume=e.target.value/100}});
const timeline=$('#timeline'),guides=$('#guides'),noteLayer=$('#notes');
function beatStep(){const bpm=Math.max(1,+$('#bpm').value||180),sub=+$('#subdivision').value||1;return 60/bpm/sub}
function editorLaneCount(){return Math.max(1,Math.min(8,+$('#keyCount').value||8))}
function editorViewDuration(){const base=beatStep()*64;const latest=notes.reduce((m,n)=>Math.max(m,Number(n.time)||0),0);return Math.max(base,latest+beatStep()*4)}
function positionFromTime(time){return Math.max(0,Math.min(1,(Math.max(0,Number(time)||0)/editorViewDuration())))}
function buildGuides(){
  guides.innerHTML='';const laneCount=editorLaneCount();const viewDuration=editorViewDuration();const baseDuration=beatStep()*64;timeline.style.height=Math.max(560,560*viewDuration/baseDuration)+'px';guides.style.gridTemplateColumns=`repeat(${laneCount},minmax(0,1fr))`;const targets=$('#editorTargets');if(targets){targets.style.gridTemplateColumns=`repeat(${laneCount},minmax(0,1fr))`;targets.innerHTML=Array.from({length:laneCount},()=>'<div class="editor-target"></div>').join('')}
  for(let lane=0;lane<laneCount;lane++){
    const g=document.createElement('div');g.className='guide';g.dataset.lane=lane;
    const label=document.createElement('span');label.className='guide-label';label.textContent=String(lane+1);g.appendChild(label);const steps=Math.ceil(viewDuration/beatStep());for(let k=0;k<=steps;k++){const line=document.createElement('div');line.className='time-grid-line '+(k%Math.max(1,+$('#subdivision').value||1)===0?'major':'');line.style.top=(k/steps*100)+'%';g.appendChild(line)}
    g.onclick=e=>{e.stopPropagation();const rect=timeline.getBoundingClientRect();let ratio=Math.max(0,Math.min(.9999,(e.clientY-rect.top)/rect.height));let step=beatStep();let time=ratio*viewDuration;if($('#snap')?.checked)time=Math.round(time/step)*step;pushUndo();addNote({time,lane,pos:positionFromTime(time)})};
    guides.appendChild(g);
  }
  renderNotes();
}
function pushUndo(){undoStack.push(JSON.stringify({notes,events,effects}));if(undoStack.length>50)undoStack.shift()}
function addNote(n){n.id=Date.now()+Math.random();notes.push(n);selected=n.id;renderNotes()}
// Expose note creation for the editor's dynamically generated beat-grid click handler.
window.addNote=addNote; window.renderNotes=renderNotes; window.getEditorNotes=()=>notes;
function renderNotes(){noteLayer.innerHTML='';const lanes=editorLaneCount();noteLayer.style.display='grid';const viewDuration=editorViewDuration();notes.forEach(n=>{n.pos=positionFromTime(n.time);const el=document.createElement('button');el.className='note'+(n.id===selected?' selected':'');el.style.left=(((Math.max(0,Math.min(lanes-1,n.lane||0))+.5)/lanes)*100)+'%';el.style.top=(n.pos*100)+'%';el.style.zIndex=String(10+Math.round(n.pos*1000));el.textContent='';el.title=`${(n.time*1000).toFixed(0)} ms · 레인 ${(n.lane||0)+1}`;el.onclick=e=>{e.stopPropagation();selected=n.id;renderNotes();syncSelected()};noteLayer.appendChild(el)});syncSelected();if($('#autosave')?.checked)localStorage.setItem('rf_chart',JSON.stringify(typeof chartSnapshot==='function'?chartSnapshot():{notes,events,effects,bpm:$('#bpm').value,subdivision:$('#subdivision').value,keyCount:$('#keyCount').value}))}
function currentNote(){return notes.find(n=>n.id===selected)}
function syncSelected(){const n=currentNote();$('#selectedInfo').textContent=n?`선택됨 · ${(n.time*1000).toFixed(0)}ms · 레인 ${(n.lane||0)+1}`:'노트를 선택하면 세부 정보가 표시됩니다.';if(n){$('#noteTime').value=n.time.toFixed(3);const max=+$('#keyCount').value;$('#noteLane').innerHTML=Array.from({length:max},(_,i)=>`<option value="${i}">${i+1}</option>`).join('');$('#noteLane').value=Math.min(n.lane||0,max-1)}}
function nudge(ms){const n=currentNote();if(!n)return;pushUndo();n.time=Math.max(0,n.time+ms/1000);n.pos=positionFromTime(n.time);renderNotes()}
function deleteSelected(){if(selected===null)return;pushUndo();notes=notes.filter(n=>n.id!==selected);selected=null;renderNotes()}
$('#noteTime').onchange=e=>{const n=currentNote();if(n){pushUndo();n.time=Math.max(0,+e.target.value||0);n.pos=positionFromTime(n.time);renderNotes()}};
$('#noteLane').onchange=e=>{const n=currentNote();if(n){pushUndo();n.lane=+e.target.value;renderNotes()}};
$('#nudgeBack').onclick=()=>nudge(-1);$('#nudgeForward').onclick=()=>nudge(1);$('#deleteNote').onclick=deleteSelected;
$('#undo').onclick=()=>{const v=undoStack.pop();if(!v){toast('실행 취소할 작업이 없습니다.');return}const d=JSON.parse(v);notes=d.notes;events=d.events;effects=d.effects;selected=null;renderNotes();renderEvents();renderEffects()};
$('#bpm').oninput=buildGuides;$('#subdivision').onchange=buildGuides;window.addEventListener('resize',buildGuides);setTimeout(buildGuides,80);
$('#keyCount').onchange=()=>{const max=+$('#keyCount').value;$('#noteLane').innerHTML=Array.from({length:max},(_,i)=>`<option value="${i}">${i+1}</option>`).join('');renderNotes()};
let duration=0;
$('#audioFile').onchange=e=>{const f=e.target.files[0];if(!f)return;if(audio){audio.pause();URL.revokeObjectURL(audioUrl)}audioUrl=URL.createObjectURL(f);audio=new Audio(audioUrl);audio.onloadedmetadata=()=>{duration=audio.duration;$('#duration').textContent=duration.toFixed(3)+'s';$('#seek').max=duration;toast('곡을 불러왔습니다.')};audio.ontimeupdate=()=>{$('#now').textContent=audio.currentTime.toFixed(3)+'s';$('#seek').value=audio.currentTime};audio.volume=$('#musicVol').value/100};
let editorClock=0,editorClockStart=0,editorClockRAF=0,editorPlaying=false;
function tickEditorClock(){if(!editorPlaying)return;const t=editorClock+(performance.now()-editorClockStart)/1000;$('#now').textContent=t.toFixed(3)+'s';if(!audio){$('#seek').value=t;$('#duration').textContent='무음 미리보기';}if(t>=64*beatStep()){editorPlaying=false;return}editorClockRAF=requestAnimationFrame(tickEditorClock)}
$('#playAudio').onclick=()=>{if(audio){audio.play().catch(()=>toast('이 곡을 재생할 수 없습니다.'));}else{editorClock=0;editorClockStart=performance.now();editorPlaying=true;cancelAnimationFrame(editorClockRAF);tickEditorClock();toast('음악 없이 채보 시계를 재생합니다.')}};
$('#pauseAudio').onclick=()=>{if(audio)audio.pause();if(editorPlaying){editorClock+= (performance.now()-editorClockStart)/1000;editorPlaying=false;cancelAnimationFrame(editorClockRAF)}};
$('#stopAudio').onclick=()=>{if(audio){audio.pause();audio.currentTime=0}editorPlaying=false;editorClock=0;$('#now').textContent='0.000s';$('#seek').value=0;cancelAnimationFrame(editorClockRAF)};
$('#seek').oninput=e=>{if(audio)audio.currentTime=+e.target.value;else{editorClock=+e.target.value||0;$('#now').textContent=editorClock.toFixed(3)+'s'}};
$('#addEvent').onclick=()=>{pushUndo();events.push({time:+$('#eventTime').value||0,keys:+$('#eventKeys').value,x:+$('#lineX').value||50});events.sort((a,b)=>a.time-b.time);renderEvents()};
function renderEvents(){$('#eventList').innerHTML=events.map((e,i)=>`<div class="listitem"><span>${e.time.toFixed(3)}s · ${e.keys}키 · 판정선 X ${e.x}%</span><button data-del-event="${i}">삭제</button></div>`).join('');$$('[data-del-event]').forEach(b=>b.onclick=()=>{pushUndo();events.splice(+b.dataset.delEvent,1);renderEvents()})}
$('#addEffect').onclick=()=>{pushUndo();const ms=Math.max(0,Number($('#effectTime').value)||0);const durationMs=Math.max(10,(Number($('#effectDuration').value)||0.5)*1000);const type=$('#effectType').value;const raw=Number($('#effectValue').value);const value=Number.isFinite(raw)?raw:(type==='회전'?90:150);effects.push({time:ms/1000,timeMs:ms,type,value,duration:durationMs,durationMs});effects.sort((a,b)=>a.time-b.time);renderEffects();if(typeof setProjectDirty==='function')setProjectDirty()};
function renderEffects(){$('#effectList').innerHTML=effects.map((e,i)=>{const d=Number(e.durationMs??e.duration)||500;const unit=e.type==='회전'?'°':(['확대','축소'].includes(e.type)?'%':'');return `<div class="listitem"><span>${Number(e.timeMs??((Number(e.time)||0)*1000)).toFixed(0)}ms · ${escapeHtml(e.type)} · 목표 ${Number(e.value)||0}${unit} · ${(d/1000).toFixed(2)}초</span><button data-del-effect="${i}">삭제</button></div>`}).join('');$$('[data-del-effect]').forEach(b=>b.onclick=()=>{pushUndo();effects.splice(+b.dataset.delEffect,1);renderEffects();if(typeof setProjectDirty==='function')setProjectDirty()})}
$('#imageFiles').onchange=e=>{[...e.target.files].forEach(f=>images.push({name:f.name,priority:images.length+1,url:URL.createObjectURL(f)}));renderImages()};
function renderImages(){$('#imageList').innerHTML=images.map((im,i)=>`<div class="listitem"><span>${escapeHtml(im.name)} · 레이어 ${im.priority}</span><span><button data-up="${i}">↑</button> <button data-down="${i}">↓</button> <button data-remove-image="${i}">×</button></span></div>`).join('');$$('[data-up]').forEach(b=>b.onclick=()=>moveImage(+b.dataset.up,-1));$$('[data-down]').forEach(b=>b.onclick=()=>moveImage(+b.dataset.down,1));$$('[data-remove-image]').forEach(b=>b.onclick=()=>{images.splice(+b.dataset.removeImage,1);images.forEach((x,i)=>x.priority=i+1);renderImages()})}
function moveImage(i,d){const j=i+d;if(j<0||j>=images.length)return;[images[i],images[j]]=[images[j],images[i]];images.forEach((x,k)=>x.priority=k+1);renderImages()}
$('#saveChart').onclick=()=>{const data={format:'RhythmForgeChart',version:1,bpm:+$('#bpm').value,subdivision:+$('#subdivision').value,keyCount:+$('#keyCount').value,offset,notes:notes.map(n=>({time:n.time,lane:n.lane,pos:n.pos})),events,effects,images:images.map(x=>({name:x.name,priority:x.priority}))};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='rhythm-chart.json';a.click();URL.revokeObjectURL(url);toast('채보 JSON을 내보냈습니다.')};
const saved=localStorage.getItem('rf_chart');if(saved){try{const d=JSON.parse(saved);notes=(d.notes||[]).map(n=>({...n,pos:positionFromTime(n.time)}));events=d.events||[];effects=d.effects||[];if(d.bpm)$('#bpm').value=d.bpm;if(d.subdivision)$('#subdivision').value=d.subdivision;if(d.keyCount)$('#keyCount').value=d.keyCount;renderNotes();renderEvents();renderEffects()}catch{}}
// Local developer chart library, gameplay, and rule-based auto chart generation.
let serverCharts=[], gameChart=null, gameAudioUrl=null, autoAudioUrl=null, autoAudioDuration=90, gameAudio=null, gameStartAt=0, gameElapsed=0, gameRunning=false, gameRAF=0, gameChartSource=null, gameHit=new Set(), gameScore=0, gameMiss=0;
function localCharts(){try{return JSON.parse(localStorage.getItem('adoa_developer_charts')||'[]')}catch{return []}}
function persistLocalCharts(arr){localStorage.setItem('adoa_developer_charts',JSON.stringify(arr));}
window.ADOAAddLocalChart=(chart,title,artist,difficulty)=>{if(!chart||!Array.isArray(chart.notes)){alert('먼저 에디터에서 채보를 만들거나 JSON을 선택하세요.');return}const arr=localCharts();const item={id:'local-'+Date.now(),title:(title||'제목 없는 채보').trim(),artist:(artist||'Unknown').trim(),difficulty:difficulty||'Normal',bpm:Number(chart.bpm)||180,keyCount:Number(chart.keyCount)||8,noteCount:chart.notes.length,chart:JSON.parse(JSON.stringify(chart)),source:'local',savedAt:new Date().toISOString()};arr.unshift(item);persistLocalCharts(arr.slice(0,100));window.ADOARefreshGameCharts?.();toast('개발자 채보를 이 브라우저에 저장했습니다.');};
window.ADOASetServerCharts=arr=>{serverCharts=Array.isArray(arr)?arr:[];window.ADOARefreshGameCharts?.()};
function gameCharts(){return [...localCharts(),...serverCharts]}
window.ADOARefreshGameCharts=()=>{const list=$('#gameChartList');if(!list)return;const arr=gameCharts();list.innerHTML='';if(!arr.length){list.innerHTML='<div class="listitem">저장된 채보가 없습니다. 개발자 메뉴에서 채보를 저장하거나 Firebase 공개 채보를 설정하세요.</div>';$('#gameChartStatus').textContent='채보 0개';return}arr.forEach((c,i)=>{const row=document.createElement('div');row.className='listitem';const meta=document.createElement('div');meta.innerHTML=`<strong>${escapeHtml(c.title||'제목 없음')}</strong><div class="muted">${escapeHtml(c.artist||'Unknown')} · ${escapeHtml(c.difficulty||'Normal')} · ${Number(c.bpm)||'?'} BPM · ${Number(c.keyCount)||8}레인 · ${Array.isArray(c.chart?.notes)?c.chart.notes.length:(c.noteCount||0)}개 노트 · ${c.source==='server'?'공개 서버':'이 브라우저'}</div>`;const btn=document.createElement('button');btn.className='primary';btn.textContent='선택';btn.onclick=()=>selectGameChart(c);row.append(meta,btn);list.appendChild(row)});$('#gameChartStatus').textContent=`채보 ${arr.length}개`;};
function selectGameChart(c){gameChart=c.chart||c;gameChartSource=c;$('#gameTitle').textContent=c.title||'선택한 채보';$('#gameStats').textContent=`${gameChart.bpm||180} BPM · ${gameChart.keyCount||8}레인 · ${(gameChart.notes||[]).length}노트`;$('#gameOverlay').classList.remove('hidden');$('#gameOverlay').textContent='▶ 시작 버튼을 누르세요';renderGameLanes();stopGame();if(gameAudio){gameAudio.pause();gameAudio=null}if(c.audioUrl){const src=c.audioUrl;gameAudio=new Audio(src);gameAudio.volume=(Number($('#musicVol')?.value)||100)/100;} }
function renderGameLanes(){const count=Math.max(1,Math.min(8,Number(gameChart?.keyCount)||8));$('#gameLanes').style.gridTemplateColumns=`repeat(${count},minmax(0,1fr))`;$('#gameLanes').innerHTML=Array.from({length:count},(_,i)=>`<div class="game-lane"><span class="game-lane-label" style="left:${(i+.5)/count*100}%">${i+1}</span></div>`).join('');$('#gameTargets').style.gridTemplateColumns=`repeat(${count},minmax(0,1fr))`;$('#gameTargets').innerHTML=Array.from({length:count},()=>'<div class="game-target"></div>').join('')}
function stopGame(){gameRunning=false;cancelAnimationFrame(gameRAF);gameElapsed=0;gameHit=new Set();gameScore=0;gameMiss=0;$('#gameClock').textContent='0.000s';$('#gameSeek').value=0;$('#gameNotes').innerHTML='';$('#gameStats').textContent=`${gameChart?.bpm||180} BPM · ${gameChart?.keyCount||8}레인 · 점수 0 · 미스 0`;}
function startGame(){if(!gameChart){toast('먼저 플레이할 채보를 선택하세요.');return}stopGame();gameRunning=true;gameStartAt=performance.now();$('#gameOverlay').classList.add('hidden');if(gameAudio){try{gameAudio.currentTime=0;gameAudio.play().catch(()=>{})}catch{}}gameRAF=requestAnimationFrame(tickGame)}
function tickGame(){if(!gameRunning||!gameChart)return;let t=gameElapsed+(performance.now()-gameStartAt)/1000;const list=gameChart.notes||[],approach=2.2,judgeY=.80;$('#gameClock').textContent=t.toFixed(3)+'s';$('#gameStats').textContent=`${gameChart.bpm||180} BPM · ${gameChart.keyCount||8}레인 · 점수 ${gameScore} · 미스 ${gameMiss}`;$('#gameSeek').value=t;$('#gameNotes').innerHTML='';const count=Math.max(1,Number(gameChart.keyCount)||8);for(let ni=0;ni<list.length;ni++){const n=list[ni];const dt=Number(n.time)-t;if(gameHit.has(ni)||dt>approach||dt<-.18)continue;const el=document.createElement('div');el.className='game-note';el.style.left=(((Math.max(0,Math.min(count-1,Number(n.lane)||0))+.5)/count)*100)+'%';el.style.top=((judgeY-dt/approach*judgeY)*100)+'%';$('#gameNotes').appendChild(el)}const last=list.reduce((m,n)=>Math.max(m,Number(n.time)||0),0);if(t>last+1.5){gameRunning=false;$('#gameOverlay').classList.remove('hidden');$('#gameOverlay').textContent=`플레이 완료! 점수 ${gameScore} · 미스 ${gameMiss}`;if(gameAudio)gameAudio.pause();return}gameRAF=requestAnimationFrame(tickGame)}
$('#gamePlay').onclick=startGame;$('#gamePause').onclick=()=>{if(gameRunning){gameElapsed+=(performance.now()-gameStartAt)/1000;gameRunning=false;cancelAnimationFrame(gameRAF);if(gameAudio)gameAudio.pause();$('#gameOverlay').classList.remove('hidden');$('#gameOverlay').textContent='일시정지'}else if(gameChart){gameRunning=true;gameStartAt=performance.now();$('#gameOverlay').classList.add('hidden');if(gameAudio){try{gameAudio.currentTime=gameElapsed;gameAudio.play().catch(()=>{})}catch{}}gameRAF=requestAnimationFrame(tickGame)}};$('#gameRestart').onclick=startGame;$('#refreshGameCharts').onclick=()=>{window.ADOARefreshGameCharts();if(window.ADOARefreshCloudCharts)window.ADOARefreshCloudCharts()};$('#gameSeek').oninput=e=>{gameElapsed=Number(e.target.value)||0;if(gameChart){gameStartAt=performance.now();if(gameRunning)tickGame()}};
window.addEventListener('keydown',e=>{if(!gameRunning||!gameChart||e.repeat||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;const count=Math.max(1,Number(gameChart.keyCount)||8),mapping=keys[count]||keys[8];const lane=mapping.findIndex(k=>String(k).toUpperCase()===e.key.toUpperCase());if(lane<0)return;const t=gameElapsed+(performance.now()-gameStartAt)/1000,list=gameChart.notes||[];let best=-1,bestDiff=.18;for(let i=0;i<list.length;i++){if(gameHit.has(i)||Number(list[i].lane)!==lane)continue;const diff=Math.abs(Number(list[i].time)-t);if(diff<bestDiff){best=i;bestDiff=diff}}if(best>=0){gameHit.add(best);gameScore+=bestDiff<.06?300:bestDiff<.12?150:50}else{gameMiss++;}$('#gameStats').textContent=`${gameChart.bpm||180} BPM · ${count}레인 · 점수 ${gameScore} · 미스 ${gameMiss}`;});
let autoChart=null;
$('#autoAudioFile').onchange=e=>{const f=e.target.files?.[0];if(!f)return;if(autoAudioUrl)URL.revokeObjectURL(autoAudioUrl);autoAudioUrl=URL.createObjectURL(f);const a=new Audio(autoAudioUrl);a.onloadedmetadata=()=>{autoAudioDuration=Number.isFinite(a.duration)?a.duration:90;$('#autoAudioName').textContent=f.name+' · '+autoAudioDuration.toFixed(1)+'초';$('#autoStatus').textContent='음악 길이를 읽었습니다. BPM/박자를 설정하고 자동 채보를 생성하세요.'};a.onerror=()=>{$('#autoAudioName').textContent=f.name+' · 길이 확인 불가';};};
$('#generateAutoChart').onclick=()=>{const bpm=Math.max(30,Math.min(400,Number($('#autoBpm').value)||180)),meter=Number($('#autoMeter').value)||4,sub=Number($('#autoSubdivision').value)||4,lanes=Number($('#autoLanes').value)||8,density=Number($('#autoDensity').value)||2,duration=autoAudioUrl?autoAudioDuration:90,step=60/bpm/sub,notes=[];let prev=-1;for(let t=0,idx=0;t<duration;t+=step,idx++){const beatIndex=Math.round(t/step);const strong=beatIndex%(sub*meter)===0;const allow=(density===4)||(density===3?idx%2===0:density===2?(idx%2===0||strong):strong);if(!allow)continue;let lane;if(strong)lane=(Math.floor(beatIndex/(sub*meter))*3+Math.floor(beatIndex/sub))%lanes;else lane=(beatIndex*7+Math.floor(beatIndex/3)+1)%lanes;if(lane===prev)lane=(lane+1+(beatIndex%Math.max(1,lanes-1)))%lanes;notes.push({time:Number(t.toFixed(4)),lane,pos:Math.min(1,t/(step*64)),id:Date.now()+idx});prev=lane;}autoChart={format:'RhythmForgeChart',version:1,bpm,subdivision:sub,keyCount:lanes,offset,notes,events:[],effects:[],images:[],title:$('#autoTitle').value.trim()||'자동 생성 채보',artist:$('#autoArtist').value.trim()||'Unknown',difficulty:['','Easy','Normal','Hard','Expert'][density]};gameAudioUrl=autoAudioUrl;$('#autoStatus').textContent=`완료: ${notes.length}개 노트 · ${bpm} BPM · ${meter}${meter===6?'/8':'/4'} 박자 설정 · ${duration.toFixed(1)}초`;toast('자동 채보를 생성했습니다.');};
$('#previewAutoChart').onclick=()=>{if(!autoChart){toast('먼저 자동 채보를 생성하세요.');return}const c={...autoChart,audioUrl:autoAudioUrl,source:'generated'};selectGameChart(c);show('game');};
$('#editAutoChart').onclick=()=>{if(!autoChart){toast('먼저 자동 채보를 생성하세요.');return}loadChartIntoEditor(autoChart);show('editor');};
$('#saveAutoChart').onclick=()=>{if(!autoChart){toast('먼저 자동 채보를 생성하세요.');return}const blob=new Blob([JSON.stringify(autoChart,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='adoa-auto-chart.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
function loadChartIntoEditor(d){notes=(d.notes||[]).map(n=>({...n,id:Date.now()+Math.random(),pos:positionFromTime(n.time)}));events=d.events||[];effects=d.effects||[];images=d.images||[];$('#bpm').value=d.bpm||180;$('#subdivision').value=d.subdivision||4;$('#keyCount').value=d.keyCount||8;selected=null;buildGuides();renderEvents();renderEffects();renderImages();localStorage.setItem('rf_chart',JSON.stringify({notes,events,effects,bpm:$('#bpm').value,subdivision:$('#subdivision').value,keyCount:$('#keyCount').value}));if(autoAudioUrl){if(audio)audio.pause();audioUrl=autoAudioUrl;audio=new Audio(audioUrl);audio.onloadedmetadata=()=>{duration=audio.duration;$('#duration').textContent=duration.toFixed(3)+'s';$('#seek').max=duration};}toast('채보를 에디터로 가져왔습니다.')}
window.ADOARefreshGameCharts();

// Firebase module connects here to load public charts into gameplay too.
// Firebase 모듈에서 기존 에디터 데이터를 안전하게 읽고 불러올 수 있도록 연결합니다.
window.ADOAChartBridge={
 getCurrentChart(){return {format:'RhythmForgeChart',version:1,bpm:+$('#bpm').value,subdivision:+$('#subdivision').value,keyCount:+$('#keyCount').value,offset,notes:notes.map(n=>({time:n.time,lane:n.lane,pos:n.pos})),events:structuredClone(events),effects:structuredClone(effects),images:images.map(x=>({name:x.name,priority:x.priority}))}},
 loadChart(d){if(!d||!Array.isArray(d.notes))throw new Error('올바른 채보 데이터가 아닙니다.');notes=d.notes.map(n=>({time:Number(n.time)||0,lane:Number(n.lane)||0,pos:positionFromTime(Number(n.time)||0),id:Date.now()+Math.random()}));events=Array.isArray(d.events)?d.events:[];effects=Array.isArray(d.effects)?d.effects:[];images=Array.isArray(d.images)?d.images:[];if(d.bpm)$('#bpm').value=d.bpm;if(d.subdivision)$('#subdivision').value=d.subdivision;if(d.keyCount)$('#keyCount').value=d.keyCount;if(typeof d.offset==='number'){offset=d.offset;updateOffset()}selected=null;renderNotes();renderEvents();renderEffects();renderImages();buildGuides();localStorage.setItem('rf_chart',JSON.stringify(this.getCurrentChart()));show('editor');toast('채보를 에디터에 불러왔습니다.');}
};
// ===== A Dance Of Arrow 안정화 패치 =====
// 이 블록은 메인 <script> 안에서 window.ADOAChartBridge 정의 뒤,
// IIFE를 닫는 })(); 바로 앞에 붙여 넣으세요.
let gameMissed = new Set();

// 게임 시작/정지 시 미스 기록도 초기화합니다.
const originalStopGame = stopGame;
stopGame = function(){
  originalStopGame();
  gameMissed = new Set();
};

// 노트가 판정선을 지나면 미스를 정확히 한 번만 집계합니다.
tickGame = function(){
  if(!gameRunning || !gameChart) return;
  const t = gameElapsed + (performance.now() - gameStartAt) / 1000;
  const list = Array.isArray(gameChart.notes) ? gameChart.notes : [];
  const approach = 2.2;
  const judgeY = 0.80;
  const count = Math.max(1, Math.min(8, Number(gameChart.keyCount) || 8));

  $('#gameClock').textContent = t.toFixed(3) + 's';
  $('#gameStats').textContent = `${gameChart.bpm || 180} BPM · ${count}레인 · 점수 ${gameScore} · 미스 ${gameMiss}`;
  $('#gameSeek').max = Math.max(1, list.reduce((m,n)=>Math.max(m,Number(n.time)||0),0) + 2);
  $('#gameSeek').value = t;
  $('#gameNotes').innerHTML = '';

  for(let i=0; i<list.length; i++){
    const n = list[i];
    const noteTime = Math.max(0, Number(n.time) || 0);
    const dt = noteTime - t;
    if(gameHit.has(i) || gameMissed.has(i)) continue;
    if(dt < -0.18){ gameMissed.add(i); gameMiss++; continue; }
    if(dt > approach) continue;
    const el = document.createElement('div');
    el.className = 'game-note';
    const lane = Math.max(0, Math.min(count-1, Number(n.lane)||0));
    el.style.left = (((lane + 0.5) / count) * 100) + '%';
    el.style.top = ((judgeY - (dt / approach) * judgeY) * 100) + '%';
    $('#gameNotes').appendChild(el);
  }

  const last = list.reduce((m,n)=>Math.max(m,Number(n.time)||0),0);
  if(t > last + 1.5){
    gameRunning = false;
    $('#gameOverlay').classList.remove('hidden');
    $('#gameOverlay').textContent = `플레이 완료! 점수 ${gameScore} · 미스 ${gameMiss}`;
    if(gameAudio) gameAudio.pause();
    return;
  }
  gameRAF = requestAnimationFrame(tickGame);
};

// 시작 버튼은 새 게임의 점수/미스/노트 상태를 함께 초기화합니다.
startGame = function(){
  if(!gameChart){ toast('먼저 플레이할 채보를 선택하세요.'); return; }
  stopGame();
  gameMissed = new Set();
  gameRunning = true;
  gameStartAt = performance.now();
  $('#gameOverlay').classList.add('hidden');
  if(gameAudio){
    try{ gameAudio.currentTime = 0; gameAudio.play().catch(()=>{}); }
    catch(err){ console.warn('오디오 재생 실패:', err); }
  }
  gameRAF = requestAnimationFrame(tickGame);
};

// 게임 입력 판정은 파일 끝의 통합 판정 시스템에서 처리합니다.

// 자동 채보: 박자 단위와 마디 단위를 구분해 패턴을 만듭니다.
$('#generateAutoChart').onclick = function(){
  const bpm = Math.max(30, Math.min(400, Number($('#autoBpm').value)||180));
  const meter = Number($('#autoMeter').value)||4;
  const sub = Number($('#autoSubdivision').value)||4;
  const lanes = Math.max(4, Math.min(8, Number($('#autoLanes').value)||8));
  const density = Number($('#autoDensity').value)||2;
  const duration = autoAudioUrl ? autoAudioDuration : 90;
  const step = 60 / bpm / sub;
  const notes = [];
  let previousLane = -1;
  const totalSteps = Math.ceil(duration / step);
  for(let idx=0; idx<totalSteps; idx++){
    const beatInBar = Math.floor(idx / sub) % meter;
    const isBeat = idx % sub === 0;
    const isDownbeat = idx % (sub * meter) === 0;
    let allow = false;
    if(density === 1) allow = isDownbeat || (isBeat && beatInBar === 2);
    else if(density === 2) allow = isBeat || (idx % sub === Math.floor(sub/2));
    else if(density === 3) allow = isBeat || idx % 2 === 0;
    else allow = true;
    if(!allow) continue;

    let lane;
    if(isDownbeat) lane = Math.floor(idx/(sub*meter)) % lanes;
    else lane = (idx * 3 + Math.floor(idx/sub) * 2 + 1) % lanes;
    if(lane === previousLane) lane = (lane + 1) % lanes;
    const time = idx * step;
    notes.push({time:Number(time.toFixed(4)), lane, pos:Math.min(1,time/duration), id:Date.now()+idx});
    previousLane = lane;
  }
  autoChart = {
    format:'RhythmForgeChart', version:1, bpm, subdivision:sub, meter,
    keyCount:lanes, offset, notes, events:[], effects:[], images:[],
    title:$('#autoTitle').value.trim() || '자동 생성 채보',
    artist:$('#autoArtist').value.trim() || 'Unknown',
    difficulty:['','Easy','Normal','Hard','Expert'][density]
  };
  $('#autoStatus').textContent = `완료: ${notes.length}개 노트 · ${bpm} BPM · ${meter}/${meter===6?8:4} 박자 · ${duration.toFixed(1)}초. 참고: 음악 파형을 AI 분석한 것이 아니라 설정한 박자에 따른 자동 생성입니다.`;
  toast('자동 채보를 생성했습니다.');
};

// 에디터로 가져올 때는 기존 오디오를 정리하고 노트/레인 UI를 함께 다시 그립니다.
const originalLoadChartIntoEditor = loadChartIntoEditor;
loadChartIntoEditor = function(d){
  originalLoadChartIntoEditor(d);
  selected = null;
  buildGuides();
  renderNotes();
};
// ===== 프로젝트 관리 / 다시 실행 / 레일 폭 노트 패치 =====
let redoStack = [];
let currentProjectId = null;
let currentProjectName = '';
let editorDirty = false;
let projectChooserPending = false;
const projectStoreKey = 'adoa_editor_projects_v1';
function chartSnapshot(){
  return {format:'RhythmForgeChart',version:2,bpm:+$('#bpm').value||180,subdivision:+$('#subdivision').value||4,keyCount:+$('#keyCount').value||8,offset:Number($('#editorOffsetMs')?.value??offset)||0,duration:Math.max(1,Number($('#chartDurationInput')?.value)||90),speed:Math.max(.5,Math.min(10,Number($('#gameSpeed')?.value)||1)),settings:{gameSpeed:Math.max(.5,Math.min(10,Number($('#gameSpeed')?.value)||1)),chartDuration:Math.max(1,Number($('#chartDurationInput')?.value)||90),editorOffsetMs:Number($('#editorOffsetMs')?.value??offset)||0,snap:!!$('#snap')?.checked,autosave:!!$('#autosave')?.checked,tips:!!$('#tips')?.checked,guidesVisible:window.adoaGuidesVisible!==false},notes:notes.map(n=>({time:Number(n.time)||0,lane:Number(n.lane)||0,id:n.id,pos:n.pos,speed:Number(n.speed)||Math.max(.5,Math.min(10,Number($('#gameSpeed')?.value)||1))})),events:JSON.parse(JSON.stringify(events||[])),effects:JSON.parse(JSON.stringify(effects||[])),images:(images||[]).map(x=>({name:x.name,priority:x.priority}))};
}
function readProjects(){try{const a=JSON.parse(localStorage.getItem(projectStoreKey)||'[]');if(Array.isArray(a)&&a.length)return a;const legacy=localStorage.getItem('rf_chart');if(legacy){const d=JSON.parse(legacy);if(Array.isArray(d.notes))return [{id:'legacy-rf-chart',name:'이전 자동 저장 프로젝트',chart:d,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),legacy:true}]}return Array.isArray(a)?a:[]}catch{return []}}
function writeProjects(a){localStorage.setItem(projectStoreKey,JSON.stringify(a))}
function setProjectDirty(){editorDirty=true;}
const oldPushUndo=pushUndo;
pushUndo=function(){oldPushUndo();redoStack=[];setProjectDirty();updateUndoRedoButtons()};
function updateUndoRedoButtons(){const u=$('#undo'),r=$('#redo');if(u)u.disabled=!undoStack.length;if(r)r.disabled=!redoStack.length}
function restoreSnapshot(raw){const d=typeof raw==='string'?JSON.parse(raw):raw;notes=(d.notes||[]).map(n=>({...n,time:Number(n.time)||0,lane:Number(n.lane)||0,id:n.id??(Date.now()+Math.random()),pos:positionFromTime(n.time),speed:Number(n.speed)||Number(d.settings?.gameSpeed)||Number(d.speed)||1}));events=JSON.parse(JSON.stringify(d.events||[]));effects=JSON.parse(JSON.stringify(d.effects||[]));images=(d.images||[]).map(x=>({...x}));if(d.bpm)$('#bpm').value=d.bpm;if(d.subdivision)$('#subdivision').value=d.subdivision;if(d.keyCount)$('#keyCount').value=d.keyCount;if(typeof d.offset==='number'){offset=d.offset;updateOffset();if($('#editorOffsetMs'))$('#editorOffsetMs').value=String(d.offset)}const st=d.settings||{};if(st.gameSpeed!=null&&$('#gameSpeed'))$('#gameSpeed').value=String(Math.max(.5,Math.min(10,Number(st.gameSpeed)||1)));if(st.chartDuration!=null&&$('#chartDurationInput'))$('#chartDurationInput').value=String(st.chartDuration);if(st.snap!=null&&$('#snap'))$('#snap').checked=!!st.snap;if(st.autosave!=null&&$('#autosave'))$('#autosave').checked=!!st.autosave;if(st.tips!=null&&$('#tips'))$('#tips').checked=!!st.tips;if(st.guidesVisible!=null)window.adoaGuidesVisible=!!st.guidesVisible;if($('#noteLane'))$('#noteLane').innerHTML=Array.from({length:editorLaneCount()},(_,i)=>`<option value="${i}">${i+1}번 레인</option>`).join('');selected=null;buildGuides();renderNotes();renderEvents();renderEffects();renderImages();editorDirty=false;undoStack=[];redoStack=[];updateUndoRedoButtons()}
function showProjectModal(title,body,actions){let m=$('#projectModal');if(!m){m=document.createElement('div');m.id='projectModal';m.className='project-modal-back';m.innerHTML='<div class="project-modal" role="dialog" aria-modal="true"><div id="projectModalContent"></div></div>';document.body.appendChild(m)}$('#projectModalContent').innerHTML=`<h2>${title}</h2>${body}<div class="project-actions" id="projectModalActions"></div>`;const box=$('#projectModalActions');actions.forEach(a=>{const b=document.createElement('button');b.textContent=a.label;if(a.primary)b.className='primary';b.onclick=()=>a.run();box.appendChild(b)});m.classList.remove('hidden');return m}
function closeProjectModal(){const m=$('#projectModal');if(m)m.classList.add('hidden')}
function beginNewProject(){closeProjectModal();currentProjectId=null;currentProjectName='새 프로젝트';notes=[];events=[];effects=[];images=[];selected=null;$('#bpm').value=180;$('#subdivision').value=4;$('#keyCount').value=8;$('#noteLane').innerHTML=Array.from({length:8},(_,i)=>`<option value="${i}">${i+1}번 레인</option>`).join('');undoStack=[];redoStack=[];editorDirty=false;buildGuides();renderNotes();renderEvents();renderEffects();renderImages();showOriginal('editor');}
function openProject(id){const item=readProjects().find(p=>p.id===id);if(!item)return;closeProjectModal();currentProjectId=item.id;currentProjectName=item.name;restoreSnapshot(item.chart);showOriginal('editor');toast('프로젝트를 열었습니다: '+item.name)}
function showEditorChooser(){const projects=readProjects();let body='<p>이전에 저장한 프로젝트를 열거나 새 프로젝트를 만들 수 있어요. 저장하지 않은 작업은 목록에 나타나지 않습니다.</p><div class="project-list">';if(projects.length){body+=projects.map(p=>`<div class="project-row"><div class="meta"><strong>${escapeHtml(p.name||'이름 없는 프로젝트')}</strong><div class="muted">${new Date(p.updatedAt||p.createdAt||Date.now()).toLocaleString()} · ${(p.chart?.notes||[]).length}개 노트</div></div><button data-open-project="${p.id}">열기</button></div>`).join('')}else body+='<div class="muted">저장된 프로젝트가 없습니다. 새 프로젝트를 만들어 시작하세요.</div>';body+='</div>';
 showProjectModal('에디터 프로젝트 선택',body,[{label:'＋ 새 프로젝트',primary:true,run:beginNewProject},{label:'취소',run:closeProjectModal}]);$$('[data-open-project]').forEach(b=>b.onclick=()=>openProject(b.dataset.openProject));}
function saveCurrentProject(){const projects=readProjects();let name=currentProjectName&&currentProjectName!=='새 프로젝트'?currentProjectName:'';if(!name){showProjectModal('프로젝트 저장','<p>프로젝트 이름을 입력하세요. 저장을 눌러야 브라우저에 보관됩니다.</p><input id="projectNameInput" maxlength="80" placeholder="예: Hello2026 Expert 채보">',[{label:'저장',primary:true,run:()=>{const v=$('#projectNameInput').value.trim();if(!v){toast('프로젝트 이름을 입력해 주세요.');return}commitProjectSave(v)}},{label:'취소',run:closeProjectModal}]);return}commitProjectSave(name)}
function commitProjectSave(name){let projects=readProjects();const id=(currentProjectId&&currentProjectId!=='legacy-rf-chart')?currentProjectId:('project-'+Date.now()+'-'+Math.random().toString(36).slice(2,7));const old=projects.find(p=>p.id===currentProjectId||p.id===id);const item={id,name,chart:chartSnapshot(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};projects=projects.filter(p=>p.id!==id&&p.id!=='legacy-rf-chart');projects.unshift(item);writeProjects(projects.slice(0,100));currentProjectId=id;currentProjectName=name;editorDirty=false;closeProjectModal();toast('프로젝트를 저장했습니다.');}
function leaveEditor(){if(!editorDirty){closeProjectModal();showOriginal('menu');return}showProjectModal('에디터 나가기','<p>변경한 내용이 아직 저장되지 않았어요. 어떻게 할까요?</p>',[{label:'저장하고 나가기',primary:true,run:()=>{if(!currentProjectId||!currentProjectName||currentProjectName==='새 프로젝트'){showProjectModal('프로젝트 저장','<p>프로젝트 이름을 입력하세요.</p><input id="projectNameInput" maxlength="80" placeholder="프로젝트 이름">',[{label:'저장 후 나가기',primary:true,run:()=>{const v=$('#projectNameInput').value.trim();if(!v){toast('프로젝트 이름을 입력해 주세요.');return}commitProjectSave(v);showOriginal('menu')}},{label:'취소',run:showEditorChooser}]);}else{commitProjectSave(currentProjectName);showOriginal('menu')}}},{label:'저장하지 않고 나가기',run:()=>{closeProjectModal();showOriginal('menu')}},{label:'계속 편집',run:closeProjectModal}]);}
const showOriginal=show;
show=function(id){if(id==='editor'&&!projectChooserPending){projectChooserPending=true;showEditorChooser();return}showOriginal(id);if(id==='editor'){projectChooserPending=false;requestAnimationFrame(()=>{buildGuides();renderNotes()})}};
// Internal imports should go directly to the editor, not show the project chooser twice.
const oldLoadBridge=window.ADOAChartBridge;
if(oldLoadBridge&&oldLoadBridge.loadChart){const oldLoad=oldLoadBridge.loadChart;oldLoadBridge.loadChart=function(d){oldLoad(d);currentProjectId=null;currentProjectName='가져온 채보';editorDirty=true;showOriginal('editor');projectChooserPending=false;}}
$$('[data-screen="editor"]').forEach(b=>b.onclick=showEditorChooser);
const editorBack=$('#editor .back');if(editorBack)editorBack.onclick=leaveEditor;
$('#saveProject').onclick=saveCurrentProject;
$('#undo').onclick=()=>{if(!undoStack.length){toast('실행 취소할 작업이 없습니다.');return}redoStack.push(JSON.stringify({notes,events,effects}));const d=JSON.parse(undoStack.pop());notes=d.notes;events=d.events;effects=d.effects;selected=null;renderNotes();renderEvents();renderEffects();setProjectDirty();updateUndoRedoButtons()};
$('#redo').onclick=()=>{if(!redoStack.length){toast('다시 실행할 작업이 없습니다.');return}undoStack.push(JSON.stringify({notes,events,effects}));const d=JSON.parse(redoStack.pop());notes=d.notes;events=d.events;effects=d.effects;selected=null;renderNotes();renderEvents();renderEffects();setProjectDirty();updateUndoRedoButtons()};
// Track edits not routed through pushUndo as well.
const oldAddNote=addNote;addNote=function(n){oldAddNote(n);setProjectDirty();updateUndoRedoButtons()};
const oldRenderNotes=renderNotes;renderNotes=function(){noteLayer.style.setProperty('--lane-count',editorLaneCount());oldRenderNotes();};
$('#bpm').addEventListener('change',setProjectDirty);$('#subdivision').addEventListener('change',setProjectDirty);$('#keyCount').addEventListener('change',()=>{setProjectDirty();noteLayer.style.setProperty('--lane-count',editorLaneCount())});
$('#noteTime').addEventListener('change',setProjectDirty);$('#noteLane').addEventListener('change',setProjectDirty);
$('#audioFile').addEventListener('change',()=>{setProjectDirty()});
// Keep automatic save off by default: project saving is explicit via the Save Project button.
$('#autosave').checked=false;
updateUndoRedoButtons();
// ===== 추가 개선: 프로젝트 삭제 확인 + 음원 파일 보존 + 레일 폭 판정 노트 =====
// 오디오 파일은 localStorage가 아닌 IndexedDB에 Blob으로 보관합니다.
let activeAudioFile = null;
let activeAudioName = '';
const audioDbName = 'adoa_project_audio_db_v1';
function openAudioDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(audioDbName,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('audio'))db.createObjectStore('audio')};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function putProjectAudio(id,blob,name){const db=await openAudioDB();return new Promise((resolve,reject)=>{const tx=db.transaction('audio','readwrite');tx.objectStore('audio').put({blob,name:name||'audio'},id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
async function getProjectAudio(id){const db=await openAudioDB();return new Promise((resolve,reject)=>{const tx=db.transaction('audio','readonly');const req=tx.objectStore('audio').get(id);req.onsuccess=()=>{const v=req.result;db.close();resolve(v||null)};req.onerror=()=>{db.close();reject(req.error)}})}
async function deleteProjectAudio(id){try{const db=await openAudioDB();await new Promise((resolve,reject)=>{const tx=db.transaction('audio','readwrite');tx.objectStore('audio').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}catch(e){console.warn('음원 삭제 실패',e)}}
function setEditorAudio(blob,name){
  if(!blob)return;
  try{if(audio){audio.pause();if(audioUrl)URL.revokeObjectURL(audioUrl)}}catch{}
  activeAudioFile=blob;activeAudioName=name||'저장된 음원';audioUrl=URL.createObjectURL(blob);audio=new Audio(audioUrl);
  audio.onloadedmetadata=()=>{duration=audio.duration;$('#duration').textContent=duration.toFixed(3)+'s · '+activeAudioName;$('#seek').max=duration;toast('음원 파일을 불러왔습니다.')};
  audio.ontimeupdate=()=>{$('#now').textContent=audio.currentTime.toFixed(3)+'s';$('#seek').value=audio.currentTime};
  audio.volume=$('#musicVol').value/100;
}
// File selection: keep the actual file in memory until the user explicitly saves the project.
$('#audioFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(f){activeAudioFile=f;activeAudioName=f.name;setProjectDirty()}});
// Rebuild the project chooser with a separately-confirmed delete action.
showEditorChooser=function(){
 const projects=readProjects();let body='<p>저장된 프로젝트를 열거나 새 프로젝트를 만들 수 있어요. 프로젝트 삭제는 복구할 수 없으니 주의하세요.</p><div class="project-list">';
 if(projects.length){body+=projects.map(p=>`<div class="project-row"><div class="meta"><strong>${escapeHtml(p.name||'이름 없는 프로젝트')}</strong><div class="muted">${new Date(p.updatedAt||p.createdAt||Date.now()).toLocaleString()} · ${(p.chart?.notes||[]).length}개 노트${p.audioName?' · 음원 포함':''}</div></div><div class="project-row-actions"><button data-open-project="${escapeHtml(p.id)}">열기</button><button data-delete-project="${escapeHtml(p.id)}" class="danger-button">삭제</button></div></div>`).join('')}
 else body+='<div class="muted">저장된 프로젝트가 없습니다. 새 프로젝트를 만들어 시작하세요.</div>';
 body+='</div>';showProjectModal('에디터 프로젝트 선택',body,[{label:'＋ 새 프로젝트',primary:true,run:beginNewProject},{label:'취소',run:closeProjectModal}]);
 $$('[data-open-project]').forEach(b=>b.onclick=()=>openProject(b.dataset.openProject));
 $$('[data-delete-project]').forEach(b=>b.onclick=()=>confirmDeleteProject(b.dataset.deleteProject));
};
function confirmDeleteProject(id){const item=readProjects().find(p=>p.id===id);if(!item)return;showProjectModal('프로젝트를 삭제할까요?',`<p><strong>${escapeHtml(item.name||'이름 없는 프로젝트')}</strong>를 정말 삭제할까요?</p><p class="muted">채보와 저장된 음원 파일이 모두 삭제되며, 이 작업은 되돌릴 수 없습니다.</p>`,[{label:'아니요, 취소',run:showEditorChooser},{label:'네, 영구 삭제',primary:true,run:async()=>{const all=readProjects().filter(p=>p.id!==id);writeProjects(all);await deleteProjectAudio(id);if(currentProjectId===id){currentProjectId=null;currentProjectName='';editorDirty=false}toast('프로젝트와 저장된 음원을 삭제했습니다.');showEditorChooser()}}])}
// Save both chart and selected audio. If no new file was selected, keep an existing saved audio.
commitProjectSave=async function(name){
 let projects=readProjects();const id=(currentProjectId&&currentProjectId!=='legacy-rf-chart')?currentProjectId:('project-'+Date.now()+'-'+Math.random().toString(36).slice(2,7));const old=projects.find(p=>p.id===currentProjectId||p.id===id);let audioName=activeAudioName||old?.audioName||'';
 try{if(activeAudioFile)await putProjectAudio(id,activeAudioFile,audioName)}catch(e){console.error(e);toast('음원 저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.');return}
 const item={id,name,chart:chartSnapshot(),audioName:audioName||'',hasAudio:!!(activeAudioFile||old?.hasAudio),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 projects=projects.filter(p=>p.id!==id&&p.id!=='legacy-rf-chart');projects.unshift(item);try{writeProjects(projects.slice(0,100))}catch(e){toast('프로젝트 저장 공간이 부족합니다.');return}
 currentProjectId=id;currentProjectName=name;editorDirty=false;closeProjectModal();toast(item.hasAudio?'프로젝트와 음원을 저장했습니다.':'프로젝트를 저장했습니다.');
};
openProject=async function(id){const item=readProjects().find(p=>p.id===id);if(!item)return;closeProjectModal();currentProjectId=item.id;currentProjectName=item.name;restoreSnapshot(item.chart);activeAudioFile=null;activeAudioName=item.audioName||'';try{const saved=await getProjectAudio(item.id);if(saved?.blob){setEditorAudio(saved.blob,saved.name||item.audioName);activeAudioFile=null;activeAudioName=saved.name||item.audioName||''}else{audio=null;activeAudioFile=null;$('#duration').textContent='음원 파일 없음 — 다시 불러오세요'}}catch(e){console.warn(e);toast('저장된 음원을 불러오지 못했습니다.')}showOriginal('editor');toast('프로젝트를 열었습니다: '+item.name)};
// Ensure save-before-exit waits for IndexedDB to finish.
leaveEditor=function(){if(!editorDirty){closeProjectModal();showOriginal('menu');return}showProjectModal('에디터 나가기','<p>변경한 내용이 아직 저장되지 않았어요. 어떻게 할까요?</p>',[
 {label:'저장하고 나가기',primary:true,run:async()=>{if(!currentProjectId||!currentProjectName||currentProjectName==='새 프로젝트'){showProjectModal('프로젝트 저장','<p>프로젝트 이름을 입력하세요.</p><input id="projectNameInput" maxlength="80" placeholder="프로젝트 이름">',[{label:'저장 후 나가기',primary:true,run:async()=>{const v=$('#projectNameInput').value.trim();if(!v){toast('프로젝트 이름을 입력해 주세요.');return}await commitProjectSave(v);if(!editorDirty)showOriginal('menu')}},{label:'취소',run:closeProjectModal}])}else{await commitProjectSave(currentProjectName);if(!editorDirty)showOriginal('menu')}}},
 {label:'저장하지 않고 나가기',run:()=>{closeProjectModal();showOriginal('menu')}},{label:'계속 편집',run:closeProjectModal}
])};
// Replace the old save handler so asynchronous audio saving is respected.
$('#saveProject').onclick=saveCurrentProject;
// Notes and receptor squares nearly fill each lane; keep them centered on the judgment line.
const laneFillStyle=document.createElement('style');laneFillStyle.textContent=`
.project-row-actions{display:flex;gap:6px;flex-shrink:0}.danger-button{border-color:#8d3944!important;color:#ffb8c0!important}.danger-button:hover{background:#47202a!important}
.editor-targets{top:80%!important;bottom:auto!important;transform:translateY(-50%)!important}
.editor-target{width:calc(100% - 8px)!important;height:auto!important;aspect-ratio:1;justify-self:center;align-self:center}
.note{width:calc((100% / var(--lane-count, 8)) - 8px)!important;height:auto!important;aspect-ratio:1;line-height:1!important;border-radius:4px!important}
.game-targets{top:80%!important;bottom:auto!important;transform:translateY(-50%)!important}
.game-target{width:calc(100% / 8 - 8px)!important;height:auto!important;aspect-ratio:1;transform:translateY(0)}
`;
document.head.appendChild(laneFillStyle);
// Make lane width calculation available to note CSS and update target size when lane count changes.
noteLayer.style.setProperty('--lane-count',editorLaneCount());
const oldBuildGuidesForAudio=buildGuides;buildGuides=function(){oldBuildGuidesForAudio();noteLayer.style.setProperty('--lane-count',editorLaneCount())};
// ===== 추가 개선 끝 =====

// ===== Stability repair v2: gameplay, project rename/delete, audio filename =====
// Make project storage authoritative, so a deleted legacy autosave cannot reappear.
readProjects = function(){
  try {
    const raw = localStorage.getItem(projectStoreKey);
    if (raw !== null) { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; }
    const legacy = localStorage.getItem('rf_chart');
    if (legacy) { const d = JSON.parse(legacy); if (Array.isArray(d.notes)) return [{id:'legacy-rf-chart',name:'이전 자동 저장 프로젝트',chart:d,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),legacy:true}]; }
    return [];
  } catch (e) { console.warn('프로젝트 목록을 읽지 못했습니다.',e); return []; }
};

// Add a visible filename label next to the audio chooser.
let audioNameLabel = document.getElementById('audioFileName');
if (!audioNameLabel) {
  audioNameLabel = document.createElement('span');
  audioNameLabel.id = 'audioFileName';
  audioNameLabel.className = 'muted';
  audioNameLabel.style.cssText = 'max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle';
  const chooser = document.querySelector('#audioFile')?.closest('.filebutton');
  if (chooser) chooser.insertAdjacentElement('afterend', audioNameLabel);
}
function showAudioFilename(name) {
  if (audioNameLabel) audioNameLabel.textContent = name ? `음원: ${name}` : '음원 파일 없음';
  const durationLabel = document.getElementById('duration');
  if (durationLabel && name) durationLabel.textContent = `${durationLabel.textContent.split(' · ')[0]} · ${name}`;
}
showAudioFilename(activeAudioName || '');
const priorSetEditorAudioV2 = setEditorAudio;
setEditorAudio = function(blob,name){
  if (!blob) return;
  priorSetEditorAudioV2(blob,name);
  activeAudioName = name || activeAudioName || '저장된 음원';
  showAudioFilename(activeAudioName);
};
document.getElementById('audioFile')?.addEventListener('change', e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  activeAudioFile = file;
  activeAudioName = file.name;
  showAudioFilename(file.name);
  setProjectDirty();
});

// Rename currently opened project from the editor toolbar.
const editorToolbar = document.querySelector('#saveProject')?.parentElement;
if (editorToolbar && !document.getElementById('renameProject')) {
  const renameButton = document.createElement('button');
  renameButton.id = 'renameProject';
  renameButton.textContent = '이름 변경';
  document.getElementById('saveProject').insertAdjacentElement('afterend', renameButton);
  renameButton.addEventListener('click', () => {
    const current = currentProjectName && currentProjectName !== '새 프로젝트' ? currentProjectName : '';
    showProjectModal('프로젝트 이름 변경', `<p>현재 프로젝트의 새 이름을 입력하세요.</p><input id="renameProjectInput" maxlength="80" placeholder="프로젝트 이름" value="${escapeHtml(current)}">`, [
      {label:'취소',run:closeProjectModal},
      {label:'이름 변경',primary:true,run:()=>{
        const value = document.getElementById('renameProjectInput')?.value.trim();
        if (!value) { toast('프로젝트 이름을 입력해 주세요.'); return; }
        if (!currentProjectId) { currentProjectName = value; editorDirty = true; closeProjectModal(); toast('이름을 설정했어요. 프로젝트 저장을 눌러 보관하세요.'); return; }
        const list = readProjects(); const item = list.find(p=>p.id===currentProjectId);
        if (!item) { toast('저장된 프로젝트를 찾을 수 없습니다.'); return; }
        item.name = value; item.updatedAt = new Date().toISOString();
        try { writeProjects(list); currentProjectName=value; closeProjectModal(); toast('프로젝트 이름을 변경했습니다.'); }
        catch(err) { console.error(err); toast('이름 변경에 실패했습니다.'); }
      }}
    ]);
  });
}

// Project list includes rename and delete controls; deletion removes the chart AND audio blob.
showEditorChooser = function(){
  const projects = readProjects();
  let body = '<p>저장된 프로젝트를 열거나 새 프로젝트를 만들 수 있어요. 삭제는 복구할 수 없습니다.</p><div class="project-list">';
  if (projects.length) {
    body += projects.map(p => `<div class="project-row"><div class="meta"><strong>${escapeHtml(p.name||'이름 없는 프로젝트')}</strong><div class="muted">${new Date(p.updatedAt||p.createdAt||Date.now()).toLocaleString()} · ${(p.chart?.notes||[]).length}개 노트${(p.audioName||p.hasAudio)?' · 음원 포함':''}</div></div><div class="project-row-actions"><button data-open-project="${escapeHtml(p.id)}">열기</button><button data-rename-project="${escapeHtml(p.id)}">이름 변경</button><button data-delete-project="${escapeHtml(p.id)}" class="danger-button">삭제</button></div></div>`).join('');
  } else body += '<div class="muted">저장된 프로젝트가 없습니다. 새 프로젝트를 만들어 시작하세요.</div>';
  body += '</div>';
  showProjectModal('에디터 프로젝트 선택',body,[{label:'＋ 새 프로젝트',primary:true,run:beginNewProject},{label:'취소',run:closeProjectModal}]);
  $$('[data-open-project]').forEach(b=>b.onclick=()=>openProject(b.dataset.openProject));
  $$('[data-delete-project]').forEach(b=>b.onclick=()=>confirmDeleteProject(b.dataset.deleteProject));
  $$('[data-rename-project]').forEach(b=>b.onclick=()=>renameSavedProject(b.dataset.renameProject));
};
function renameSavedProject(id){
  const item = readProjects().find(p=>p.id===id); if(!item) return;
  showProjectModal('프로젝트 이름 변경',`<p>새 이름을 입력하세요.</p><input id="renameSavedProjectInput" maxlength="80" value="${escapeHtml(item.name||'')}" placeholder="프로젝트 이름">`,[
    {label:'취소',run:showEditorChooser},
    {label:'이름 변경',primary:true,run:()=>{const name=document.getElementById('renameSavedProjectInput')?.value.trim();if(!name){toast('프로젝트 이름을 입력해 주세요.');return}const list=readProjects();const target=list.find(p=>p.id===id);if(!target){toast('프로젝트를 찾을 수 없습니다.');return}target.name=name;target.updatedAt=new Date().toISOString();try{writeProjects(list);if(currentProjectId===id)currentProjectName=name;toast('프로젝트 이름을 변경했습니다.');showEditorChooser()}catch(e){console.error(e);toast('이름 변경에 실패했습니다.')}}}
  ]);
}
confirmDeleteProject = function(id){
  const item = readProjects().find(p=>p.id===id); if(!item) { toast('삭제할 프로젝트를 찾을 수 없습니다.'); showEditorChooser(); return; }
  showProjectModal('프로젝트를 영구 삭제할까요?',`<p><strong>${escapeHtml(item.name||'이름 없는 프로젝트')}</strong>를 정말 삭제할까요?</p><p class="muted">채보 데이터와 저장된 음원이 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</p>`,[
    {label:'취소',run:showEditorChooser},
    {label:'영구 삭제',primary:true,run:async()=>{
      try {
        writeProjects(readProjects().filter(p=>p.id!==id));
        if(id==='legacy-rf-chart') localStorage.removeItem('rf_chart');
        await deleteProjectAudio(id);
        if(currentProjectId===id){currentProjectId=null;currentProjectName='';editorDirty=false;activeAudioFile=null;activeAudioName='';showAudioFilename('');}
        toast('프로젝트와 음원을 삭제했습니다.'); showEditorChooser();
      } catch(e) { console.error(e); toast('삭제에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.'); }
    }}
  ]);
};

// Saving preserves the audio currently attached to this project; the filename is shown in both editor and list.
const priorCommitProjectSaveV2 = commitProjectSave;
commitProjectSave = async function(name){
  const result = await priorCommitProjectSaveV2(name);
  // The existing save function handles IndexedDB and metadata. Keep filename UI in sync.
  if (!editorDirty) showAudioFilename(activeAudioName || '');
  return result;
};

// Make saved editor projects playable from the Game Play chart list.
const priorRefreshGameChartsV2 = window.ADOARefreshGameCharts;
window.ADOARefreshGameCharts = function(){
  priorRefreshGameChartsV2();
  const list = document.getElementById('gameChartList');
  if (!list) return;
  const projects = readProjects();
  projects.forEach(p=>{
    if (!p.chart || !Array.isArray(p.chart.notes)) return;
    const row = document.createElement('div'); row.className='listitem';
    const meta=document.createElement('div');
    meta.innerHTML=`<strong>${escapeHtml(p.name||'이름 없는 프로젝트')}</strong><div class="muted">${Number(p.chart.bpm)||180} BPM · ${Number(p.chart.keyCount)||8}레인 · ${p.chart.notes.length}개 노트 · 내 프로젝트${(p.audioName||p.hasAudio)?' · 음원 포함':''}</div>`;
    const btn=document.createElement('button');btn.className='primary';btn.textContent='선택';
    btn.onclick=()=>selectGameChart({title:p.name,artist:'내 프로젝트',chart:p.chart,source:'project',projectId:p.id,projectAudioName:p.audioName||''});
    row.append(meta,btn);list.appendChild(row);
  });
  const count = list.querySelectorAll('.listitem').length;
  const status=document.getElementById('gameChartStatus'); if(status) status.textContent=`채보 ${count}개`;
};
const priorSelectGameChartV2 = selectGameChart;
selectGameChart = function(c){
  priorSelectGameChartV2(c);
  if (gameAudioUrl) { URL.revokeObjectURL(gameAudioUrl); gameAudioUrl=null; }
  if (c.projectId) {
    getProjectAudio(c.projectId).then(saved=>{
      if (!saved?.blob) { $('#gameLength').textContent='음원 없이 재생'; return; }
      if (gameAudio) { gameAudio.pause(); gameAudio=null; }
      gameAudioUrl=URL.createObjectURL(saved.blob); gameAudio=new Audio(gameAudioUrl);
      gameAudio.volume=(Number($('#musicVol')?.value)||100)/100;
      $('#gameLength').textContent=`음원: ${saved.name||c.projectAudioName||'저장된 음원'}`;
    }).catch(err=>{console.warn(err);toast('프로젝트 음원을 불러오지 못했습니다.')});
  } else if (c.audioUrl) {
    $('#gameLength').textContent='음원 재생';
  } else {
    $('#gameLength').textContent='음원 없이 재생';
  }
};

// Reliable note falling animation. The note starts above the screen and reaches the receptor at note time.
tickGame = function(){
  if (!gameRunning || !gameChart) return;
  const now = performance.now();
  const t = gameElapsed + (now - gameStartAt)/1000;
  const list = Array.isArray(gameChart.notes) ? gameChart.notes : [];
  const count = Math.max(1,Math.min(8,Number(gameChart.keyCount)||8));
  const approach = 2.0;
  const judgeY = 0.80;
  const stage = document.getElementById('gameStage');
  const height = stage ? stage.clientHeight : 500;
  $('#gameClock').textContent=t.toFixed(3)+'s';
  $('#gameStats').textContent=`${gameChart.bpm||180} BPM · ${count}레인 · 점수 ${gameScore} · 미스 ${gameMiss}`;
  $('#gameSeek').max=Math.max(1,(list.reduce((m,n)=>Math.max(m,Number(n.time)||0),0)+2));
  $('#gameSeek').value=Math.min(Number($('#gameSeek').max),t);
  const layer=$('#gameNotes'); layer.innerHTML='';
  for(let i=0;i<list.length;i++){
    const n=list[i]; const noteTime=Math.max(0,Number(n.time)||0); const dt=noteTime-t;
    if(gameHit.has(i)||gameMissed.has(i)) continue;
    if(dt < -0.18){gameMissed.add(i);gameMiss++;continue;}
    if(dt > approach) continue;
    const lane=Math.max(0,Math.min(count-1,Number(n.lane)||0));
    const el=document.createElement('div');el.className='game-note';
    el.style.left=`${((lane+0.5)/count)*100}%`;
    const y=(judgeY-(dt/approach)*judgeY)*height;
    el.style.top=`${y}px`;
    el.style.width=`calc(100% / ${count} - 8px)`;
    el.style.height='auto';el.style.aspectRatio='1';
    layer.appendChild(el);
  }
  const last=list.reduce((m,n)=>Math.max(m,Number(n.time)||0),0);
  if(t>last+1.5){gameRunning=false;if(gameAudio)gameAudio.pause();$('#gameOverlay').classList.remove('hidden');$('#gameOverlay').textContent=`플레이 완료! 점수 ${gameScore} · 미스 ${gameMiss}`;return;}
  gameRAF=requestAnimationFrame(tickGame);
};
startGame = function(){
  if(!gameChart){toast('먼저 플레이할 채보를 선택하세요.');return;}
  stopGame();gameMissed=new Set();gameRunning=true;gameStartAt=performance.now();
  $('#gameOverlay').classList.add('hidden');
  if(gameAudio){try{gameAudio.currentTime=0;gameAudio.play().catch(()=>{});}catch(e){console.warn(e)}}
  gameRAF=requestAnimationFrame(tickGame);
};

// Fill each lane with the receptor square; percentage widths are relative to the lane cell.
const repairCssV2=document.createElement('style');
repairCssV2.textContent=`
.editor-targets{grid-template-columns:repeat(var(--lane-count,8),minmax(0,1fr))!important;top:80%!important;bottom:auto!important;transform:translateY(-50%)!important}
.editor-target{width:calc(100% - 8px)!important;height:auto!important;aspect-ratio:1;min-width:0;padding:0}
.game-targets{grid-template-columns:repeat(var(--game-lane-count,8),minmax(0,1fr))!important;top:80%!important;bottom:auto!important;transform:translateY(-50%)!important}
.game-target{width:calc(100% - 8px)!important;height:auto!important;aspect-ratio:1;min-width:0;padding:0}
.game-note{width:calc(100% / var(--game-lane-count,8) - 8px);height:auto;aspect-ratio:1;transform:translate(-50%,-50%)}
.project-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.project-row-actions{display:flex;gap:6px;flex-wrap:wrap}.project-row-actions button{padding:6px 8px;font-size:12px}
#gameNotes{overflow:hidden}
`;
document.head.appendChild(repairCssV2);
const priorRenderGameLanesV2=renderGameLanes;
renderGameLanes=function(){priorRenderGameLanesV2();const count=Math.max(1,Math.min(8,Number(gameChart?.keyCount)||8));$('#gameTargets').style.setProperty('--game-lane-count',count);$('#gameNotes').style.setProperty('--game-lane-count',count);};
const priorBuildGuidesV2=buildGuides;
buildGuides=function(){priorBuildGuidesV2();const count=editorLaneCount();$('#editorTargets').style.setProperty('--lane-count',count);noteLayer.style.setProperty('--lane-count',count);};

// Refresh saved projects in the play list after storage changes.
// Keep saved-project and audio labels in sync after open/save/delete.
const priorOpenProjectV3 = openProject;
openProject = async function(id){ await priorOpenProjectV3(id); showAudioFilename(activeAudioName || ''); };
const priorCommitProjectSaveV3 = commitProjectSave;
commitProjectSave = async function(name){ await priorCommitProjectSaveV3(name); if (!editorDirty) { showAudioFilename(activeAudioName || ''); window.ADOARefreshGameCharts?.(); } };
window.ADOARefreshGameCharts?.();

// Editor viewport scrubbing, adjustable falling speed, and full-screen gameplay.
const adoaViewStyle = document.createElement('style');
adoaViewStyle.textContent = `
#timeline{height:560px!important;max-height:560px;overflow:hidden!important;position:relative}
#guides,#notes{position:absolute;left:0;right:0;top:0;bottom:auto;height:100%;will-change:transform}
#editorTargets{position:absolute;left:0;right:0;top:80%!important;bottom:auto!important;transform:translateY(-50%);z-index:5;pointer-events:none}
#editorTargets .editor-target{width:calc(100% - 4px)!important;height:auto!important;aspect-ratio:1;min-width:0;padding:0}
#notes .note{width:calc(100% / var(--lane-count,8) - 4px)!important;height:auto!important;aspect-ratio:1;line-height:0;border-radius:3px;padding:0;z-index:3}
#gameStage:fullscreen{width:100vw!important;height:100vh!important;min-height:100vh!important;max-height:100vh!important;border:0!important;border-radius:0!important;background:#05080e}
#gameStage:fullscreen .game-lane{border:0!important;background:none!important}
#gameStage:fullscreen .game-lane-label{display:none!important}
#gameStage:fullscreen .game-targets{top:80%!important;bottom:auto!important;transform:translateY(-50%)!important}
#gameStage:fullscreen .game-target{width:calc(100% / var(--game-lane-count,8) - 4px)!important;height:auto!important;aspect-ratio:1}
#gameStage:fullscreen .game-note{width:calc(100% / var(--game-lane-count,8) - 4px)!important;height:auto!important;aspect-ratio:1}
#gameStage:fullscreen .game-overlay{font-size:clamp(18px,3vw,32px)}
.game-judge-line{position:absolute;left:0;right:0;top:76%;height:2px;background:var(--accent2);box-shadow:0 0 12px #43d9c488;z-index:2;pointer-events:none}
.game-speed-control{display:inline-flex;align-items:center;gap:8px;color:var(--muted);font-size:12px}
.game-speed-control input{width:120px}
#editorPlaySpeed{width:110px}
`;
document.head.appendChild(adoaViewStyle);

// Use audio length when available; otherwise leave a generous editable timeline.
editorViewDuration = function(){
  const base = beatStep()*64;
  const latest = notes.reduce((m,n)=>Math.max(m,Number(n.time)||0),0);
  const songLength = Number(duration)||90;
  return Math.max(base, songLength, latest + Math.max(beatStep()*4, 5));
};
let adoaEditorScrollOffset = 0;
function adoaWorldHeight(){
  const base = Math.max(1,beatStep()*64);
  return Math.max(560,560*editorViewDuration()/base);
}
function adoaCurrentEditorTime(){
  if(audio && Number.isFinite(audio.currentTime)) return audio.currentTime;
  if(editorPlaying) return editorClock+(performance.now()-editorClockStart)/1000;
  return Number($('#seek')?.value)||0;
}
function updateEditorViewport(time){
  const worldH=adoaWorldHeight(), viewH=560, dur=editorViewDuration();
  const t=Math.max(0,Math.min(dur,Number(time)||0));
  const maxScroll=Math.max(0,worldH-viewH);
  adoaEditorScrollOffset=maxScroll*(dur>0?t/dur:0);
  $('#timeline').style.height='560px';
  $('#guides').style.height=worldH+'px';
  $('#notes').style.height=worldH+'px';
  $('#guides').style.transform=`translateY(${-adoaEditorScrollOffset}px)`;
  $('#notes').style.transform=`translateY(${-adoaEditorScrollOffset}px)`;
  $('#editorTargets').style.setProperty('top','80%');$('#editorTargets').style.setProperty('bottom','auto');$('#editorTargets').style.transform='translateY(-50%)';
  $('#seek').max=String(Math.max(1,dur));
  if(!$('#seek').matches(':active')) $('#seek').value=String(t);
  $('#now').textContent=t.toFixed(3)+'s';
}
const adoaOriginalBuildGuides = buildGuides;
buildGuides = function(){
  adoaOriginalBuildGuides();
  const worldH=adoaWorldHeight();
  $('#timeline').style.height='560px';
  $('#guides').style.height=worldH+'px';
  $('#notes').style.height=worldH+'px';
  // Clicks are translated back into song time, accounting for the current viewport offset.
  $$('#guides .guide').forEach(g=>{
    g.onclick=e=>{
      e.stopPropagation();
      const rect=$('#timeline').getBoundingClientRect();
      const worldY=Math.max(0,Math.min(worldH-1,e.clientY-rect.top+adoaEditorScrollOffset));
      let time=(worldY/worldH)*editorViewDuration();
      const step=beatStep();
      if($('#snap')?.checked) time=Math.round(time/step)*step;
      pushUndo();addNote({time,lane:Number(g.dataset.lane)||0,pos:positionFromTime(time)});setProjectDirty?.();
    };
  });
  updateEditorViewport(adoaCurrentEditorTime());
};

// The editor seek bar moves the beat guides and notes so the selected time meets the fixed 80% receptor row.
$('#seek').oninput=e=>{
  const t=Math.max(0,Number(e.target.value)||0);
  if(audio){try{audio.currentTime=Math.min(t,Number.isFinite(audio.duration)?audio.duration:t)}catch{}}
  else {editorClock=t;editorClockStart=performance.now();}
  updateEditorViewport(t);
};
const adoaOriginalSetEditorAudio = setEditorAudio;
setEditorAudio = function(blob,name){
  adoaOriginalSetEditorAudio(blob,name);
  if(audio){
    audio.addEventListener('loadedmetadata',()=>{duration=Number(audio.duration)||duration;$('#seek').max=String(Math.max(1,editorViewDuration()));buildGuides();updateEditorViewport(0);});
    audio.addEventListener('timeupdate',()=>updateEditorViewport(audio.currentTime));
  }
};
$('#audioFile')?.addEventListener('change',()=>setTimeout(()=>{if(audio){duration=Number(audio.duration)||duration;$('#seek').max=String(Math.max(1,editorViewDuration()));buildGuides();}},150));
$('#bpm')?.addEventListener('change',()=>{buildGuides();updateEditorViewport(adoaCurrentEditorTime())});
$('#subdivision')?.addEventListener('change',()=>{buildGuides();updateEditorViewport(adoaCurrentEditorTime())});
$('#keyCount')?.addEventListener('change',()=>{buildGuides();updateEditorViewport(adoaCurrentEditorTime())});

// Let silent editor preview run for the full chart duration instead of stopping at 64 beats.
$('#playAudio').onclick=()=>{
  if(audio){audio.play().catch(()=>toast('이 곡을 재생할 수 없습니다.'));return;}
  editorClock=Number($('#seek').value)||0;editorClockStart=performance.now();editorPlaying=true;
  cancelAnimationFrame(editorClockRAF);
  const loop=()=>{
    if(!editorPlaying)return;
    const t=editorClock+(performance.now()-editorClockStart)/1000;
    updateEditorViewport(t);
    if(t>=editorViewDuration()){editorPlaying=false;return;}
    editorClockRAF=requestAnimationFrame(loop);
  };
  editorClockRAF=requestAnimationFrame(loop);
  toast('무음 채보 미리보기를 재생합니다.');
};
$('#pauseAudio').onclick=()=>{
  if(audio)audio.pause();
  if(editorPlaying){editorClock+= (performance.now()-editorClockStart)/1000;editorPlaying=false;cancelAnimationFrame(editorClockRAF);updateEditorViewport(editorClock);}
};
$('#stopAudio').onclick=()=>{
  if(audio){audio.pause();try{audio.currentTime=0}catch{}}
  editorPlaying=false;editorClock=0;cancelAnimationFrame(editorClockRAF);$('#seek').value='0';updateEditorViewport(0);
};
// Keep viewport synchronized while audio is playing.
(function editorViewportLoop(){
  if(document.getElementById('editor')?.classList.contains('active')){
    const t=adoaCurrentEditorTime();
    if(audio && !audio.paused) updateEditorViewport(t);
    else if(editorPlaying) updateEditorViewport(t);
  }
  requestAnimationFrame(editorViewportLoop);
})();

// Add a speed control for the game note approach time (0.5x to 3x).
if(!document.getElementById('gameSpeedControl')){
  const bar=document.querySelector('#saveProject')?.parentElement;
  if(bar){
    const label=document.createElement('label');label.className='game-speed-control';label.id='gameSpeedControl';
    label.innerHTML='낙하 속도 <input id="gameSpeed" type="range" min="0.5" max="10" step="0.1" value="1"><strong id="gameSpeedValue">1.0×</strong>';
    const editorPlayButton=document.getElementById('playAudio');editorPlayButton?.insertAdjacentElement('afterend',label);
  }
}
const adoaSpeedInput=$('#gameSpeed');
if(adoaSpeedInput) adoaSpeedInput.oninput=()=>{$('#gameSpeedValue').textContent=Number(adoaSpeedInput.value).toFixed(1)+'×'};

// Receptor line stays at 80% of the stage; note arrival time is calculated against that exact line.
const gameStage=document.getElementById('gameStage');
if(gameStage && !document.getElementById('gameJudgeLine')){
  const line=document.createElement('div');line.id='gameJudgeLine';line.className='game-judge-line';gameStage.insertBefore(line,document.getElementById('gameTargets'));
}
const adoaOriginalTickGame = tickGame;
tickGame=function(){
  if(!gameRunning||!gameChart)return;
  const now=performance.now();
  const t=gameElapsed+(now-gameStartAt)/1000;
  const list=Array.isArray(gameChart.notes)?gameChart.notes:[];
  const count=Math.max(1,Math.min(8,Number(gameChart.keyCount)||8));
  const speed=Math.max(.5,Math.min(10,Number($('#gameSpeed')?.value)||1));
  const approach=2.2/speed;
  const judgeY=.76;
  const stage=document.getElementById('gameStage');
  const height=stage?stage.clientHeight:600;
  $('#gameClock').textContent=t.toFixed(3)+'s';
  $('#gameStats').textContent=`${gameChart.bpm||180} BPM · ${count}레인 · 점수 ${gameScore} · 미스 ${gameMiss}`;
  const last=list.reduce((m,n)=>Math.max(m,Number(n.time)||0),0);
  $('#gameSeek').max=String(Math.max(1,last+2));
  if(!$('#gameSeek').matches(':active'))$('#gameSeek').value=String(Math.min(last+2,t));
  const layer=$('#gameNotes');layer.innerHTML='';layer.style.setProperty('--game-lane-count',count);
  for(let i=0;i<list.length;i++){
    const n=list[i],noteTime=Math.max(0,Number(n.time)||0),dt=noteTime-t;
    if(gameHit.has(i)||gameMissed.has(i))continue;
    if(dt < -0.18){gameMissed.add(i);gameMiss++;continue;}
    if(dt>approach)continue;
    const lane=Math.max(0,Math.min(count-1,Number(n.lane)||0));
    const el=document.createElement('div');el.className='game-note';
    el.style.left=`${((lane+.5)/count)*100}%`;
    el.style.top=`${(judgeY-(dt/approach)*judgeY)*height}px`;
    el.style.width=`calc(100% / ${count} - 4px)`;el.style.height='auto';el.style.aspectRatio='1';
    layer.appendChild(el);
  }
  if(t>last+1.5){gameRunning=false;if(gameAudio)gameAudio.pause();$('#gameOverlay').classList.remove('hidden');$('#gameOverlay').textContent=`플레이 완료! 점수 ${gameScore} · 미스 ${gameMiss}`;return;}
  gameRAF=requestAnimationFrame(tickGame);
};
const adoaOriginalStartGame = startGame;
startGame=function(){
  if(!gameChart){toast('먼저 플레이할 채보를 선택하세요.');return;}
  try{if(gameStage?.requestFullscreen)gameStage.requestFullscreen().catch(()=>{});}catch{}
  stopGame();gameMissed=new Set();gameRunning=true;gameStartAt=performance.now();
  $('#gameOverlay').classList.add('hidden');
  if(gameAudio){try{gameAudio.currentTime=0;gameAudio.play().catch(()=>{});}catch{}}
  gameRAF=requestAnimationFrame(tickGame);
};
// Rebind buttons because their original handlers were assigned before this replacement.
$('#gamePlay').onclick=startGame;$('#gameRestart').onclick=startGame;
$('#gameSeek').oninput=e=>{
  const t=Math.max(0,Number(e.target.value)||0);
  gameElapsed=t;gameStartAt=performance.now();gameHit=new Set();gameMissed=new Set();gameScore=0;gameMiss=0;
  if(gameAudio){try{gameAudio.currentTime=t;if(gameRunning)gameAudio.play().catch(()=>{});}catch{}}
  if(gameRunning){cancelAnimationFrame(gameRAF);gameRAF=requestAnimationFrame(tickGame)}
  else if(gameChart){gameRunning=true;$('#gameOverlay').classList.add('hidden');gameRAF=requestAnimationFrame(tickGame)}
};

// Final interaction fixes: horizontal hover guide and editor Play opens gameplay.
const adoaInteractionFixStyle = document.createElement('style');
adoaInteractionFixStyle.textContent = `
#guides .guide:hover{border-left:1px solid #29364b!important;border-right:1px solid #202a3b!important}
#editorHoverLine{display:none!important;visibility:hidden!important}
#timeline.adoa-hovering #editorHoverLine{display:none!important}
#gameStage:not(:fullscreen) .game-targets{top:80%!important;bottom:auto!important;transform:translateY(-50%)!important}
#gameStage:not(:fullscreen) .game-target{width:calc(100% / var(--game-lane-count,8) - 4px)!important;height:auto!important;aspect-ratio:1}
`;
document.head.appendChild(adoaInteractionFixStyle);

// The hover indicator is a horizontal time guide, not a vertical lane border.
(function disableMouseFollowingLine(){
  const line=document.getElementById('editorHoverLine');
  if(line) line.remove();
  document.getElementById('timeline')?.classList.remove('adoa-hovering');
})();

// 시각 이벤트는 키 입력 판정과 독립적으로 음악 타임라인을 기준으로 실행합니다.
function adoApplyTimedVisualEvents(chartTime){
 const stage=document.getElementById('gameStage'); if(!stage||!gameChart)return;
 const list=Array.isArray(gameChart.effects)?gameChart.effects:[];
 let rotate=0,scale=1,flipX=1,flipY=1,shakeX=0,shakeY=0;
 for(const e of list){
  const start=Number(e.timeMs!=null?e.timeMs/1000:e.time)||0;
  const dur=Math.max(.001,Number(e.durationMs!=null?e.durationMs/1000:(e.duration||500)/1000)||.5);
  if(chartTime<start||chartTime>=start+dur)continue;
  const progress=(chartTime-start)/dur, v=Number(e.value)||15;
  if(e.type==='회전')rotate+=v;
  else if(e.type==='확대')scale=Math.max(scale,Math.max(.2,Math.min(5,Math.abs(v)/100)));
  else if(e.type==='축소')scale=Math.min(scale,Math.max(.2,Math.min(5,Math.abs(v)/100)));
  else if(e.type==='좌우 반전')flipX=-1;
  else if(e.type==='상하 반전')flipY=-1;
  else if(e.type==='화면 흔들림'){shakeX=Math.sin(progress*Math.PI*12)*v;shakeY=Math.cos(progress*Math.PI*10)*v*.45;}
 }
 stage.style.transform=`translate(${shakeX}px,${shakeY}px) rotate(${rotate}deg) scale(${scale*flipX},${scale*flipY})`;
 stage.style.transformOrigin='50% 50%';stage.style.transition='transform 40ms linear';
}

// Notes are drawn above the receptor when their hit time is in the future, then travel
// downward to the fixed receptor as time advances. Keep this same geometry in and out of fullscreen.
const adoaStableTickGame = function(){
  if(!gameRunning||!gameChart)return;
  const t=gameElapsed+(performance.now()-gameStartAt)/1000;
  adoApplyTimedVisualEvents(t-(Number(gameChart.offset??offset)||0)/1000);
  const list=Array.isArray(gameChart.notes)?gameChart.notes:[];
  const count=Math.max(1,Math.min(8,Number(gameChart.keyCount)||8));
  const speed=Math.max(.5,Math.min(10,Number(document.getElementById('gameSpeed')?.value)||1));
  const approach=2.2/speed;
  const judgeY=.76;
  const stage=document.getElementById('gameStage');
  const height=stage?stage.clientHeight:600;
  $('#gameClock').textContent=t.toFixed(3)+'s';
  $('#gameStats').textContent=`${gameChart.bpm||180} BPM · ${count}레인 · 점수 ${gameScore} · 미스 ${gameMiss}`;
  const last=list.reduce((m,n)=>Math.max(m,Number(n.time)||0),0);
  $('#gameSeek').max=String(Math.max(1,last+2));
  if(!$('#gameSeek').matches(':active'))$('#gameSeek').value=String(Math.min(last+2,t));
  const layer=$('#gameNotes');layer.innerHTML='';layer.style.setProperty('--game-lane-count',count);
  for(let i=0;i<list.length;i++){
    const n=list[i],noteTime=Math.max(0,Number(n.time)||0),dt=noteTime-t;
    if(gameHit.has(i)||gameMissed.has(i))continue;
    if(dt < -.18){gameMissed.add(i);gameMiss++;continue;}
    if(dt>approach)continue;
    const lane=Math.max(0,Math.min(count-1,Number(n.lane)||0));
    const el=document.createElement('div');el.className='game-note';
    el.style.left=`${((lane+.5)/count)*100}%`;
    // dt=approach => above screen; dt=0 => centered on the receptor at 68% height.
    el.style.top=`${Math.max(-40,(judgeY-(dt/approach)*judgeY)*height)}px`;
    el.style.width=`calc(100% / ${count} - 4px)`;el.style.height='auto';el.style.aspectRatio='1';
    layer.appendChild(el);
  }
  if(t>last+1.5){gameRunning=false;if(gameAudio)gameAudio.pause();$('#gameOverlay').classList.remove('hidden');$('#gameOverlay').textContent=`플레이 완료! 점수 ${gameScore} · 미스 ${gameMiss}`;return;}
  gameRAF=requestAnimationFrame(adoaStableTickGame);
};
tickGame=adoaStableTickGame;

// Pressing Play inside the editor now opens the dedicated gameplay screen and starts there.
$('#playAudio').onclick=()=>{
  const chart=(typeof chartSnapshot==='function')?chartSnapshot():window.ADOAChartBridge.getCurrentChart();
  if(!chart||!Array.isArray(chart.notes)){toast('먼저 채보를 만들어 주세요.');return;}
  const title=(typeof currentProjectName==='string'&&currentProjectName&&currentProjectName!=='새 프로젝트')?currentProjectName:'에디터 채보';
  const sourceUrl=(typeof audioUrl==='string'&&audioUrl)?audioUrl:null;
  // Stop the editor's silent/audio preview so it cannot move the editor viewport behind gameplay.
  try{if(audio)audio.pause();}catch{}
  editorPlaying=false;cancelAnimationFrame(editorClockRAF);
  selectGameChart({title,artist:'에디터 미리보기',chart,audioUrl:sourceUrl,source:'editor-preview'});
  show('game');
  requestAnimationFrame(()=>{
    const stage=document.getElementById('gameStage');
    try{if(stage?.requestFullscreen)stage.requestFullscreen().catch(()=>{});}catch{}
    startGame();
  });
};

// === ADOA gameplay HUD, judgement/health system, configurable duration, fullscreen editor ===
const adoStyle = document.createElement('style');
adoStyle.textContent = `
#editor.editor-fullscreen:not(.active){display:none!important}
#editor.editor-fullscreen{position:fixed!important;inset:0!important;z-index:60!important;display:block!important;max-width:none!important;margin:0!important;padding:12px!important;overflow:auto!important;background:#080c13!important}
#editor.editor-fullscreen .workspace{grid-template-columns:minmax(0,1fr) 260px!important}
#editor.editor-fullscreen .timeline-wrap{max-height:calc(100vh - 190px)}
#editor .timeline{min-height:560px}
.adoa-game-panel{min-width:0}
.adoa-game-layout{display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:12px;align-items:stretch}
.adoa-game-playfield{min-width:0}
.adoa-game-playfield .timeline-foot{margin-top:10px}
#gameStage{height:min(74vh,850px);min-height:420px;border-radius:8px;background:#080c13;position:relative;isolation:isolate}
#gameStage .game-lanes{inset:0;right:0;grid-template-columns:repeat(var(--game-lane-count,8),minmax(0,1fr))!important}
#gameStage .game-lane{border-left:1px solid #253044;background:linear-gradient(180deg,#141c2b66,#080c13 72%)}
#gameStage .game-lane-label{display:none}
#gameStage .game-targets{left:0!important;right:0!important;top:80%!important;bottom:auto!important;transform:translateY(-50%)!important;grid-template-columns:repeat(var(--game-lane-count,8),minmax(0,1fr))!important}
#gameStage .game-target{width:calc(100% - 4px)!important;height:auto!important;aspect-ratio:1!important;max-width:none!important;border:2px solid #43d9c4;background:#43d9c422;box-shadow:0 0 16px #43d9c455}
#gameStage .game-note{width:calc(100% / var(--game-lane-count,8) - 4px)!important;height:auto!important;aspect-ratio:1!important;border-radius:3px!important;transform:translate(-50%,-50%)!important}
#gameStage .game-judge-line{display:block!important;position:absolute!important;left:0!important;right:0!important;top:80%!important;bottom:auto!important;height:3px!important;background:#43d9c4!important;box-shadow:0 0 16px #43d9c4aa!important;z-index:3!important;pointer-events:none}
.adoa-hud-top{position:absolute;left:10px;right:10px;top:10px;z-index:6;display:grid;grid-template-columns:minmax(115px,1fr) minmax(0,2fr);gap:12px;align-items:start;pointer-events:none}
.adoa-health{background:#090e16d9;border:1px solid #35435b;border-radius:10px;padding:8px 10px;max-width:230px}
.adoa-health-label{display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:800;color:#d7e1f2;margin-bottom:6px}
.adoa-health-track{height:12px;display:grid;grid-template-columns:repeat(5,1fr);gap:4px}
.adoa-heart{border-radius:3px;background:#273247;border:1px solid #43516a}
.adoa-heart.full{background:#ff5470;border-color:#ff8798;box-shadow:0 0 8px #ff547055}
.adoa-input-meter{display:flex;justify-content:center;gap:4px;min-width:0}
.adoa-input-lane{flex:1;max-width:62px;min-width:0;height:34px;border:1px solid #43516a;border-radius:6px;background:#121a28e8;color:#8191ab;display:grid;place-items:center;font-size:12px;font-weight:900}
.adoa-input-lane.active{background:#43d9c4;color:#07131a;border-color:#a4fff1;box-shadow:0 0 18px #43d9c488;transform:translateY(2px)}
.adoa-combo{position:absolute;left:50%;top:43%;transform:translate(-50%,-50%);z-index:5;text-align:center;pointer-events:none;text-shadow:0 3px 15px #000;font-weight:1000;color:#f6f8ff;line-height:1}
.adoa-combo-number{font-size:clamp(32px,6vw,68px);letter-spacing:-2px}
.adoa-combo-word{font-size:clamp(13px,2vw,20px);letter-spacing:4px;color:#43d9c4;margin-top:5px}
.adoa-judgement{position:absolute;left:50%;top:55%;transform:translate(-50%,-50%);z-index:7;pointer-events:none;font-size:clamp(22px,4vw,44px);font-weight:1000;letter-spacing:1px;text-align:center;text-shadow:0 3px 18px #000;opacity:0}
.adoa-judgement.show{opacity:1;animation:adoaJudgePop .42s ease-out}
.adoa-judgement.perfect{color:#fff28b}.adoa-judgement.good{color:#80d8ff}.adoa-judgement.notbad{color:#8dffa7}.adoa-judgement.bad{color:#ffb05d}.adoa-judgement.miss{color:#ff5e7b}
@keyframes adoaJudgePop{0%{opacity:0;transform:translate(-50%,-40%) scale(.75)}25%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}100%{opacity:0;transform:translate(-50%,-58%) scale(1)}}
.adoa-scoreboard{background:#0d131e;border:1px solid #29364b;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;min-width:0}
.adoa-scoreboard h3{margin:0 0 2px;font-size:14px}
.adoa-count{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 8px;border-radius:6px;background:#151e2c;font-size:12px}
.adoa-count strong{font-size:16px;font-variant-numeric:tabular-nums}
.adoa-count.perfect{color:#fff28b}.adoa-count.good{color:#80d8ff}.adoa-count.notbad{color:#8dffa7}.adoa-count.bad{color:#ffb05d}.adoa-count.miss{color:#ff5e7b}
.adoa-judge-scale{border-top:1px solid #29364b;margin-top:4px;padding-top:10px;font-size:10px;color:#9ba9bf;line-height:1.7}
.adoa-judge-scale strong{color:#d9e4f5;display:block;margin-bottom:3px}
.adoa-status-pill{font-size:11px;color:#8fffe9;background:#12312f;border:1px solid #245d58;border-radius:99px;padding:4px 8px;display:inline-block}
#game.adoa-editor-play .adoa-return-editor{display:inline-flex!important}
.adoa-return-editor{display:none}
.adoa-duration-control{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#b9c5d8}
.adoa-duration-control input{width:86px!important;background:#090e16;color:#eaf0ff;border:1px solid #34415a;border-radius:7px;padding:8px}
.adoa-invincible.active{background:#4b2c61!important;color:#f4d8ff!important;border-color:#c78cff!important}
.adoa-game-panel:fullscreen{background:#080c13!important;border:0!important;border-radius:0!important;padding:12px!important;overflow:auto!important}
.adoa-game-panel:fullscreen #gameStage{height:calc(100vh - 180px)!important;min-height:400px!important}
@media(max-width:850px){.adoa-game-layout{grid-template-columns:minmax(0,1fr) 125px;gap:7px}.adoa-scoreboard{padding:7px}.adoa-count{padding:5px;font-size:10px}.adoa-count strong{font-size:13px}.adoa-hud-top{grid-template-columns:1fr;gap:6px}.adoa-health{max-width:180px}.adoa-input-lane{height:27px;font-size:10px}.adoa-game-layout #gameStage{min-height:380px}}
`;
document.head.appendChild(adoStyle);

// Add duration and fullscreen/invincibility controls to the editor toolbar.
const adoEditorToolbar = document.querySelector('#saveProject')?.parentElement;
if (adoEditorToolbar && !document.getElementById('chartDurationInput')) {
  const durationLabel = document.createElement('label');
  durationLabel.className = 'adoa-duration-control';
  durationLabel.innerHTML = '곡 길이(초) <input id="chartDurationInput" type="number" min="1" max="600" step="0.5" value="90">';
  document.getElementById('saveProject').insertAdjacentElement('afterend', durationLabel);
  const fsButton = document.createElement('button'); fsButton.id='editorFullscreenButton'; fsButton.textContent='⛶ 에디터 전체화면'; durationLabel.insertAdjacentElement('afterend',fsButton);
  const invButton = document.createElement('button'); invButton.id='adoaInvincibleToggle'; invButton.className='adoa-invincible'; invButton.textContent='♾ 무적 모드: 꺼짐'; fsButton.insertAdjacentElement('afterend',invButton);
}
let adoInvincibleRequested = false;
let adoInvincibleForRun = false;
let adoEditorPlayRun = false;
let adoGameHealth = 5;
let adoGameCombo = 0;
let adoGameCounts = {perfect:0,good:0,notbad:0,bad:0,miss:0};
let adoSuccessfulSinceHeal = 0;
let adoGameDeaths = 0;
let adoGameNoteEls = [];
let adoJudgeTimer = 0;
let adoEditorDuration = 90;
const adoOriginalEditorViewDuration = editorViewDuration;
editorViewDuration = function(){
  const input = document.getElementById('chartDurationInput');
  const chosen = Math.max(1,Math.min(600,Number(input?.value)||adoEditorDuration||90));
  const latest = notes.reduce((m,n)=>Math.max(m,Number(n.time)||0),0);
  return Math.max(chosen, latest + beatStep()*2, Number.isFinite(duration)&&duration>0?Math.min(duration,chosen):0);
};
chartSnapshot = function(){
  const base = {format:'RhythmForgeChart',version:1,bpm:+$('#bpm').value||180,subdivision:+$('#subdivision').value||4,keyCount:+$('#keyCount').value||8,offset,notes:notes.map(n=>({time:Number(n.time)||0,lane:Number(n.lane)||0,id:n.id,pos:n.pos})),events:JSON.parse(JSON.stringify(events||[])),effects:JSON.parse(JSON.stringify(effects||[])),images:(images||[]).map(x=>({name:x.name,priority:x.priority}))};
  base.duration = Math.max(1,Math.min(600,Number(document.getElementById('chartDurationInput')?.value)||adoEditorDuration||90));
  return base;
};
const adoOldRestoreSnapshot = restoreSnapshot;
restoreSnapshot = function(raw){
  adoOldRestoreSnapshot(raw);
  const d=typeof raw==='string'?JSON.parse(raw):raw;
  adoEditorDuration=Math.max(1,Math.min(600,Number(d?.duration)||90));
  const input=document.getElementById('chartDurationInput'); if(input)input.value=String(adoEditorDuration);
  requestAnimationFrame(()=>{buildGuides();renderNotes()});
};
const adoOldLoadChartIntoEditor = loadChartIntoEditor;
loadChartIntoEditor = function(d){
  adoOldLoadChartIntoEditor(d);
  adoEditorDuration=Math.max(1,Math.min(600,Number(d?.duration)||90));
  const input=document.getElementById('chartDurationInput'); if(input)input.value=String(adoEditorDuration);
  requestAnimationFrame(()=>{buildGuides();renderNotes()});
};
const adoDurationInput = document.getElementById('chartDurationInput');
// When a music file is selected, use its actual length as the initial editable song length.
document.getElementById('audioFile')?.addEventListener('change',()=>{
  if(!audio)return;
  const prior=audio.onloadedmetadata;
  audio.onloadedmetadata=function(){
    if(typeof prior==='function')prior.call(this);
    const len=Number(this.duration);
    if(Number.isFinite(len)&&len>0&&adoDurationInput){adoEditorDuration=Math.max(1,Math.min(600,len));adoDurationInput.value=String(Number(adoEditorDuration.toFixed(2)));buildGuides();renderNotes();}
  };
});
if(adoDurationInput){
  adoDurationInput.addEventListener('change',()=>{adoEditorDuration=Math.max(1,Math.min(600,Number(adoDurationInput.value)||90));adoDurationInput.value=String(adoEditorDuration);setProjectDirty();buildGuides();renderNotes();if(document.getElementById('seek'))document.getElementById('seek').max=String(adoEditorDuration);});
}
const adoOriginalBeginNewProject = beginNewProject;
beginNewProject = function(){adoEditorDuration=90;if(adoDurationInput)adoDurationInput.value='90';adoInvincibleRequested=false;adoUpdateInvincibleButton();adoOriginalBeginNewProject();};

function adoUpdateInvincibleButton(){const b=document.getElementById('adoaInvincibleToggle');if(!b)return;b.classList.toggle('active',adoInvincibleRequested);b.textContent=adoInvincibleRequested?'♾ 무적 모드: 켜짐':'♾ 무적 모드: 꺼짐';b.title='에디터 플레이 시작 전에만 변경할 수 있습니다.';}
document.getElementById('adoaInvincibleToggle')?.addEventListener('click',()=>{if(gameRunning){toast('플레이 시작 후에는 무적 모드를 변경할 수 없습니다.');return;}adoInvincibleRequested=!adoInvincibleRequested;adoUpdateInvincibleButton();setProjectDirty();});
document.getElementById('editorFullscreenButton')?.addEventListener('click',async()=>{
  const ed=document.getElementById('editor');
  const enabled=ed.classList.toggle('editor-fullscreen');
  document.getElementById('editorFullscreenButton').textContent=enabled?'⤢ 전체화면 종료':'⛶ 에디터 전체화면';
  // CSS fullscreen keeps editor navigation predictable; the gameplay screen uses browser fullscreen.
  requestAnimationFrame(()=>{buildGuides();renderNotes()});
});
document.addEventListener('fullscreenchange',()=>{
  const ed=document.getElementById('editor');
  if(!document.fullscreenElement&&ed?.classList.contains('editor-fullscreen')){ed.classList.remove('editor-fullscreen');const b=document.getElementById('editorFullscreenButton');if(b)b.textContent='⛶ 에디터 전체화면';requestAnimationFrame(()=>{buildGuides();renderNotes()});}
});

// Build a proper gameplay layout: top input meter, fixed receptor, combo, and right-hand judgement counters.
const adoStage = document.getElementById('gameStage');
const adoGamePanel = adoStage?.closest('.panel');
if(adoGamePanel){
  adoGamePanel.classList.add('adoa-game-panel');
  const toolbar=adoGamePanel.querySelector('.toolbar');
  if(toolbar&&!document.getElementById('gameReturnEditor')){
    const ret=document.createElement('button');ret.id='gameReturnEditor';ret.className='adoa-return-editor';ret.textContent='↩ 에디터로 돌아가기';toolbar.insertBefore(ret,toolbar.firstChild);
    const fs=document.createElement('button');fs.id='gameFullscreenButton';fs.textContent='⛶ 전체화면';toolbar.appendChild(fs);
  }
  if(adoStage&&!document.getElementById('adoaGameLayout')){
    const foot=adoGamePanel.querySelector('.timeline-foot');
    const layout=document.createElement('div');layout.id='adoaGameLayout';layout.className='adoa-game-layout';
    const field=document.createElement('div');field.className='adoa-game-playfield';
    const side=document.createElement('aside');side.id='adoaScoreboard';side.className='adoa-scoreboard';
    side.innerHTML=`<h3>판정 기록</h3><div class="adoa-count perfect"><span>PERFECT</span><strong id="adoCountPerfect">0</strong></div><div class="adoa-count good"><span>GOOD</span><strong id="adoCountGood">0</strong></div><div class="adoa-count notbad"><span>NOT BAD</span><strong id="adoCountNotbad">0</strong></div><div class="adoa-count bad"><span>BAD</span><strong id="adoCountBad">0</strong></div><div class="adoa-count miss"><span>MISS</span><strong id="adoCountMiss">0</strong></div><div class="adoa-count"><span>DEATH</span><strong id="adoCountDeaths">0</strong></div><div class="adoa-judge-scale"><strong>판정 범위</strong>PERFECT · ±25ms<br>GOOD · ±50ms<br>NOT BAD · ±75ms<br>BAD · ±100ms<br>그 외 · 입력 무효<br><br><span id="adoaHealProgress">회복까지 20회</span></div>`;
    adoStage.parentNode.insertBefore(layout,adoStage);
    field.appendChild(adoStage);if(foot)field.appendChild(foot);layout.append(field,side);
    const hud=document.createElement('div');hud.className='adoa-hud-top';hud.innerHTML=`<div class="adoa-health"><div class="adoa-health-label"><span>HEALTH</span><strong id="adoaHealthText">5 / 5</strong></div><div class="adoa-health-track">${Array.from({length:5},(_,i)=>`<span class="adoa-heart full" data-heart="${i}"></span>`).join('')}</div></div><div class="adoa-input-meter" id="adoaInputMeter"></div>`;
    adoStage.appendChild(hud);
    const combo=document.createElement('div');combo.id='adoaCombo';combo.className='adoa-combo';combo.innerHTML='<div class="adoa-combo-number" id="adoaComboNumber">0</div><div class="adoa-combo-word">COMBO</div>';adoStage.appendChild(combo);
    const judge=document.createElement('div');judge.id='adoaJudgement';judge.className='adoa-judgement';adoStage.appendChild(judge);
    const line=document.getElementById('gameJudgeLine');if(!line){const l=document.createElement('div');l.id='gameJudgeLine';l.className='game-judge-line';adoStage.insertBefore(l,document.getElementById('gameTargets'));}
  }
}
function adoRefreshHUD(){
  const h=document.getElementById('adoaHealthText');if(h)h.textContent=`${adoGameHealth} / 5`;
  document.querySelectorAll('[data-heart]').forEach(el=>el.classList.toggle('full',Number(el.dataset.heart)<adoGameHealth));
  const combo=document.getElementById('adoaComboNumber');if(combo)combo.textContent=String(adoGameCombo);
  const vals={perfect:adoGameCounts.perfect,good:adoGameCounts.good,notbad:adoGameCounts.notbad,bad:adoGameCounts.bad,miss:adoGameCounts.miss};
  for(const [k,v] of Object.entries(vals)){const el=document.getElementById('adoCount'+k[0].toUpperCase()+k.slice(1));if(el)el.textContent=String(v);}
  const deaths=document.getElementById('adoCountDeaths');if(deaths)deaths.textContent=String(adoGameDeaths);
  const heal=document.getElementById('adoaHealProgress');if(heal)heal.textContent=`회복까지 ${20-adoSuccessfulSinceHeal}회`;
}
function adoResetHUD(){adoGameHealth=5;adoGameCombo=0;adoGameCounts={perfect:0,good:0,notbad:0,bad:0,miss:0};adoSuccessfulSinceHeal=0;adoGameDeaths=0;adoRefreshHUD();const j=document.getElementById('adoaJudgement');if(j){j.className='adoa-judgement';j.textContent='';}}
function adoFlashJudgement(text,kind){const j=document.getElementById('adoaJudgement');if(!j)return;j.className='adoa-judgement '+kind;j.textContent=text;void j.offsetWidth;j.classList.add('show');clearTimeout(adoJudgeTimer);adoJudgeTimer=setTimeout(()=>j.classList.remove('show'),430);}
function adoUpdateInputMeter(){const meter=document.getElementById('adoaInputMeter');if(!meter||!gameChart)return;const count=Math.max(1,Math.min(8,Number(gameChart.keyCount)||8));const mapping=keys[count]||keys[8]||[];meter.innerHTML=Array.from({length:count},(_,i)=>`<span class="adoa-input-lane" data-input-lane="${i}">${escapeHtml(String(mapping[i]||i+1))}</span>`).join('');}
function adoSetGameHealthAfterMiss(){adoGameHealth=Math.max(0,adoGameHealth-1);adoGameCombo=0;adoRefreshHUD();if(adoGameHealth<=0){if(adoInvincibleForRun){adoGameDeaths++;adoGameHealth=1;adoRefreshHUD();adoFlashJudgement('DEATH +1 HEART','miss');}else{adoGameRunningOver();}}}
function adoGameRunningOver(){gameRunning=false;cancelAnimationFrame(gameRAF);if(gameAudio)gameAudio.pause();const o=document.getElementById('gameOverlay');if(o){o.classList.remove('hidden');o.textContent=`GAME OVER · 점수 ${gameScore} · MISS ${adoGameCounts.miss}`;}adoFlashJudgement('GAME OVER','miss');}
function adoRecordHit(kind){adoGameCounts[kind]++;if(kind==='bad'){adoGameCombo=0;adoFlashJudgement('BAD','bad');}else{adoGameCombo++;adoFlashJudgement(kind==='perfect'?'PERFECT':kind==='good'?'GOOD':'NOT BAD',kind);adoSuccessfulSinceHeal++;if(adoSuccessfulSinceHeal>=20){adoSuccessfulSinceHeal-=20;if(adoGameHealth<5){adoGameHealth++;adoFlashJudgement('＋1 HEALTH',kind);}}}adoRefreshHUD();}
function adoPrepareGameNotes(){const layer=document.getElementById('gameNotes');if(!layer||!gameChart)return;layer.innerHTML='';const list=Array.isArray(gameChart.notes)?gameChart.notes:[];const count=Math.max(1,Math.min(8,Number(gameChart.keyCount)||8));layer.style.setProperty('--game-lane-count',count);const stage=document.getElementById('gameStage');if(stage)stage.style.setProperty('--game-lane-count',count);adoGameNoteEls=list.map((n,i)=>{const el=document.createElement('div');el.className='game-note';el.dataset.noteIndex=String(i);el.style.left=`${((Math.max(0,Math.min(count-1,Number(n.lane)||0))+.5)/count)*100}%`;el.style.width=`calc(100% / ${count} - 4px)`;el.style.display='none';layer.appendChild(el);return el;});adoUpdateInputMeter();}
function adoDurationForChart(){const list=Array.isArray(gameChart?.notes)?gameChart.notes:[];const last=list.reduce((m,n)=>Math.max(m,Number(n.time)||0),0);return Math.max(1,Number(gameChart?.duration)||last+1.5);}
// Replace start/tick with stable per-note DOM updates to avoid clearing/recreating all notes every frame.
startGame=function(){
  if(!gameChart){toast('먼저 플레이할 채보를 선택하세요.');return;}
  stopGame();gameMissed=new Set();gameHit=new Set();gameScore=0;gameMiss=0;gameElapsed=0;adoResetHUD();
  adoEditorPlayRun=gameChartSource?.source==='editor-preview';adoInvincibleForRun=adoEditorPlayRun&&adoInvincibleRequested;
  const screen=document.getElementById('game');screen?.classList.toggle('adoa-editor-play',adoEditorPlayRun);
  const ret=document.getElementById('gameReturnEditor');if(ret)ret.style.display=adoEditorPlayRun?'inline-flex':'none';
  adoPrepareGameNotes();
  gameRunning=true;gameStartAt=performance.now();const overlay=document.getElementById('gameOverlay');if(overlay)overlay.classList.add('hidden');
  try{if(adoGamePanel?.requestFullscreen&&!document.fullscreenElement)adoGamePanel.requestFullscreen().catch(()=>{});}catch{}
  if(gameAudio){try{gameAudio.currentTime=0;gameAudio.play().catch(()=>{});}catch{}}
  const stage=document.getElementById('gameStage');try{if(stage?.requestFullscreen&&!document.fullscreenElement){/* panel fullscreen button is user-triggered; don't force fullscreen here */}}catch{}
  gameRAF=requestAnimationFrame(adoTickGame);
};
function adoTickGame(){
  if(!gameRunning||!gameChart)return;
  const t=gameElapsed+(performance.now()-gameStartAt)/1000;
  const effectiveT=t-(Number(gameChart.offset??offset)||0)/1000;
  // Apply timed visual events on the active game loop, including editor preview and seek.
  if(typeof adoApplyTimedVisualEvents==='function') adoApplyTimedVisualEvents(effectiveT);
  const list=Array.isArray(gameChart.notes)?gameChart.notes:[];
  const count=Math.max(1,Math.min(8,Number(gameChart.keyCount)||8));
  const speed=Math.max(.5,Math.min(10,Number(document.getElementById('gameSpeed')?.value)||1));
  const approach=2.0/speed,judgeY=.76;
  const stage=document.getElementById('gameStage'),height=stage?.clientHeight||600;
  const last=list.reduce((m,n)=>Math.max(m,Number(n.time)||0),0);
  const totalDuration=Math.max(adoDurationForChart(),last+1.05);
  const seek=document.getElementById('gameSeek');if(seek){seek.max=String(totalDuration);if(!seek.matches(':active'))seek.value=String(Math.min(totalDuration,t));}
  const clock=document.getElementById('gameClock');if(clock)clock.textContent=`${t.toFixed(3)}s`;
  const stats=document.getElementById('gameStats');if(stats)stats.textContent=`${gameChart.bpm||180} BPM · ${count}레인 · 점수 ${gameScore}`;
  for(let i=0;i<list.length;i++){
    const n=list[i],noteTime=Math.max(0,Number(n.time)||0),dt=noteTime-effectiveT,el=adoGameNoteEls[i];
    if(!el)continue;
    if(gameHit.has(i)||gameMissed.has(i)){el.style.display='none';continue;}
    if(dt < -0.100){gameMissed.add(i);gameMiss++;adoGameCounts.miss++;adoFlashJudgement('MISS','miss');adoSetGameHealthAfterMiss();el.style.display='none';if(!gameRunning)return;continue;}
    if(dt>approach){el.style.display='none';continue;}
    el.style.display='block';
    const lane=Math.max(0,Math.min(count-1,Number(n.lane)||0));
    el.style.left=`${((lane+.5)/count)*100}%`;
    el.style.top=`${(judgeY-(dt/approach)*judgeY)*height}px`;
  }
  adoRefreshHUD();
  if(t>=totalDuration){gameRunning=false;if(gameAudio)gameAudio.pause();const o=document.getElementById('gameOverlay');if(o){o.classList.remove('hidden');o.textContent=`완주! 점수 ${gameScore} · MISS ${adoGameCounts.miss}`;}return;}
  gameRAF=requestAnimationFrame(adoTickGame);
}
tickGame=adoTickGame;

// Replace the earlier input listener (removed below) with one capture-phase handler.
const adoHeldKeys = new Set();
function adoRefreshHeldKeys(){
  if(!gameChart)return;
  const count=Math.max(1,Math.min(8,Number(gameChart.keyCount)||8)),mapping=keys[count]||keys[8]||[];
  const heldLanes=new Set();
  for(const key of adoHeldKeys){const lane=mapping.findIndex(k=>String(k).toUpperCase()===String(key).toUpperCase());if(lane>=0)heldLanes.add(lane);}
  document.querySelectorAll('#gameTargets .game-target').forEach((el,i)=>el.classList.toggle('pressed',heldLanes.has(i)));
  document.querySelectorAll('.adoa-input-lane').forEach(el=>el.classList.toggle('active',heldLanes.has(Number(el.dataset.inputLane))));
  // The editor's own receptor row receives the same held-key feedback during editor preview.
  document.querySelectorAll('#editorTargets .editor-target').forEach((el,i)=>el.classList.toggle('pressed',heldLanes.has(i)));
}
function adoGameKeyHandler(e){
  if(!gameRunning||!gameChart||document.getElementById('game')?.classList.contains('active')!==true)return;
  if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName||''))return;
  const count=Math.max(1,Math.min(8,Number(gameChart.keyCount)||8)),mapping=keys[count]||keys[8]||[];
  const lane=mapping.findIndex(k=>String(k).toUpperCase()===e.key.toUpperCase());if(lane<0)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(e.repeat || adoHeldKeys.has(e.key))return;
  adoHeldKeys.add(e.key);adoRefreshHeldKeys();
  const list=Array.isArray(gameChart.notes)?gameChart.notes:[],t=gameElapsed+(performance.now()-gameStartAt)/1000-(Number(gameChart.offset??offset)||0)/1000;
  let best=-1,bestError=Infinity;
  for(let i=0;i<list.length;i++){if(gameHit.has(i)||gameMissed.has(i)||Number(list[i].lane)!==lane)continue;const err=(t-(Number(list[i].time)||0))*1000;if(Math.abs(err)<=100&&Math.abs(err)<Math.abs(bestError)){best=i;bestError=err;}}
  if(best<0)return;
  const abs=Math.abs(bestError);let kind;
  if(abs<=25)kind='perfect';else if(abs<=50)kind='good';else if(abs<=75)kind='notbad';else kind='bad';
  gameHit.add(best);gameScore+=kind==='perfect'?300:kind==='good'?200:kind==='notbad'?100:25;
  adoRecordHit(kind);const el=adoGameNoteEls[best];if(el)el.style.display='none';
}
document.addEventListener('keydown',adoGameKeyHandler,true);
document.addEventListener('keyup',e=>{adoHeldKeys.delete(e.key);adoRefreshHeldKeys();},true);
window.addEventListener('blur',()=>{adoHeldKeys.clear();adoRefreshHeldKeys();});

// Seeking resets the run's judgement state but never changes the fixed receptor line.
const adoSeek=document.getElementById('gameSeek');if(adoSeek){adoSeek.oninput=e=>{const t=Math.max(0,Number(e.target.value)||0);gameElapsed=t;gameStartAt=performance.now();gameHit=new Set();gameMissed=new Set();gameScore=0;gameMiss=0;adoResetHUD();adoPrepareGameNotes();if(gameAudio){try{gameAudio.currentTime=t;if(gameRunning)gameAudio.play().catch(()=>{});}catch{}}if(gameRunning){cancelAnimationFrame(gameRAF);gameRAF=requestAnimationFrame(adoTickGame);}else if(gameChart){gameRunning=true;document.getElementById('gameOverlay')?.classList.add('hidden');gameRAF=requestAnimationFrame(adoTickGame);}};}
const adoPause=document.getElementById('gamePause');if(adoPause)adoPause.onclick=()=>{if(gameRunning){gameElapsed+=(performance.now()-gameStartAt)/1000;gameRunning=false;cancelAnimationFrame(gameRAF);if(gameAudio)gameAudio.pause();const o=document.getElementById('gameOverlay');if(o){o.classList.remove('hidden');o.textContent='일시정지';}}else if(gameChart){gameRunning=true;gameStartAt=performance.now();document.getElementById('gameOverlay')?.classList.add('hidden');if(gameAudio){try{gameAudio.currentTime=gameElapsed;gameAudio.play().catch(()=>{});}catch{}}gameRAF=requestAnimationFrame(adoTickGame);}};
document.getElementById('gamePlay').onclick=()=>{if(gameChart&&!gameRunning)startGame();};
document.getElementById('gameRestart').onclick=()=>startGame();
document.getElementById('gameReturnEditor')?.addEventListener('click',()=>{gameRunning=false;cancelAnimationFrame(gameRAF);if(gameAudio)gameAudio.pause();if(document.fullscreenElement){try{document.exitFullscreen()}catch{}}showOriginal('editor');adoEditorPlayRun=false;document.getElementById('game')?.classList.remove('adoa-editor-play');adoUpdateInvincibleButton();requestAnimationFrame(()=>{buildGuides();renderNotes()});});
document.getElementById('gameFullscreenButton')?.addEventListener('click',async()=>{try{if(!document.fullscreenElement){await adoGamePanel.requestFullscreen();}else await document.exitFullscreen();}catch{adoGamePanel.classList.toggle('adoa-fallback-fullscreen');}});
// For editor preview, mark the game as an editor-play session and offer a direct return path.
const adoOldEditorPlayClick=document.getElementById('playAudio');if(adoOldEditorPlayClick){adoOldEditorPlayClick.onclick=()=>{
  const chart=chartSnapshot();chart.duration=Math.max(1,Number(document.getElementById('chartDurationInput')?.value)||adoEditorDuration||90);
  const title=(typeof currentProjectName==='string'&&currentProjectName&&currentProjectName!=='새 프로젝트')?currentProjectName:'에디터 채보';
  const sourceUrl=(typeof audioUrl==='string'&&audioUrl)?audioUrl:null;
  try{if(audio)audio.pause();}catch{}editorPlaying=false;cancelAnimationFrame(editorClockRAF);
  selectGameChart({title,artist:'에디터 미리보기',chart,audioUrl:sourceUrl,source:'editor-preview'});
  showOriginal('game');
  try{if(adoGamePanel?.requestFullscreen&&!document.fullscreenElement)adoGamePanel.requestFullscreen().catch(()=>{});}catch{}
  requestAnimationFrame(()=>{const ret=document.getElementById('gameReturnEditor');if(ret)ret.style.display='inline-flex';startGame();});
};}
// Set a stable gameplay duration on saved/auto charts where duration wasn't specified.
const adoOldSelectGameChart=selectGameChart;
selectGameChart=function(c){
  const copy=c?.chart?{...c,chart:{...c.chart}}:{...c};
  if(copy.chart&&!Number(copy.chart.duration)){const arr=copy.chart.notes||[];const last=arr.reduce((m,n)=>Math.max(m,Number(n.time)||0),0);copy.chart.duration=Math.max(1,copy.source==='generated'?Number(autoAudioDuration)||last+1.5:last+1.5);}
  adoOldSelectGameChart(copy);
  const screen=document.getElementById('game');screen?.classList.toggle('adoa-editor-play',copy.source==='editor-preview');
  const ret=document.getElementById('gameReturnEditor');if(ret)ret.style.display=copy.source==='editor-preview'?'inline-flex':'none';
  adoPrepareGameNotes();adoResetHUD();
};
// Do not let the editor preview play button also trigger the original browser-audio preview.


// Stable public bridge for the single editor subsystem. Keep mutable state inside this IIFE.
window.ADOAEditorAPI = {
  getNotes: () => notes,
  addNote: (note) => { if(!note || !Number.isFinite(Number(note.time))) return; addNote({...note, speed:Number(note.speed)||Math.max(.5,Math.min(10,Number($('#gameSpeed')?.value)||1))}); setProjectDirty?.(); },
  pushUndo: () => pushUndo(),
  markDirty: () => setProjectDirty(),
  renderNotes: () => renderNotes(),
  syncSelected: () => syncSelected(),
  getChart: () => chartSnapshot(),
  loadChart: (data) => { if(window.ADOAChartBridge?.loadChart) window.ADOAChartBridge.loadChart(data); else restoreSnapshot(data); },
  restoreSnapshot: (data) => restoreSnapshot(data),
  getSettings: () => ({gameSpeed:Number($('#gameSpeed')?.value)||1,chartDuration:Number($('#chartDurationInput')?.value)||90,editorOffsetMs:Number($('#editorOffsetMs')?.value??offset)||0,snap:!!$('#snap')?.checked,autosave:!!$('#autosave')?.checked,tips:!!$('#tips')?.checked,guidesVisible:window.adoaGuidesVisible!==false})
};
if(window.ADOAChartBridge){
  window.ADOAChartBridge.getCurrentChart = () => chartSnapshot();
  if(typeof window.ADOAChartBridge.loadChart==='function'){
    const previousBridgeLoad=window.ADOAChartBridge.loadChart;
    window.ADOAChartBridge.loadChart=function(data){previousBridgeLoad(data);const st=data?.settings||{};if(st.gameSpeed!=null&&$('#gameSpeed'))$('#gameSpeed').value=String(Math.max(.5,Math.min(10,Number(st.gameSpeed)||1)));if(st.chartDuration!=null&&$('#chartDurationInput'))$('#chartDurationInput').value=String(st.chartDuration);if(st.editorOffsetMs!=null&&$('#editorOffsetMs'))$('#editorOffsetMs').value=String(st.editorOffsetMs);if(st.snap!=null&&$('#snap'))$('#snap').checked=!!st.snap;if(st.autosave!=null&&$('#autosave'))$('#autosave').checked=!!st.autosave;if(st.tips!=null&&$('#tips'))$('#tips').checked=!!st.tips;if(st.guidesVisible!=null)window.adoaGuidesVisible=!!st.guidesVisible;const ns=window.getEditorNotes?.()||[];ns.forEach((n,i)=>n.speed=Number(data?.notes?.[i]?.speed)||Number(st.gameSpeed)||1);window.buildGuides?.();window.renderNotes?.();};
  }
}

})();
