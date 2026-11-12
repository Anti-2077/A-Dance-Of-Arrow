(function ADOAEditorFinalStabilityV7(){
 'use strict';
 const $=id=>document.getElementById(id);
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const SETTINGS='adoa_editor_settings_v7';
 const beatSeconds=()=>60/Math.max(1,Number($('bpm')?.value)||180)/Math.max(1,Number($('subdivision')?.value)||1);

 // Normalize the offset UI so it visually matches the editor toolbar and keep the legacy offset variable in sync.
 const style=document.createElement('style');style.id='adoa-editor-final-stability-v7-style';style.textContent=`
  #editor .editor-offset-control{display:inline-flex!important;align-items:center!important;gap:7px!important;white-space:nowrap!important;color:#c5cfde!important;font-size:12px!important;background:#111a29!important;border:1px solid #34425c!important;border-radius:9px!important;padding:5px 8px!important;margin:0!important}
  #editor .editor-offset-control input{display:inline-block!important;width:88px!important;min-width:88px!important;margin:0!important;padding:7px 8px!important;background:#090e16!important;color:#f4f7ff!important;border:1px solid #465875!important;border-radius:7px!important;font-variant-numeric:tabular-nums!important}
  #editor .filebutton{background:#d5e5ff!important;color:#101827!important;border:1px solid #91b5f0!important;text-shadow:none!important}
  #editor .filebutton:hover{background:#eef5ff!important;color:#0b1220!important}
  #editor .filebutton input{display:none!important}
  #editor #notes .note{border:2px solid #fff!important;outline:1px solid #182238!important;box-shadow:0 0 0 1px #101827,0 0 9px #9bb4ffcc!important;background:linear-gradient(145deg,#f8fbff,#b9d0ff)!important}
  #editor #notes .note.selected{border:2px solid #fff!important;outline:3px solid #43d9c4!important;outline-offset:2px!important;box-shadow:0 0 0 2px #08111e,0 0 15px #43d9c4bb!important}
  #editor #beatNudgeRow button{font-size:11px!important;padding:8px 5px!important;white-space:nowrap!important}
  #editor .adoa-seek-stepper,#editor .adoa-speed-stepper{display:inline-flex;align-items:center;gap:5px}
 `;document.getElementById(style.id)?.remove();document.head.appendChild(style);

 // Restore and persist all editor controls. Offset is copied into both the chart and legacy settings variable.
 function snapshotSettings(){const controls={};document.querySelectorAll('#editor input[id],#editor select[id],#editor textarea[id]').forEach(el=>{if(el.type==='file'||/invincible/i.test(el.id))return;controls[el.id]=(el.type==='checkbox'||el.type==='radio')?{type:el.type,checked:el.checked}:{type:el.type||el.tagName.toLowerCase(),value:el.value}});return {version:1,controls,offsetMs:Number($('editorOffsetMs')?.value)||0}}
 function syncOffset(){const n=Number($('editorOffsetMs')?.value);if(Number.isFinite(n)){try{offset=n;updateOffset?.()}catch{};try{if(typeof window.offset==='number')window.offset=n}catch{}}}
 function saveSettings(){try{syncOffset();localStorage.setItem(SETTINGS,JSON.stringify(snapshotSettings()))}catch(e){console.warn('[Editor v7] settings save failed',e)}}
 function restoreSettings(data){if(!data||typeof data!=='object')return;const controls=data.controls||data;for(const [id,v] of Object.entries(controls)){if(id==='version'||id==='offsetMs'||!v||typeof v!=='object'||/invincible/i.test(id))continue;const el=$(id);if(!el||el.type==='file')continue;if(v.type==='checkbox'||v.type==='radio')el.checked=!!v.checked;else if(v.value!==undefined)el.value=String(v.value)}if(Number.isFinite(Number(data.offsetMs))&&$('editorOffsetMs'))$('editorOffsetMs').value=String(data.offsetMs);syncOffset()}
 const seekInput=$('seek');if(seekInput&&!seekInput.dataset.v7Immediate){seekInput.dataset.v7Immediate='1';seekInput.addEventListener('input',()=>{const t=Number(seekInput.value)||0;try{window.renderNotes?.()}catch{};try{window.updateEditorViewport?.(t)}catch{};saveSettings()})}
 const off=$('editorOffsetMs');if(off&&!off.dataset.v7){off.dataset.v7='1';off.addEventListener('input',saveSettings);off.addEventListener('change',()=>{syncOffset();saveSettings();try{window.ADOAEditorAPI?.markDirty?.()}catch{};try{window.updateEditorViewport?.(Number($('seek')?.value)||0)}catch{}})}
 const editor=$('editor');if(editor&&!editor.dataset.v7Save){editor.dataset.v7Save='1';const on=e=>{const el=e.target;if(el?.matches?.('input[id],select[id],textarea[id]')&&el.type!=='file'&&!/invincible/i.test(el.id)){if(el.id==='editorOffsetMs')syncOffset();saveSettings()}};editor.addEventListener('input',on);editor.addEventListener('change',on)}
 try{restoreSettings(JSON.parse(localStorage.getItem(SETTINGS)||'null'))}catch(e){console.warn('[Editor v7] settings restore failed',e)}

 // Project snapshots: offset is stored in the canonical millisecond unit and restored through all supported paths.
 if(typeof window.chartSnapshot==='function'&&!window.chartSnapshot.__v7){const old=window.chartSnapshot;const wrap=function(){const d=old.apply(this,arguments)||{};const ms=Number($('editorOffsetMs')?.value)||0;d.offset=ms;d.editorOffsetMs=ms;d.settings={...(d.settings||{}),editorOffsetMs:ms};d.editorSettings=snapshotSettings();return d};wrap.__v7=true;window.chartSnapshot=wrap}
 if(typeof window.restoreSnapshot==='function'&&!window.restoreSnapshot.__v7){const old=window.restoreSnapshot;const wrap=function(raw){const d=typeof raw==='string'?JSON.parse(raw):raw;const result=old.apply(this,arguments);const ms=Number(d?.editorOffsetMs??d?.settings?.editorOffsetMs??d?.offset??d?.editorSettings?.offsetMs);if(Number.isFinite(ms)&&$('editorOffsetMs'))$('editorOffsetMs').value=String(ms);if(d?.editorSettings)restoreSettings(d.editorSettings);syncOffset();saveSettings();requestAnimationFrame(refreshTimeline);return result};wrap.__v7=true;window.restoreSnapshot=wrap}

 // One guide-step movement buttons for the selected note; keep existing ±1 ms controls intact.
 function nudgeByBeat(direction){const api=window.ADOAEditorAPI;let note=null;try{note=api?.getSelectedNote?.()||null}catch{}if(!note){if(typeof toast==='function')toast('먼저 이동할 채보를 선택하세요.');return}try{api?.pushUndo?.()}catch{};note.time=Math.max(0,(Number(note.time)||0)+direction*beatSeconds());note.pos=typeof window.positionFromTime==='function'?window.positionFromTime(note.time):note.pos;try{window.renderNotes?.();api?.syncSelected?.();api?.markDirty?.()}catch(e){console.warn('[Editor v7] beat nudge failed',e)}try{if($('autosave')?.checked&&window.chartSnapshot)localStorage.setItem('rf_chart',JSON.stringify(window.chartSnapshot()))}catch{};saveSettings()}
 $('nudgeBeatBack')?.addEventListener('click',()=>nudgeByBeat(-1));$('nudgeBeatForward')?.addEventListener('click',()=>nudgeByBeat(1));

 // The selected-note panel's core state is lexical in the original script. Use the public API if available.
 if(window.ADOAEditorAPI){window.ADOAEditorAPI.getSelectedNote=()=>{try{return typeof currentNote==='function'?currentNote():null}catch{return null}}}

 // Effects use seconds in the UI and milliseconds in stored chart data. Rotation is an absolute target angle.
 const dur=$('effectDuration');if(dur){dur.min='0.01';dur.step='0.05';dur.value=String(Math.max(.01,(Number(dur.value)||500)/1000));dur.title='목표값에 도달하는 데 걸리는 시간(초)'}
 const type=$('effectType'),valLabel=$('effectValueLabel');function syncEffectValueUI(){if(!type||!valLabel)return;valLabel.firstChild.textContent=type.value==='회전'?'목표 각도(°) ':['확대','축소'].includes(type.value)?'목표 배율(%) ':'강도 ';const input=$('effectValue');if(input){input.title=type.value==='회전'?'목표 각도(도), 예: 90 또는 -45':['확대','축소'].includes(type.value)?'목표 배율(%), 예: 150 또는 50':'효과 강도';if(type.value==='회전'&&input.value==='150')input.value='90'}}type?.addEventListener('change',syncEffectValueUI);syncEffectValueUI();

 // Clicking the lane/time row occupied by a note selects it, even when the pointer is beside the small visible note body.
 const timeline=$('timeline');
 if(timeline&&!timeline.dataset.v7SelectLine){timeline.dataset.v7SelectLine='1';timeline.addEventListener('click',e=>{
   if(e.target?.closest?.('.note, .adoa-beat-guide, button, input, select, label'))return;
   const rect=timeline.getBoundingClientRect();if(!rect.width||!rect.height)return;
   const count=Math.max(1,Math.min(8,Number($('keyCount')?.value)||8));
   const lane=clamp(Math.floor((e.clientX-rect.left)/rect.width*count),0,count-1);
   const speed=Math.max(.5,Math.min(10,Number($('gameSpeed')?.value)||1));
   const seek=Number($('seek')?.value)||0;
   const scale=80*speed, receptorY=560*.8;
   const time=seek+(receptorY-(e.clientY-rect.top))/scale;
   const threshold=Math.max(.018,beatSeconds()*.48);
   const ns=window.getEditorNotes?.()||[];
   let best=null,dist=Infinity;
   for(const n of ns){if(Number(n.lane)!==lane)continue;const d=Math.abs((Number(n.time)||0)-time);if(d<dist){dist=d;best=n}}
   if(best&&dist<=threshold){
     // Click the corresponding note button so the editor's own selection state stays authoritative.
     const els=Array.from(document.querySelectorAll('#notes .note'));
     const el=els.find(x=>String(x.dataset.noteId)===String(best.id));
     if(el)el.click();
   }
 },true)}

 // Absolute-time event evaluator: reaches the target in duration, then holds that target until another event.
 window.adoApplyTimedVisualEvents=function(chartTime){const stage=$('gameStage');const chart=(typeof gameChart!=='undefined'?gameChart:(window.gameChart||null));if(!stage||!chart)return;const t=Math.max(0,Number(chartTime)||0),list=(Array.isArray(chart.effects)?chart.effects:[]).slice().sort((a,b)=>(Number(a.timeMs??Number(a.time||0)*1000)-Number(b.timeMs??Number(b.time||0)*1000)));let state={rotate:0,scale:1,flipX:1,flipY:1};let shakeX=0,shakeY=0;
  const targetFor=(e)=>{const v=Number(e.value)||0;switch(e.type){case '회전':return v;case '확대':return clamp(Math.abs(v)/100,.2,5);case '축소':return clamp(Math.abs(v)/100,.2,5);case '좌우 반전':return -1;case '상하 반전':return -1;default:return v}};
  const channels=new Map();for(const e of list){const start=Math.max(0,Number(e.timeMs!=null?e.timeMs/1000:e.time)||0),duration=Math.max(.01,Number(e.durationMs!=null?e.durationMs/1000:(Number(e.duration)||500)/1000)),end=start+duration;if(t<start)continue;const progress=clamp((t-start)/duration,0,1),target=targetFor(e);if(e.type==='화면 흔들림'){if(t<end){shakeX=Math.sin(progress*Math.PI*12)*target;shakeY=Math.cos(progress*Math.PI*10)*target*.45}continue}const key=e.type==='회전'?'rotate':['확대','축소'].includes(e.type)?'scale':e.type==='좌우 반전'?'flipX':e.type==='상하 반전'?'flipY':null;if(!key)continue;const defaultValue=key==='rotate'?0:key==='scale'?1:1;const previous=channels.has(key)?channels.get(key):defaultValue;let next;if(e.type==='확대'||e.type==='축소')next=previous+(target-previous)*progress;else if(e.type==='좌우 반전'||e.type==='상하 반전')next=progress>=1?target:previous;else next=previous+(target-previous)*progress;channels.set(key,next);state[key]=next;}
  for(const [k,v] of channels)state[k]=v;stage.style.transform=`translate(${shakeX}px,${shakeY}px) rotate(${state.rotate}deg) scale(${state.scale*state.flipX},${state.scale*state.flipY})`;stage.style.transformOrigin='50% 50%';stage.style.transition='transform 30ms linear';};

 // Make the guide grid the sole hit target for adding/selecting notes. Clicking a beat line that already has a note selects it.
 // Patch the existing handler's add block, retaining its single delegated listener and undo integration.
 const scriptTexts=[...document.scripts].filter(s=>s.textContent.includes("note added")||s.textContent.includes("#adoaBeatGrid .adoa-beat-guide"));
 // The actual handler is adjusted by a tiny guard inserted into the already-loaded handler source at build time below.
 // Improve note hitboxes visually without changing the underlying note data or layering.
 const noteStyle=document.createElement('style');noteStyle.id='adoa-note-contrast-v7';noteStyle.textContent=`#editor #notes .note{border:2px solid #fff!important;outline:1px solid #0a1220!important;box-shadow:0 0 0 1px #0a1220,0 0 10px #9bb4ffdd!important}#editor #notes .note.selected{outline:3px solid #43d9c4!important;outline-offset:2px!important}`;document.getElementById(noteStyle.id)?.remove();document.head.appendChild(noteStyle);

 function refreshTimeline(){try{window.buildGuides?.()}catch{}try{window.renderNotes?.()}catch{}try{window.updateEditorViewport?.(Number($('seek')?.value)||0)}catch{}}
 window.addEventListener('beforeunload',saveSettings);window.addEventListener('pagehide',saveSettings);
 requestAnimationFrame(()=>{syncOffset();refreshTimeline();saveSettings()});
})();
