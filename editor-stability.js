/* Rhythm Forge editor seek/offset v8: one canonical path, overriding older competing listeners. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const seek=$('seek'), offsetInput=$('editorOffsetMs');
 const SETTINGS_KEY='adoa_editor_settings_v8';
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 let seekFrame=0;
 function getTime(){return Math.max(0,Number(seek?.value)||0)}
 function setCurrentOffset(){
   if(!offsetInput)return 0;
   const raw=offsetInput.value.trim();
   const n=raw===''?0:Number(raw);
   if(!Number.isFinite(n))return Number(offset)||0;
   // The input and legacy gameplay variable are both milliseconds.
   try{offset=n}catch{}
   try{if(typeof updateOffset==='function')updateOffset()}catch(e){console.warn('[Editor v8] legacy offset sync failed',e)}
   try{localStorage.setItem('rf_offset',String(n))}catch{}
   return n;
 }
 function captureSettings(){
   const controls={};
   document.querySelectorAll('#editor input[id],#editor select[id],#editor textarea[id]').forEach(el=>{
     if(el.type==='file'||/invincible/i.test(el.id))return;
     controls[el.id]=(el.type==='checkbox'||el.type==='radio')?{type:el.type,checked:!!el.checked}:{type:el.type||el.tagName.toLowerCase(),value:el.value};
   });
   return {version:2,controls,offsetMs:setCurrentOffset(),seekTime:getTime()};
 }
 function persistSettings(){
   try{
     const data=captureSettings();
     localStorage.setItem(SETTINGS_KEY,JSON.stringify(data));
     // Keep older settings readers compatible without replacing the project/chart itself.
     localStorage.setItem('adoa_editor_settings_v7',JSON.stringify(data));
     return data;
   }catch(e){console.warn('[Editor v8] settings save failed',e);return null}
 }
 function applySettings(data){
   if(!data||typeof data!=='object')return;
   const controls=data.controls||data;
   for(const [id,v] of Object.entries(controls)){
     if(id==='version'||id==='offsetMs'||id==='seekTime'||!v||typeof v!=='object'||/invincible/i.test(id))continue;
     const el=$(id);if(!el||el.type==='file')continue;
     if(v.type==='checkbox'||v.type==='radio')el.checked=!!v.checked;
     else if(v.value!==undefined){
       let val=String(v.value);
       if(el.type==='number'||el.type==='range'){
         const num=Number(val);if(!Number.isFinite(num))continue;
         const min=el.min!==''?Number(el.min):-Infinity,max=el.max!==''?Number(el.max):Infinity;
         val=String(clamp(num,min,max));
       }
       el.value=val;
     }
   }
   const off=Number(data.offsetMs??data.controls?.editorOffsetMs?.value);
   if(Number.isFinite(off)&&offsetInput)offsetInput.value=String(off);
   if(Number.isFinite(Number(data.seekTime))&&seek){
     const t=clamp(Number(data.seekTime),Number(seek.min)||0,Number(seek.max)||600);
     seek.value=String(t);
   }
   setCurrentOffset();
 }
 function redrawAt(t){
   const time=Math.max(0,Number(t)||0);
   // Rendering is deliberately ordered: regenerate notes, then position the whole timeline at the same time.
   try{if(typeof window.renderNotes==='function')window.renderNotes()}catch(e){console.warn('[Editor v8] note render failed',e)}
   try{if(typeof window.updateEditorViewport==='function')window.updateEditorViewport(time)}catch(e){console.warn('[Editor v8] viewport update failed',e)}
   // Some legacy renderers update the seek value; keep the user's scrub position authoritative.
   if(seek && document.activeElement===seek)seek.value=String(time);
   const now=$('now');if(now)now.textContent=time.toFixed(3)+'s';
 }
 function onSeek(e){
   // Older versions registered several input handlers with conflicting viewport math.
   e.stopImmediatePropagation();
   const t=getTime();
   try{
     if(typeof audio!=='undefined'&&audio){
       const max=Number.isFinite(Number(audio.duration))?Number(audio.duration):t;
       audio.currentTime=clamp(t,0,max);
     }else if(typeof editorClock!=='undefined'){
       editorClock=t;
       if(typeof editorClockStart!=='undefined')editorClockStart=performance.now();
     }
   }catch(err){console.warn('[Editor v8] audio seek sync failed',err)}
   cancelAnimationFrame(seekFrame);
   // Run now for responsive scrubbing; a second frame catches layout/geometry changes from legacy code.
   redrawAt(t);
   seekFrame=requestAnimationFrame(()=>redrawAt(t));
   persistSettings();
 }
 if(seek&&!seek.dataset.v8Canonical){
   seek.dataset.v8Canonical='1';
   seek.addEventListener('input',onSeek,true);
   seek.addEventListener('change',onSeek,true);
 }
 function onOffset(e){
   e.stopImmediatePropagation();
   const n=setCurrentOffset();
   persistSettings();
   try{window.ADOAEditorAPI?.markDirty?.()}catch{}
   // A project snapshot is updated on explicit project save/export; autosave remains governed by its checkbox.
   try{redrawAt(getTime())}catch{}
   try{if($('autosave')?.checked&&typeof window.chartSnapshot==='function')localStorage.setItem('rf_chart',JSON.stringify(window.chartSnapshot()))}catch(err){console.warn('[Editor v8] chart autosave failed',err)}
 }
 if(offsetInput&&!offsetInput.dataset.v8Canonical){
   offsetInput.dataset.v8Canonical='1';
   offsetInput.addEventListener('input',onOffset,true);
   offsetInput.addEventListener('change',onOffset,true);
   offsetInput.addEventListener('blur',()=>{setCurrentOffset();persistSettings()});
 }
 // Save all ordinary editor controls in one place, but leave file input events alone.
 const editor=$('editor');
 if(editor&&!editor.dataset.v8CanonicalSave){
   editor.dataset.v8CanonicalSave='1';
   const onControl=e=>{
     const el=e.target;
     if(!el?.matches?.('input[id],select[id],textarea[id]')||el.type==='file'||el===seek||el===offsetInput||/invincible/i.test(el.id))return;
     persistSettings();
   };
   editor.addEventListener('input',onControl);
   editor.addEventListener('change',onControl);
 }
 // Ensure chart exports and explicit project saves always serialize the same offset value.
 if(typeof window.chartSnapshot==='function'&&!window.chartSnapshot.__v8Canonical){
   const old=window.chartSnapshot;
   const wrapped=function(){
     const chart=old.apply(this,arguments)||{};
     const ms=Number(offsetInput?.value);
     const safe=Number.isFinite(ms)?ms:0;
     chart.offset=safe;chart.editorOffsetMs=safe;
     chart.settings={...(chart.settings||{}),editorOffsetMs:safe};
     chart.editorSettings={...(chart.editorSettings||{}),...captureSettings(),offsetMs:safe};
     return chart;
   };
   wrapped.__v8Canonical=true;window.chartSnapshot=wrapped;
 }
 if(typeof window.restoreSnapshot==='function'&&!window.restoreSnapshot.__v8Canonical){
   const old=window.restoreSnapshot;
   const wrapped=function(raw){
     const data=typeof raw==='string'?JSON.parse(raw):raw;
     const result=old.apply(this,arguments);
     const ms=Number(data?.editorOffsetMs??data?.settings?.editorOffsetMs??data?.offset??data?.editorSettings?.offsetMs);
     if(Number.isFinite(ms)&&offsetInput)offsetInput.value=String(ms);
     if(data?.editorSettings)applySettings(data.editorSettings);
     setCurrentOffset();persistSettings();
     const t=Number(data?.editorSettings?.seekTime??seek?.value)||0;
     requestAnimationFrame(()=>redrawAt(t));
     return result;
   };
   wrapped.__v8Canonical=true;window.restoreSnapshot=wrapped;
 }
 // Migrate older settings once. Current project snapshots still restore through restoreSnapshot above.
 try{
   const saved=localStorage.getItem(SETTINGS_KEY)||localStorage.getItem('adoa_editor_settings_v7')||localStorage.getItem('adoa_editor_settings_v5')||localStorage.getItem('adoa_editor_controls_v4');
   if(saved)applySettings(JSON.parse(saved));
 }catch(e){console.warn('[Editor v8] settings restore failed',e)}
 setCurrentOffset();
 // Do not rebuild the grid continuously while the user is dragging the seek bar.
 requestAnimationFrame(()=>redrawAt(getTime()));
 window.addEventListener('pagehide',persistSettings);
 window.addEventListener('beforeunload',persistSettings);
})();
