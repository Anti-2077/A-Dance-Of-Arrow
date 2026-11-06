/* A Dance Of Arrow: keyboard deletion and numeric difficulty input guard. */
(function ADOAFinalEditorCustomizations(){
  'use strict';
  const $=id=>document.getElementById(id);
  const field=$('chartDifficulty');
  const clampLevel=()=>Math.max(1,Math.min(20,Math.round(Number(field?.value)||1)));
  if(field){
    field.addEventListener('blur',()=>{field.value=String(clampLevel());});
    field.addEventListener('change',()=>{field.value=String(clampLevel());});
  }
  // Backspace deletes only a selected note, never text inside an input/editor.
  document.addEventListener('keydown',e=>{
    if(e.key!=='Backspace'||e.repeat||!$('editor')?.classList.contains('active'))return;
    const target=e.target;
    if(target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName||''))return;
    if(!window.ADOAEditorAPI?.getSelectedNote?.())return;
    e.preventDefault();e.stopPropagation();
    if(!window.ADOAEditorAPI.deleteSelectedFast())$('deleteNote')?.click();
  },true);
})();
