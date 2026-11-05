/* Offset persistence v10: restore from a key that legacy startup code never overwrites. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const input=$('editorOffsetMs');
 const CANON='adoa_offset_canonical_v10';
 const LEGACY_SETTINGS=['adoa_editor_settings_v9','adoa_editor_settings_v8','adoa_editor_settings_v7','adoa_editor_settings_v5','adoa_editor_controls_v4'];
 function valid(v){if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
 function getSaved(){
   try { const n=valid(localStorage.getItem(CANON)); if(n!==null)return n; } catch{}
   for(const k of LEGACY_SETTINGS){try{const d=JSON.parse(localStorage.getItem(k)||'null');const n=valid(d?.offsetMs??d?.controls?.editorOffsetMs?.value??d?.controls?.editorOffsetMs);if(n!==null)return n;}catch{}}
   try{return valid(localStorage.getItem('rf_offset'))}catch{return null}
 }
 function store(n){
   if(!Number.isFinite(n))return;
   try{localStorage.setItem(CANON,String(n));localStorage.setItem('rf_offset',String(n));}catch(e){console.warn('[Offset v10] local storage failed',e)}
   try{if(typeof window.__setRhythmForgeOffset==='function')window.__setRhythmForgeOffset(n);else window.offset=n}catch{}
   try{if(input && input.value!==String(n))input.value=String(n)}catch{}
   try{const d=JSON.parse(localStorage.getItem('adoa_editor_settings_v9')||'{}');d.offsetMs=n;d.controls={...(d.controls||{}),editorOffsetMs:{type:'number',value:String(n)}};localStorage.setItem('adoa_editor_settings_v9',JSON.stringify(d))}catch{}
 }
 function current(){
   if(input){const n=valid(input.value);if(n!==null)return n;}
   try{const n=valid(typeof window.__getRhythmForgeOffset==='function'?window.__getRhythmForgeOffset():window.offset);if(n!==null)return n}catch{}
   return 0;
 }
 function saveEditor(){const n=current();store(n);try{window.ADOAEditorAPI?.markDirty?.()}catch{};try{window.updateEditorViewport?.(Number($('seek')?.value)||0)}catch{}}
 // Restore AFTER all legacy scripts have run. Canonical key has priority over keys
 // that older startup handlers may accidentally reset to zero.
 const saved=getSaved();
 if(saved!==null){if(input)input.value=String(saved);store(saved)}
 // IMPORTANT: older v8 code calls stopImmediatePropagation() on the input
 // element itself. A listener attached to that same element can therefore be
 // skipped. Listen at DOCUMENT capture phase, before the event reaches the input.
 document.addEventListener('input',e=>{if(e.target===input)saveEditor()},true);
 document.addEventListener('change',e=>{if(e.target===input)saveEditor()},true);
 document.addEventListener('focusout',e=>{if(e.target===input)saveEditor()},true);
 document.addEventListener('keydown',e=>{if(e.target===input&&e.key==='Enter')saveEditor()},true);
 // The settings-page +/-/reset buttons change the global offset. Sync that value
 // back into the editor field after their existing click handlers have completed.
 document.addEventListener('click',e=>{
   const id=e.target?.closest?.('#offsetMinus,#offsetPlus,#offsetReset')?.id;
   if(!id)return;
   queueMicrotask(()=>{const n=valid(window.offset);if(n!==null)store(n)});
 });
 window.addEventListener('pagehide',saveEditor);
 window.addEventListener('beforeunload',saveEditor);
 // Keep the canonical value in chart/project snapshots too.
 if(typeof window.chartSnapshot==='function'&&!window.chartSnapshot.__offsetV10){
   const old=window.chartSnapshot;const wrapped=function(){const d=old.apply(this,arguments)||{};const n=current();d.offset=n;d.editorOffsetMs=n;d.settings={...(d.settings||{}),editorOffsetMs:n};return d};wrapped.__offsetV10=true;window.chartSnapshot=wrapped;
 }
})();
