/* A Dance Of Arrow: independent editor key viewer and editor-only Space deletion. */
(function ADOAFinalEditorCustomizations(){
  'use strict';
  const $=id=>document.getElementById(id);
  const field=$('chartDifficulty');
  const clampLevel=()=>Math.max(1,Math.min(20,Math.round(Number(field?.value)||1)));
  if(field){field.addEventListener('change',()=>{field.value=String(clampLevel());});field.addEventListener('blur',()=>{field.value=String(clampLevel());});}

  const defaults={4:['D','F','J','K'],6:['S','D','F','J','K','L'],8:['A','S','D','F','J','K','L',';']};
  const held=new Set();
  const readMappings=()=>{
    let stored={};try{stored=JSON.parse(localStorage.getItem('rf_keys')||'{}')||{}}catch{}
    const result={};
    for(const count of [4,6,8])result[count]=Array.from({length:count},(_,i)=>{
      const raw=String(stored[count]?.[i]??defaults[count][i]);
      return raw===' '||/^space(bar)?$/i.test(raw)?defaults[count][i]:raw;
    });
    return result;
  };
  let mappings=readMappings();
  const mappingFor=count=>mappings[count]||mappings[8];
  function editorActive(){return $('editor')?.classList.contains('active')===true;}
  function isTyping(target){return !!(target?.isContentEditable||target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]'));}
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
  function deleteSelected(){
    const api=window.ADOAEditorAPI;
    if(!api?.getSelectedNote?.())return false;
    try{if(api.deleteSelectedFast?.()===true)return true;}catch(err){console.error('[ADoA] Space delete failed',err);}
    const button=$('deleteNote');if(button){button.click();return true;}
    return false;
  }
  // Window capture runs before all gameplay handlers. Space is reserved globally:
  // it deletes only in the editor, and is inert in editor-preview/gameplay screens.
  window.addEventListener('keydown',e=>{
    const space=e.code==='Space'||e.key===' '||e.key==='Spacebar';
    if(space){
      const settingsCapturing=$('settings')?.classList.contains('active')&&[...document.querySelectorAll('#keyRows .key-row button')].some(button=>button.textContent==='키를 누르세요…');
      if(settingsCapturing)return; // Let the mapping listener reject Space and explain why.
      if(isTyping(e.target))return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      if(editorActive()&&!e.repeat)deleteSelected();
      return;
    }
    if(!editorActive()||isTyping(e.target)||e.repeat)return;
    mappings=readMappings();
    const count=Math.max(1,Math.min(8,Number($('keyCount')?.value)||8));
    const key=String(e.key).toUpperCase();
    if(mappingFor(count).some(k=>String(k).toUpperCase()===key)){held.add(key);refreshEditorViewer();}
  },true);
  window.addEventListener('keyup',e=>{
    held.delete(String(e.key).toUpperCase());
    if(editorActive())refreshEditorViewer();
  },true);
  window.addEventListener('blur',()=>{held.clear();refreshEditorViewer();});
  window.addEventListener('adoa-keymap-updated',()=>{mappings=readMappings();refreshEditorViewer();});
  $('keyCount')?.addEventListener('change',()=>{held.clear();mappings=readMappings();requestAnimationFrame(refreshEditorViewer);});
  $('editor')?.addEventListener('click',e=>{if(e.target?.closest?.('#keyCount'))requestAnimationFrame(refreshEditorViewer);});
  const observer=new MutationObserver(()=>{if(editorActive())refreshEditorViewer();});
  if($('editorTargets'))observer.observe($('editorTargets'),{childList:true});
  const style=document.createElement('style');style.id='adoa-editor-key-viewer-style';
  style.textContent=`#editor #editorTargets .editor-target{display:flex;align-items:center;justify-content:center;pointer-events:none}#editor #editorTargets .editor-key-label{display:flex;align-items:center;justify-content:center;min-width:25px;height:22px;padding:0 6px;border:1px solid #8293b4;border-radius:5px;background:#101a2b;color:#eaf0ff;font-size:11px;font-weight:900;opacity:.9}#editor #editorTargets .editor-target.pressed .editor-key-label{background:#43d9c4;color:#07121b;border-color:#d6fff8;transform:scale(1.12);box-shadow:0 0 12px #43d9c4aa}`;
  document.getElementById(style.id)?.remove();document.head.appendChild(style);
  requestAnimationFrame(refreshEditorViewer);
})();
