/* Rhythm Forge editor subsystem v3
   One grid layer, one click handler, one time-to-pixel mapping, one render wrapper. */
(function RhythmForgeEditorSubsystem(){
  'use strict';
  const $ = id => document.getElementById(id);
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  const timeline = $('timeline'), noteLayer = $('notes');
  if(!timeline || !noteLayer || !window.ADOAEditorAPI) return;
  const api = window.ADOAEditorAPI;
  window.adoaGuidesVisible = window.adoaGuidesVisible !== false;
  const viewportHeight = 560;
  const bpm = () => Math.max(1, Number($('bpm')?.value)||180);
  const subdivision = () => Math.max(1, Number($('subdivision')?.value)||1);
  const laneCount = () => clamp(Number($('keyCount')?.value)||8,1,8);
  const speed = () => clamp(Number($('gameSpeed')?.value)||1,.5,10);
  const beatStep = () => 60 / bpm() / subdivision();
  const duration = () => {
    const saved = Number($('chartDurationInput')?.value);
    const notes = api.getNotes();
    const last = notes.reduce((m,n)=>Math.max(m,Number(n.time)||0),0);
    return clamp(Math.max(1, Number.isFinite(saved)&&saved>0?saved:90, last+beatStep()*4),1,600);
  };
  const pxPerSecond = () => 80 * speed();
  const receptorY = () => viewportHeight * .80;
  const worldHeight = () => Math.max(viewportHeight, duration()*pxPerSecond()+receptorY());
  let laneLayer = $('guides');
  if(laneLayer){
    const fresh = document.createElement('div'); fresh.id='guides'; fresh.className='guide-layer lane-layer';
    laneLayer.replaceWith(fresh); laneLayer=fresh;
  } else {
    laneLayer=document.createElement('div');laneLayer.id='guides';laneLayer.className='guide-layer lane-layer';timeline.insertBefore(laneLayer,noteLayer);
  }
  let grid = $('adoaBeatGrid');
  if(!grid){grid=document.createElement('div');grid.id='adoaBeatGrid';timeline.insertBefore(grid,noteLayer);}
  else {const fresh=grid.cloneNode(false);grid.replaceWith(fresh);grid=fresh;}
  grid.setAttribute('aria-label','박자 가이드라인');
  const foot=timeline.parentElement?.querySelector('.timeline-foot');
  let toggle=$('adoaGuidesToggle');
  if(!toggle&&foot){toggle=document.createElement('button');toggle.id='adoaGuidesToggle';toggle.type='button';toggle.style.padding='6px 9px';foot.appendChild(toggle);}
  function syncGuideToggle(){grid.hidden=!window.adoaGuidesVisible;if(toggle)toggle.textContent=window.adoaGuidesVisible?'가이드라인 끄기':'가이드라인 켜기';}
  if(toggle&&!toggle.dataset.bound){toggle.dataset.bound='1';toggle.addEventListener('click',()=>{window.adoaGuidesVisible=!window.adoaGuidesVisible;syncGuideToggle();api.markDirty();persistAuto();});}
  syncGuideToggle();

  const style=document.createElement('style');
  style.id='rhythmForgeEditorSubsystemStyle';
  style.textContent=`
    #editor #timeline{position:relative!important;height:${viewportHeight}px!important;max-height:${viewportHeight}px!important;overflow:hidden!important;cursor:default}
    #editor #guides,#editor #notes,#editor #adoaBeatGrid{position:absolute!important;left:0!important;right:0!important;top:0!important;bottom:auto!important;width:100%!important;will-change:transform;}
    #editor #guides{z-index:1!important;pointer-events:none!important;overflow:hidden!important}
    #editor #guides .lane-divider{position:absolute;top:0;bottom:0;width:1px;background:#263247;pointer-events:none}
    #editor #adoaBeatGrid{z-index:3!important;pointer-events:none!important;overflow:visible!important}
    #editor #adoaBeatGrid .adoa-beat-guide{position:absolute;left:0;right:0;height:8px;margin-top:-4px;background:transparent;pointer-events:auto;cursor:crosshair;z-index:3}
    #editor #adoaBeatGrid .adoa-beat-guide:before{content:"";position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);height:1px;background:#334158;pointer-events:none}
    #editor #adoaBeatGrid .adoa-beat-guide.major:before{height:1.5px;background:#8293b4}
    #editor #adoaBeatGrid .adoa-beat-guide:hover:before{background:#43d9c4;box-shadow:0 0 4px #43d9c4aa}
    #editor #notes{z-index:5!important;pointer-events:none!important;overflow:visible!important}
    #editor #notes .note{position:absolute!important;display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;transform:translate(-50%,-50%)!important;bottom:auto!important;min-width:22px!important;min-height:22px!important;padding:0!important;border:2px solid #f4f7ff!important;border-radius:5px!important;box-shadow:0 1px 5px #000b,0 0 7px #7e96ff66!important;z-index:10}
    #editor #notes .note.selected{outline:2px solid #43d9c4!important;outline-offset:2px}
    #editor #editorTargets{z-index:6!important;pointer-events:none!important}
    #editor #adoaBeatGrid[hidden]{display:none!important}
  `;
  $('rhythmForgeEditorSubsystemStyle')?.remove();document.head.appendChild(style);

  function persistAuto(){if($('autosave')?.checked){try{localStorage.setItem('rf_chart',JSON.stringify(api.getChart()));}catch(err){console.warn('[Rhythm Forge] autosave failed',err);}}}
  function buildLaneDividers(){
    const count=laneCount();laneLayer.innerHTML='';laneLayer.style.height=worldHeight()+'px';
    laneLayer.style.setProperty('--lane-count',String(count));
    for(let i=1;i<count;i++){const d=document.createElement('div');d.className='lane-divider';d.style.left=(i/count*100)+'%';laneLayer.appendChild(d);}
    const targets=$('editorTargets');if(targets){targets.style.gridTemplateColumns=`repeat(${count},minmax(0,1fr))`;targets.innerHTML=Array.from({length:count},()=>'<div class="editor-target"></div>').join('');}
  }
  function buildGuides(){
    const d=duration(), scale=pxPerSecond(), h=worldHeight(), step=beatStep(), sub=subdivision();
    timeline.style.height=viewportHeight+'px';timeline.style.maxHeight=viewportHeight+'px';
    buildLaneDividers();grid.innerHTML='';grid.style.height=h+'px';
    const total=Math.min(12000,Math.floor(d/step+1e-7));
    const frag=document.createDocumentFragment();
    for(let i=0;i<=total;i++){
      const t=i*step,line=document.createElement('div');
      line.className='adoa-beat-guide'+(i%sub===0?' major':'');
      const hitHeight=Math.max(2,Math.min(10,step*scale*.8));line.dataset.time=t.toFixed(6);line.style.top=(h-t*scale)+'px';line.style.height=hitHeight+'px';line.style.marginTop=(-hitHeight/2)+'px';
      line.title=`${Math.round(t*1000)} ms · 클릭해 채보 추가`;frag.appendChild(line);
    }
    grid.appendChild(frag);noteLayer.style.height=h+'px';syncGuideToggle();
    updateViewport(Number($('seek')?.value)||0);
  }
  function updateViewport(time){
    const d=duration(),scale=pxPerSecond(),h=worldHeight(),t=clamp(Number(time)||0,0,d);
    const scroll=(d-t)*scale;
    timeline.style.height=viewportHeight+'px';timeline.style.maxHeight=viewportHeight+'px';
    [laneLayer,grid,noteLayer].forEach(el=>{el.style.height=h+'px';el.style.transform=`translateY(${-scroll}px)`;});
    if($('seek')){ $('seek').max=String(d); if(document.activeElement!==$('seek'))$('seek').value=String(t); }
    if($('now'))$('now').textContent=t.toFixed(3)+'s';
    window.adoaEditorScrollOffset=scroll;
  }
  function renderNotes(){
    // Original renderer owns selected-note state and note DOM creation; this pass only applies geometry.
    const original=window.__rhythmForgeOriginalRenderNotes;
    if(typeof original==='function')original();
    const notes=api.getNotes(),h=worldHeight(),scale=pxPerSecond(),count=laneCount();
    noteLayer.style.height=h+'px';noteLayer.style.width='100%';noteLayer.style.display='block';
    const elements=Array.from(noteLayer.querySelectorAll('.note'));
    elements.forEach((el,i)=>{
      const n=notes[i];if(!n)return;
      const t=clamp(Number(n.time)||0,0,duration()),lane=clamp(Number(n.lane)||0,0,count-1);
      const y=h-t*scale;
      Object.assign(el.style,{left:((lane+.5)/count*100)+'%',top:y+'px',bottom:'auto',width:`min(38px, calc(100% / ${count} - 6px))`,height:`min(38px, calc(100% / ${count} - 6px))`,zIndex:String(100+Math.round(y)),display:'block',visibility:'visible',opacity:'1'});
      el.dataset.noteId=String(n.id??'');
    });
    updateViewport(Number($('seek')?.value)||0);
  }
  // Capture the original renderer exactly once. All future calls use the one stable wrapper.
  if(!window.__rhythmForgeOriginalRenderNotes)window.__rhythmForgeOriginalRenderNotes=window.renderNotes;
  window.renderNotes=renderNotes;
  window.buildGuides=buildGuides;
  window.updateEditorViewport=updateViewport;
  window.adoaWorldHeight=worldHeight;

  // Single capture handler for guide clicks; it is intentionally not attached to individual lines.
  document.addEventListener('click',function(e){
    const line=e.target?.closest?.('#adoaBeatGrid .adoa-beat-guide');if(!line)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const rect=timeline.getBoundingClientRect();if(!rect.width)return;
    const x=clamp(e.clientX-rect.left,0,Math.max(0,rect.width-.01));
    const lane=clamp(Math.floor(x/rect.width*laneCount()),0,laneCount()-1);
    let time=clamp(Number(line.dataset.time)||0,0,duration());
    if($('snap')?.checked)time=Math.round(time/beatStep())*beatStep();
    try{
      const existing=api.getNotes().filter(n=>Number(n.lane)===lane).sort((a,b)=>Math.abs(Number(a.time)-time)-Math.abs(Number(b.time)-time))[0];
      if(existing && Math.abs(Number(existing.time)-time)<Math.max(0.012,beatStep()*0.12)){
        // Clicking the guide line occupied by a note selects it instead of creating an invisible duplicate.
        const noteEl=Array.from(noteLayer.querySelectorAll('.note')).find(el=>String(el.dataset.noteId)===String(existing.id))||Array.from(noteLayer.querySelectorAll('.note'))[api.getNotes().indexOf(existing)];
        noteEl?.click();api.syncSelected();return;
      }
      api.pushUndo();api.addNote({time,lane,pos:time/duration(),speed:speed()});api.markDirty();persistAuto();
      renderNotes();api.syncSelected();
      console.debug('[Rhythm Forge] note added', {time:+time.toFixed(4),lane,count:api.getNotes().length});
    }catch(err){console.error('[Rhythm Forge] note creation failed',err);}
  },true);

  // Selection click is allowed through to the core handler; after it updates selection, redraw geometry only.
  document.addEventListener('click',function(e){if(e.target?.closest?.('#notes .note'))requestAnimationFrame(()=>{renderNotes();api.syncSelected();});},true);
  // Keep the chart's single source of truth synchronized whenever a setting changes.
  ['bpm','subdivision','keyCount','chartDurationInput','gameSpeed'].forEach(id=>{
    $(id)?.addEventListener('input',()=>{if(id==='gameSpeed'&&$('gameSpeedValue'))$('gameSpeedValue').textContent=speed().toFixed(1)+'×';buildGuides();renderNotes();api.markDirty();persistAuto();});
    $(id)?.addEventListener('change',()=>{buildGuides();renderNotes();api.markDirty();persistAuto();});
  });
  ['snap','autosave','tips','editorOffsetMs'].forEach(id=>$(id)?.addEventListener('change',()=>{api.markDirty();if(id==='editorOffsetMs')updateViewport(Number($('seek')?.value)||0);persistAuto();}));
  $('seek')?.addEventListener('input',e=>updateViewport(Number(e.target.value)||0));
  window.addEventListener('resize',()=>{buildGuides();renderNotes();});
  ['noteTime','noteLane'].forEach(id=>$(id)?.addEventListener('change',()=>requestAnimationFrame(()=>{renderNotes();persistAuto();})));
  document.addEventListener('click',e=>{if(e.target?.closest?.('#nudgeBack,#nudgeForward,#deleteNote,#undo,#redo,[data-open-project]'))requestAnimationFrame(()=>{buildGuides();renderNotes();persistAuto();});},true);
  const editorScreen=$('editor');if(editorScreen&&typeof MutationObserver!=='undefined'){new MutationObserver(()=>{if(editorScreen.classList.contains('active'))requestAnimationFrame(()=>{buildGuides();renderNotes();});}).observe(editorScreen,{attributes:true,attributeFilter:['class']});}
  // Rebuild once after legacy initialization; no duplicate guide or note layers are created afterwards.
  requestAnimationFrame(()=>{buildGuides();renderNotes();});
})();
