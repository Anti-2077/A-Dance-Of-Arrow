/* A Dance Of Arrow: isolated editor key viewer and Backspace deletion. */
(function ADOAFinalEditorCustomizations(){
  'use strict';
  const $=id=>document.getElementById(id);
  const field=$('chartDifficulty');
  const clampLevel=()=>Math.max(1,Math.min(20,Math.round(Number(field?.value)||1)));
  if(field){field.addEventListener('change',()=>{field.value=String(clampLevel());});field.addEventListener('blur',()=>{field.value=String(clampLevel());});}

  // The editor receptor/key viewer owns its own held-key state. It does not read or
  // write the gameplay handler's held-key Set, so the two screens cannot cross-trigger.
  const held=new Set();
  const readMappings=()=>{
    try{return JSON.parse(localStorage.getItem('rf_keys')||'{}')}catch{return {}}
  };
  const mappingFor=count=>{
    const all=readMappings();
    const fallback={4:['D','F','J','K'],6:['S','D','F','J','K','L'],8:['A','S','D','F','J','K','L',';']};
    return all[count]||fallback[count]||fallback[8];
  };
  function refreshEditorViewer(){
    const root=$('editorTargets');if(!root)return;
    const count=Math.max(1,Math.min(8,Number($('keyCount')?.value)||8));
    const map=mappingFor(count);
    [...root.querySelectorAll('.editor-target')].forEach((el,i)=>{
      const key=String(map[i]??'').toUpperCase();
      let label=el.querySelector('.editor-key-label');
      if(!label){label=document.createElement('span');label.className='editor-key-label';el.appendChild(label);}
      label.textContent=key;
      el.classList.toggle('pressed',held.has(key));
    });
  }
  function editorActive(){return $('editor')?.classList.contains('active')===true;}
  window.addEventListener('keydown',e=>{
    if(!editorActive())return;
    const target=e.target;
    const typing=target?.isContentEditable||target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]');
    if((e.key==='Backspace'||e.code==='Backspace')&&!e.repeat&&!typing){
      const api=window.ADOAEditorAPI;
      if(api?.getSelectedNote?.()){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        try{if(!api.deleteSelectedFast?.())$('deleteNote')?.click();}catch(err){console.error('[ADoA] editor Backspace failed',err);$('deleteNote')?.click();}
      }
      return;
    }
    if(typing||e.repeat)return;
    const count=Math.max(1,Math.min(8,Number($('keyCount')?.value)||8));
    const map=mappingFor(count).map(k=>String(k).toUpperCase());
    const key=String(e.key).toUpperCase();
    if(map.includes(key)){held.add(key);refreshEditorViewer();}
  },true);
  window.addEventListener('keyup',e=>{held.delete(String(e.key).toUpperCase());if(editorActive())refreshEditorViewer();},true);
  window.addEventListener('blur',()=>{held.clear();refreshEditorViewer();});
  $('keyCount')?.addEventListener('change',()=>{held.clear();requestAnimationFrame(refreshEditorViewer);});
  $('editor')?.addEventListener('click',e=>{if(e.target?.closest?.('#keyCount'))requestAnimationFrame(refreshEditorViewer);});
  const observer=new MutationObserver(()=>{if(editorActive())refreshEditorViewer();});
  if($('editorTargets'))observer.observe($('editorTargets'),{childList:true});
  const style=document.createElement('style');style.id='adoa-editor-key-viewer-style';
  style.textContent=`#editor #editorTargets .editor-target{display:flex;align-items:center;justify-content:center;pointer-events:none}#editor #editorTargets .editor-key-label{display:flex;align-items:center;justify-content:center;min-width:25px;height:22px;padding:0 6px;border:1px solid #8293b4;border-radius:5px;background:#101a2b;color:#eaf0ff;font-size:11px;font-weight:900;opacity:.9}#editor #editorTargets .editor-target.pressed .editor-key-label{background:#43d9c4;color:#07121b;border-color:#d6fff8;transform:scale(1.12);box-shadow:0 0 12px #43d9c4aa}`;
  document.getElementById(style.id)?.remove();document.head.appendChild(style);
  requestAnimationFrame(refreshEditorViewer);
})();
