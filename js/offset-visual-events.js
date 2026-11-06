(function ADOAOffsetAndVisualEventsFixV6(){
  'use strict';
  const $ = id => document.getElementById(id);
  const SETTINGS_KEY = 'adoa_editor_settings_v5';
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
  function editorOffset(){const n=Number($('editorOffsetMs')?.value);return Number.isFinite(n)?n:(Number(window.offset)||0)}
  function readEditorSettings(){
    const controls={};
    document.querySelectorAll('#editor input[id],#editor select[id],#editor textarea[id]').forEach(el=>{
      if(el.type==='file'||/invincible/i.test(el.id))return;
      controls[el.id]=(el.type==='checkbox'||el.type==='radio')?{type:el.type,checked:!!el.checked}:{type:el.type||el.tagName.toLowerCase(),value:el.value};
    });
    return {version:1,controls};
  }
  function saveLocalSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(readEditorSettings()))}catch(e){console.warn('[Editor v6] settings save failed',e)}}
  function applySettings(raw){
    if(!raw||typeof raw!=='object')return;
    const controls=raw.controls||raw;
    Object.entries(controls).forEach(([id,v])=>{
      if(id==='version'||!v||typeof v!=='object'||/invincible/i.test(id))return;
      const el=$(id);if(!el||el.type==='file')return;
      if(v.type==='checkbox'||v.type==='radio')el.checked=!!v.checked;
      else if(v.value!==undefined){let value=String(v.value);if(el.type==='number'||el.type==='range'){const n=Number(value);if(!Number.isFinite(n))return;value=String(clamp(n,el.min!==''?Number(el.min):-Infinity,el.max!==''?Number(el.max):Infinity))}el.value=value}
    });
  }
  function refresh(){try{window.buildGuides?.()}catch(e){console.warn('[Editor v6] guides',e)}try{window.renderNotes?.()}catch(e){console.warn('[Editor v6] notes',e)}try{window.updateEditorViewport?.(Number($('seek')?.value)||0)}catch(e){console.warn('[Editor v6] viewport',e)}}

  // Project save and JSON export both use chartSnapshot; normalize offset from the actual editor field.
  if(typeof window.chartSnapshot==='function'&&!window.chartSnapshot.__adoaV6){
    const old=window.chartSnapshot;
    const wrapped=function(){const chart=old.apply(this,arguments)||{};const ms=editorOffset();chart.offset=ms;chart.editorOffsetMs=ms;chart.settings={...(chart.settings||{}),editorOffsetMs:ms,gameSpeed:Number($('gameSpeed')?.value)||1,chartDuration:Number($('chartDurationInput')?.value)||90,snap:!!$('snap')?.checked,autosave:!!$('autosave')?.checked,tips:!!$('tips')?.checked,guidesVisible:window.adoaGuidesVisible!==false};chart.editorSettings=readEditorSettings();return chart};
    wrapped.__adoaV6=true;window.chartSnapshot=wrapped;
  }
  // Apply offset consistently after every project restore.
  if(typeof window.restoreSnapshot==='function'&&!window.restoreSnapshot.__adoaV6){
    const old=window.restoreSnapshot;
    const wrapped=function(raw){const data=typeof raw==='string'?JSON.parse(raw):raw;const result=old.apply(this,arguments);const ms=Number(data?.editorOffsetMs??data?.settings?.editorOffsetMs??data?.offset);if(Number.isFinite(ms)){if($('editorOffsetMs'))$('editorOffsetMs').value=String(ms);if(typeof window.offset==='number')window.offset=ms}applySettings(data?.editorSettings||data?.settings?.editorSettings);refresh();saveLocalSettings();return result};
    wrapped.__adoaV6=true;window.restoreSnapshot=wrapped;
  }
  const offsetInput=$('editorOffsetMs');
  if(offsetInput&&!offsetInput.dataset.adoaV6){offsetInput.dataset.adoaV6='1';const sync=()=>{const ms=editorOffset();if(typeof window.offset==='number')window.offset=ms;saveLocalSettings();try{window.ADOAEditorAPI?.markDirty?.()}catch{};try{window.updateEditorViewport?.(Number($('seek')?.value)||0)}catch{}};offsetInput.addEventListener('input',sync);offsetInput.addEventListener('change',sync)}
  const editor=$('editor');
  if(editor&&!editor.dataset.adoaV6Settings){editor.dataset.adoaV6Settings='1';const onChange=e=>{const el=e.target;if(el?.matches?.('input[id],select[id],textarea[id]')&&el.type!=='file'&&!/invincible/i.test(el.id))saveLocalSettings()};editor.addEventListener('input',onChange);editor.addEventListener('change',onChange)}
  try{const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null');if(saved)applySettings(saved)}catch(e){console.warn('[Editor v6] settings restore failed',e)}

  // Export from the canonical project snapshot so chart offset comes from editorOffsetMs, not the global settings offset.
  const exportButton=$('saveChart');
  if(exportButton&&!exportButton.dataset.adoaV6Export){
    exportButton.dataset.adoaV6Export='1';
    exportButton.onclick=()=>{
      try{
        const data=window.chartSnapshot();
        data.offset=editorOffset();data.editorOffsetMs=editorOffset();
        const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob);const a=document.createElement('a');
        a.href=url;a.download='rhythm-chart.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        if(typeof toast==='function')toast('채보와 오프셋 설정을 내보냈습니다.');
      }catch(err){console.error('[Editor v6] chart export failed',err);if(typeof toast==='function')toast('채보 내보내기에 실패했습니다.');}
    };
  }

  // Absolute-time visual effects: preview/seek and live play use the same calculation.
  window.adoApplyTimedVisualEvents=function(chartTime){
    const stage=$('gameStage');const chart=(typeof gameChart!=='undefined'?gameChart:null);if(!stage||!chart)return;
    const list=Array.isArray(chart.effects)?chart.effects:[],t=Math.max(0,Number(chartTime)||0);
    let rotate=0,scale=1,flipX=1,flipY=1,shakeX=0,shakeY=0;
    for(const e of list){
      const start=Number(e.timeMs!=null?e.timeMs/1000:e.time)||0;
      const duration=Math.max(.001,Number(e.durationMs!=null?e.durationMs/1000:(Number(e.duration)||500)/1000)||.5);
      if(t<start||t>=start+duration)continue;
      const progress=clamp((t-start)/duration,0,1),v=Number(e.value)||0;
      switch(e.type){
        case '회전': rotate+=v*progress;break;
        case '확대': {const target=clamp(Math.abs(v)/100,.2,5);scale=Math.max(scale,1+(target-1)*progress);break}
        case '축소': {const target=clamp(Math.abs(v)/100,.2,5);scale=Math.min(scale,1+(target-1)*progress);break}
        case '좌우 반전': if(progress>=.5)flipX=-1;break;
        case '상하 반전': if(progress>=.5)flipY=-1;break;
        case '화면 흔들림': shakeX=Math.sin(progress*Math.PI*12)*v;shakeY=Math.cos(progress*Math.PI*10)*v*.45;break;
      }
    }
    stage.style.transform=`translate(${shakeX}px,${shakeY}px) rotate(${rotate}deg) scale(${scale*flipX},${scale*flipY})`;
    stage.style.transformOrigin='50% 50%';stage.style.transition='transform 40ms linear';
  };
  window.addEventListener('beforeunload',saveLocalSettings);window.addEventListener('pagehide',saveLocalSettings);
  requestAnimationFrame(()=>{refresh();saveLocalSettings()});
})();
