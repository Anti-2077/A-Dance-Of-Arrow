(function ADOAEditorControlsV5(){
  'use strict';
  const $ = id => document.getElementById(id);
  const SETTINGS_KEY = 'adoa_editor_settings_v5';
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
  let saveTimer = 0;
  const skipIds = new Set(['audioFile','imageFiles','chartJsonFile']);

  function collectSettings(){
    const result={version:1,controls:{}};
    document.querySelectorAll('#editor input[id],#editor select[id],#editor textarea[id]').forEach(el=>{
      if(skipIds.has(el.id)||el.type==='file'||/invincible/i.test(el.id))return;
      if(el.type==='checkbox'||el.type==='radio')result.controls[el.id]={type:el.type,checked:!!el.checked};
      else result.controls[el.id]={type:el.type||el.tagName.toLowerCase(),value:el.value};
    });
    // The seek position is editor state; saving it makes the editor reopen at the same view.
    return result;
  }
  function applySettings(raw){
    if(!raw||typeof raw!=='object')return;
    const controls=raw.controls||raw;
    Object.entries(controls).forEach(([id,v])=>{
      if(id==='version'||skipIds.has(id)||/invincible/i.test(id)||!v||typeof v!=='object')return;
      const el=$(id);if(!el||el.type==='file')return;
      if(v.type==='checkbox'||v.type==='radio')el.checked=!!v.checked;
      else if(v.value!==undefined){
        let value=String(v.value);
        if(el.type==='range'||el.type==='number'){
          const n=Number(value);if(!Number.isFinite(n))return;
          const min=el.min!==''?Number(el.min):-Infinity,max=el.max!==''?Number(el.max):Infinity;
          value=String(clamp(n,min,max));
        }
        el.value=value;
      }
    });
  }
  function refresh(time){
    const t=Number.isFinite(Number(time))?Number(time):Number($('seek')?.value)||0;
    try{window.buildGuides?.()}catch(e){console.warn('[Editor v5] buildGuides:',e)}
    try{window.renderNotes?.()}catch(e){console.warn('[Editor v5] renderNotes:',e)}
    try{window.updateEditorViewport?.(t)}catch(e){console.warn('[Editor v5] viewport:',e)}
  }
  function persist(){
    try{
      const settings=collectSettings();
      localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));
      // Keep the existing autosave feature separate; settings persist even if autosave is off.
      if($('autosave')?.checked&&window.ADOAEditorAPI?.getChart){
        const chart=window.ADOAEditorAPI.getChart();
        chart.editorSettings=settings;
        localStorage.setItem('rf_chart',JSON.stringify(chart));
      }
    }catch(e){console.warn('[Editor v5] settings save failed:',e)}
  }
  function schedulePersist(){clearTimeout(saveTimer);saveTimer=setTimeout(persist,100)}

  function addStepper(input, className, step, min, max, format, onChange){
    if(!input||input.dataset.adoaStepper==='v5')return;
    input.dataset.adoaStepper='v5';
    const wrap=document.createElement('span');wrap.className=className;
    wrap.style.cssText='display:inline-flex;align-items:center;gap:5px;vertical-align:middle;white-space:nowrap;max-width:100%';
    const parent=input.parentNode;parent.insertBefore(wrap,input);wrap.appendChild(input);
    const label= format ? document.createElement('span') : null;
    if(label){label.className=className+'-value';label.style.cssText='min-width:38px;text-align:center;font-variant-numeric:tabular-nums';label.textContent=format(Number(input.value)||0)}
    function update(direction){
      const current=Number(input.value)||0;
      const decimals=(String(step).split('.')[1]||'').length;
      const lo=typeof min==='function'?Number(min()):Number(min);
      const hi=typeof max==='function'?Number(max()):Number(max);
      const next=clamp(Number((current+direction*step).toFixed(Math.max(1,decimals))),Number.isFinite(lo)?lo:-Infinity,Number.isFinite(hi)?hi:Infinity);
      input.value=String(next);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      if(label)label.textContent=format(Number(input.value)||0);
      onChange?.(Number(input.value));
    }
    function button(direction,text,title){
      const b=document.createElement('button');b.type='button';b.className='adoa-stepper-button';b.textContent=text;b.title=title;b.setAttribute('aria-label',title);
      b.style.cssText='min-width:30px;min-height:28px;padding:4px 7px;line-height:1;font-weight:800;flex:0 0 auto';
      b.addEventListener('click',()=>update(direction));return b;
    }
    wrap.insertBefore(button(-1,'◀','값 줄이기'),input);
    wrap.appendChild(button(1,'▶','값 늘리기'));
    if(label)wrap.appendChild(label);
    input.addEventListener('input',()=>{if(label)label.textContent=format(Number(input.value)||0)});
  }

  // Seek slider: 0.1-second steps by arrows; drag/keyboard changes update the viewport immediately.
  const seek=$('seek');
  if(seek){
    seek.step='0.01';
    addStepper(seek,'adoa-seek-stepper',0.1,()=>Number(seek.min)||0,()=>Number(seek.max)||600,null,t=>{
      if(window.audio&&Number.isFinite(window.audio.duration))try{window.audio.currentTime=Math.min(t,window.audio.duration)}catch{}
      try{window.updateEditorViewport?.(t)}catch(e){console.warn('[Editor v5] seek viewport:',e)}
      schedulePersist();
    });
    seek.addEventListener('input',()=>{
      const t=Math.max(0,Number(seek.value)||0);
      if(window.audio&&Number.isFinite(window.audio.duration)){try{window.audio.currentTime=Math.min(t,window.audio.duration)}catch{}}
      try{window.updateEditorViewport?.(t)}catch(e){console.warn('[Editor v5] seek viewport:',e)}
      schedulePersist();
    });
    seek.addEventListener('change',schedulePersist);
  }

  // Speed slider: arrow buttons and slider share the same native input/change events.
  const speed=$('gameSpeed');
  if(speed){
    speed.min='0.5';speed.max='10';speed.step='0.1';
    addStepper(speed,'adoa-speed-stepper',0.1,0.5,10,n=>n.toFixed(1)+'×',()=>{
      if($('gameSpeedValue'))$('gameSpeedValue').textContent=(Number(speed.value)||1).toFixed(1)+'×';
      refresh(Number($('seek')?.value)||0);schedulePersist();
    });
    speed.addEventListener('input',()=>{
      if($('gameSpeedValue'))$('gameSpeedValue').textContent=(Number(speed.value)||1).toFixed(1)+'×';
      refresh(Number($('seek')?.value)||0);schedulePersist();
    });
  }

  // Persist all editor form controls, independent of the autosave checkbox. Invincibility is excluded.
  const editor=$('editor');
  if(editor){
    editor.addEventListener('input',e=>{const el=e.target;if(el?.matches?.('input[id],select[id],textarea[id]')&&el.type!=='file'&&!/invincible/i.test(el.id))schedulePersist();});
    editor.addEventListener('change',e=>{const el=e.target;if(el?.matches?.('input[id],select[id],textarea[id]')&&el.type!=='file'&&!/invincible/i.test(el.id)){schedulePersist();if(['bpm','subdivision','keyCount','chartDurationInput','gameSpeed'].includes(el.id))refresh(Number($('seek')?.value)||0);}});
  }
  // Project snapshots carry editor preferences; wrapping the existing API keeps save/export callers compatible.
  if(typeof window.chartSnapshot==='function'&&!window.chartSnapshot.__v5){
    const oldSnapshot=window.chartSnapshot;
    const wrapped=function(){const chart=oldSnapshot.apply(this,arguments);chart.editorSettings=collectSettings();return chart};
    wrapped.__v5=true;window.chartSnapshot=wrapped;
  }
  if(typeof window.restoreSnapshot==='function'&&!window.restoreSnapshot.__v5){
    const oldRestore=window.restoreSnapshot;
    const wrapped=function(raw){
      const data=typeof raw==='string'?(()=>{try{return JSON.parse(raw)}catch{return null}})():raw;
      const result=oldRestore.apply(this,arguments);
      if(data?.editorSettings)applySettings(data.editorSettings);
      else if(data?.settings?.editorSettings)applySettings(data.settings.editorSettings);
      refresh(Number($('seek')?.value)||0);schedulePersist();return result;
    };
    wrapped.__v5=true;window.restoreSnapshot=wrapped;
  }
  // Restore the browser-local settings once. Do not touch invincibility or upload controls.
  try{const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null');if(saved)applySettings(saved)}catch(e){console.warn('[Editor v5] settings restore failed:',e)}
  if($('gameSpeedValue')&&$('gameSpeed'))$('gameSpeedValue').textContent=(Number($('gameSpeed').value)||1).toFixed(1)+'×';
  window.addEventListener('beforeunload',persist);
  window.addEventListener('pagehide',persist);
  requestAnimationFrame(()=>{refresh(Number($('seek')?.value)||0);persist()});
})();
