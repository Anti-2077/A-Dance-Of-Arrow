/* Offset persistence v9: one canonical millisecond value, independent of legacy editor listeners. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const INPUT_KEY='rf_offset';
 const SETTINGS_KEY='adoa_editor_settings_v9';
 const OLD_KEYS=['adoa_editor_settings_v8','adoa_editor_settings_v7','adoa_editor_settings_v5','adoa_editor_controls_v4'];
 const input=$('editorOffsetMs');
 if(!input)return;
 const read=()=>{const raw=String(input.value??'').trim();if(raw==='')return 0;const n=Number(raw);return Number.isFinite(n)?n:null};
 function writeLegacy(n){
   try{offset=n}catch{}
   try{if(typeof updateOffset==='function')updateOffset()}catch(e){console.warn('[Offset v9] legacy sync:',e)}
   try{localStorage.setItem(INPUT_KEY,String(n))}catch(e){console.warn('[Offset v9] offset storage:',e)}
 }
 function save(){
   const n=read(); if(n===null)return;
   writeLegacy(n);
   try{
     let data={};
     try{data=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}catch{}
     data={...data,version:3,offsetMs:n,controls:{...(data.controls||{}),editorOffsetMs:{type:'number',value:String(n)}}};
     localStorage.setItem(SETTINGS_KEY,JSON.stringify(data));
     // Update the compatibility keys so old code cannot resurrect a stale offset.
     for(const k of OLD_KEYS){
       try{let old=JSON.parse(localStorage.getItem(k)||'{}');old=old&&typeof old==='object'?old:{};old.offsetMs=n;old.controls={...(old.controls||{}),editorOffsetMs:{type:'number',value:String(n)}};localStorage.setItem(k,JSON.stringify(old))}catch{}
     }
     const snap=typeof window.chartSnapshot==='function'?window.chartSnapshot:null;
     if(snap && $('autosave')?.checked){const chart=snap();chart.offset=n;chart.editorOffsetMs=n;chart.settings={...(chart.settings||{}),editorOffsetMs:n};localStorage.setItem('rf_chart',JSON.stringify(chart));}
   }catch(e){console.warn('[Offset v9] settings save failed:',e)}
 }
 function apply(n, persist=true){
   if(!Number.isFinite(n))return;
   input.value=String(n);writeLegacy(n);
   if(persist)save();
   try{window.ADOAEditorAPI?.markDirty?.()}catch{}
   try{window.updateEditorViewport?.(Number($('seek')?.value)||0)}catch{}
 }
 // Capture at document level so older input listeners calling stopImmediatePropagation cannot block persistence.
 function onEdit(e){if(e.target!==input)return;save()}
 document.addEventListener('input',onEdit,true);
 document.addEventListener('change',onEdit,true);
 input.addEventListener('blur',save);
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();save();input.blur()}});
 window.addEventListener('pagehide',save);
 window.addEventListener('beforeunload',save);
 // Use the dedicated offset key first; migrate legacy values only when the dedicated key is absent.
 try{
   const dedicated=localStorage.getItem(INPUT_KEY);
   if(dedicated!==null && dedicated.trim()!=='' && Number.isFinite(Number(dedicated))) {
     apply(Number(dedicated),false);
   } else {
     let data=null;
     for(const key of [SETTINGS_KEY,...OLD_KEYS]){try{const raw=localStorage.getItem(key);if(raw){data=JSON.parse(raw);if(data)break}}catch{}}
     const candidate=data?.offsetMs??data?.controls?.editorOffsetMs?.value??data?.controls?.editorOffsetMs;
     if(candidate!==undefined&&Number.isFinite(Number(candidate)))apply(Number(candidate),false);
     else apply(Number(offset)||0,false);
   }
 }catch(e){console.warn('[Offset v9] restore failed:',e)}
 // Projects: ensure the exact editor field is serialized and restored, regardless of legacy wrappers.
 if(typeof window.chartSnapshot==='function'&&!window.chartSnapshot.__offsetV9){
   const old=window.chartSnapshot;
   const wrapped=function(){const chart=old.apply(this,arguments)||{};const n=read();const ms=n===null?(Number(offset)||0):n;chart.offset=ms;chart.editorOffsetMs=ms;chart.settings={...(chart.settings||{}),editorOffsetMs:ms};chart.editorSettings={...(chart.editorSettings||{}),offsetMs:ms,controls:{...(chart.editorSettings?.controls||{}),editorOffsetMs:{type:'number',value:String(ms)}}};return chart};
   wrapped.__offsetV9=true;window.chartSnapshot=wrapped;
 }
 if(typeof window.restoreSnapshot==='function'&&!window.restoreSnapshot.__offsetV9){
   const old=window.restoreSnapshot;
   const wrapped=function(raw){const data=typeof raw==='string'?JSON.parse(raw):raw;const result=old.apply(this,arguments);const candidate=data?.editorOffsetMs??data?.settings?.editorOffsetMs??data?.offset??data?.editorSettings?.offsetMs??data?.editorSettings?.controls?.editorOffsetMs?.value;if(candidate!==undefined&&Number.isFinite(Number(candidate)))apply(Number(candidate),true);else save();return result};
   wrapped.__offsetV9=true;window.restoreSnapshot=wrapped;
 }
 // One final normalization after all older startup restorers have run.
 const stored=localStorage.getItem(INPUT_KEY);
 if(stored!==null&&stored.trim()!==''&&Number.isFinite(Number(stored)))input.value=String(Number(stored));
 writeLegacy(read()===null?(Number(offset)||0):read());
})();
