/* A Dance Of Arrow editor hotkeys: Backspace always deletes a selected note while editing. */
(function ADOAFinalEditorCustomizations(){
  'use strict';
  const $=id=>document.getElementById(id);
  const field=$('chartDifficulty');
  const clampLevel=()=>Math.max(1,Math.min(20,Math.round(Number(field?.value)||1)));
  if(field){
    field.addEventListener('change',()=>{field.value=String(clampLevel());});
    field.addEventListener('blur',()=>{field.value=String(clampLevel());});
  }
  // Window capture runs before gameplay/key-map handlers on document. This shortcut is
  // intentionally reserved for editor deletion and does not alter the saved game mapping.
  window.addEventListener('keydown',e=>{
    if((e.key!=='Backspace'&&e.code!=='Backspace')||e.repeat)return;
    if(!$('editor')?.classList.contains('active'))return;
    const target=e.target;
    if(target?.isContentEditable||target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]'))return;
    const api=window.ADOAEditorAPI;
    if(!api?.getSelectedNote?.())return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    let removed=false;
    try{removed=api.deleteSelectedFast()===true;}catch(err){console.error('[ADoA] Backspace delete failed',err);}
    if(!removed){
      const button=$('deleteNote');
      if(button){button.click();removed=true;}
    }
  },true);
})();
