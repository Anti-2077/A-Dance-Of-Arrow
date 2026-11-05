/*
 * A Dance Of Arrow — Auto Chart Analysis & Generation
 * Isolated from app-core.js. Uses browser Web Audio APIs only; no server or Firebase.
 * Chart output follows the existing {time, lane, pos, id} note schema.
 */
(function ADOAAutoChartAI(){
  'use strict';

  const $id = id => document.getElementById(id);
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
  const OFFSET_KEY = 'adoa_auto_phase_offset_ms_v1';
  const bridge = () => window.ADOAAutoChartBridge;
  let selectedFile = null;
  let audioUrl = null;
  let audioDuration = 90;
  let generatedChart = null;
  let analysis = null;
  let analysisKey = '';
  let busy = false;

  function notify(message){ if(typeof bridge()?.toast==='function')bridge().toast(message); }
  function status(message){ const el=$id('autoStatus'); if(el)el.textContent=message; }
  function analysisState(message){ const el=$id('autoAnalysisState'); if(el)el.textContent=message; }
  function progress(value){ const el=$id('autoAnalysisProgress'); if(el)el.style.width=clamp(value,0,100)+'%'; }
  function fileKey(file,bpm,meter){return [file?.name,file?.size,file?.lastModified,bpm,meter].join('|');}
  function currentSettings(){
    return {
      bpm:clamp(Number($id('autoBpm')?.value)||180,30,400),
      meter:Number($id('autoMeter')?.value)||4,
      subdivision:Number($id('autoSubdivision')?.value)||8,
      lanes:clamp(Number($id('autoLanes')?.value)||8,4,8),
      difficulty:Number($id('autoDensity')?.value)||2
    };
  }
  function updateAnalysisSummary(result){
    const set=(id,value)=>{const el=$id(id);if(el)el.textContent=value;};
    set('autoOnsetCount',String(result.onsets.length));
    set('autoOffsetValue',(result.phaseMs>=0?'+':'')+result.phaseMs.toFixed(1)+' ms');
    set('autoRhythmDensity',result.onsets.length/Math.max(.01,result.duration/60)<70?'낮음':result.onsets.length/Math.max(.01,result.duration/60)<150?'보통':'높음');
    set('autoAnalyzedDuration',result.duration.toFixed(1)+'초');
    const summary=$id('autoAnalysisSummary');
    if(summary)summary.textContent=`입력 BPM ${result.bpm} · ${result.meter}박자 기준으로 분석했습니다. 첫 유효 타격과 전체 리듬 정렬을 함께 사용해 자동 오프셋을 계산했습니다. BPM은 변경하지 않았습니다.`;
  }

  // In-place radix-2 FFT. Input arrays are reused for each frame to keep memory stable.
  function fft(real,imag){
    const n=real.length;
    for(let i=1,j=0;i<n;i++){
      let bit=n>>1;
      for(;j&bit;bit>>=1)j^=bit;
      j^=bit;
      if(i<j){let t=real[i];real[i]=real[j];real[j]=t;t=imag[i];imag[i]=imag[j];imag[j]=t;}
    }
    for(let len=2;len<=n;len<<=1){
      const angle=-2*Math.PI/len,wlenR=Math.cos(angle),wlenI=Math.sin(angle),half=len>>1;
      for(let i=0;i<n;i+=len){
        let wr=1,wi=0;
        for(let j=0;j<half;j++){
          const u=i+j,v=i+j+half;
          const vr=real[v]*wr-imag[v]*wi,vi=real[v]*wi+imag[v]*wr;
          real[v]=real[u]-vr;imag[v]=imag[u]-vi;real[u]+=vr;imag[u]+=vi;
          const next=wr*wlenR-wi*wlenI;wi=wr*wlenI+wi*wlenR;wr=next;
        }
      }
    }
  }
  function percentile(values,p){
    if(!values.length)return 0;
    const sorted=values.slice().sort((a,b)=>a-b);
    return sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))];
  }
  function detectOnsets(audioBuffer,onProgress){
    const sourceRate=audioBuffer.sampleRate,targetRate=22050;
    const channels=audioBuffer.numberOfChannels;
    const sourceLength=audioBuffer.length;
    const outLength=Math.floor(sourceLength*targetRate/sourceRate);
    const mono=new Float32Array(outLength);
    const channelData=Array.from({length:channels},(_,i)=>audioBuffer.getChannelData(i));
    // Linear resampling and mono mixdown.
    for(let i=0;i<outLength;i++){
      const src=i*sourceRate/targetRate,lo=Math.floor(src),frac=src-lo;
      let sample=0;
      for(let c=0;c<channels;c++){
        const d=channelData[c];
        sample+=(d[lo]||0)*(1-frac)+(d[Math.min(sourceLength-1,lo+1)]||0)*frac;
      }
      mono[i]=sample/channels;
    }
    const size=1024,hop=441,half=size>>1,window=new Float32Array(size);
    for(let i=0;i<size;i++)window[i]=.5-.5*Math.cos(2*Math.PI*i/(size-1));
    const real=new Float64Array(size),imag=new Float64Array(size),previous=new Float32Array(half);
    const frames=Math.max(1,Math.floor((mono.length-size)/hop)+1);
    const flux=new Float32Array(frames),low=new Float32Array(frames),mid=new Float32Array(frames),high=new Float32Array(frames);
    for(let frame=0;frame<frames;frame++){
      const start=frame*hop;real.fill(0);imag.fill(0);
      for(let i=0;i<size;i++)real[i]=(mono[start+i]||0)*window[i];
      fft(real,imag);
      let sumFlux=0,l=0,m=0,h=0;
      for(let k=1;k<half;k++){
        const mag=Math.hypot(real[k],imag[k]);
        const hz=k*targetRate/size;
        if(mag>previous[k-1])sumFlux+=mag-previous[k-1];
        if(hz>=35&&hz<160)l+=mag;
        else if(hz>=160&&hz<2500)m+=mag;
        else if(hz>=2500&&hz<10000)h+=mag;
        previous[k-1]=mag;
      }
      flux[frame]=sumFlux;low[frame]=l;mid[frame]=m;high[frame]=h;
      if(frame%500===0)onProgress?.(Math.round(frame/frames*75));
    }
    // Smooth the spectral-flux curve and keep clear local peaks.
    const smooth=new Float32Array(frames);
    for(let i=0;i<frames;i++)smooth[i]=((flux[i]||0)+(flux[i-1]||0)+(flux[i+1]||0))/3;
    const positive=Array.from(smooth).filter(v=>v>0),mean=positive.reduce((a,b)=>a+b,0)/Math.max(1,positive.length);
    const variance=positive.reduce((a,b)=>a+(b-mean)**2,0)/Math.max(1,positive.length),globalThreshold=mean+Math.sqrt(variance)*.30;
    const peaks=[];let lastFrame=-99;
    for(let i=2;i<frames-2;i++){
      const value=smooth[i];
      if(value<globalThreshold||value<smooth[i-1]||value<smooth[i+1]||i-lastFrame<5)continue;
      let local=0,count=0;
      for(let j=Math.max(0,i-20);j<=Math.min(frames-1,i+20);j++){local+=smooth[j];count++;}
      if(value<local/Math.max(1,count)*1.18)continue;
      const bands=[low[i],mid[i],high[i]],maxBand=Math.max(...bands,1e-9);
      peaks.push({time:i*hop/targetRate,strength:value,bands:bands.map(v=>v/maxBand)});
      lastFrame=i;
    }
    // If strict peak picking found too little, use a lower threshold as a fallback.
    if(peaks.length<4){
      lastFrame=-99;
      const threshold=percentile(Array.from(smooth),.78);
      for(let i=2;i<frames-2;i++)if(smooth[i]>=threshold&&smooth[i]>=smooth[i-1]&&smooth[i]>smooth[i+1]&&i-lastFrame>=5){
        const bands=[low[i],mid[i],high[i]],maxBand=Math.max(...bands,1e-9);
        peaks.push({time:i*hop/targetRate,strength:smooth[i],bands:bands.map(v=>v/maxBand)});lastFrame=i;
      }
    }
    const maxStrength=peaks.reduce((m,p)=>Math.max(m,p.strength),1e-9);
    peaks.forEach(p=>p.normalized=clamp(p.strength/maxStrength,0,1));
    return {peaks,duration:audioBuffer.duration};
  }

  function estimatePhase(onsets,bpm){
    const beat=60/bpm;
    if(!onsets.length)return 0;
    const firstStrong=onsets.find(o=>o.normalized>=percentile(onsets.map(x=>x.normalized),.65))||onsets[0];
    const prior=((firstStrong.time%beat)+beat)%beat;
    let best=prior,bestScore=-Infinity;
    const searchStep=.002;
    for(let phase=0;phase<beat;phase+=searchStep){
      let score=0;
      for(const onset of onsets){
        const rel=onset.time-phase;
        const beatError=Math.abs(rel-Math.round(rel/beat)*beat);
        const halfBeatError=Math.abs(rel-Math.round(rel/(beat/2))*(beat/2));
        // Full-beat alignment carries the strongest vote; offbeat attacks still
        // contribute, but cannot pull the whole chart half a beat out of phase.
        const beatFit=Math.exp(-.5*(beatError/(beat*.12))**2);
        const offbeatFit=Math.exp(-.5*(halfBeatError/(beat*.10))**2)*.34;
        score+=onset.normalized*(beatFit+offbeatFit);
      }
      const d=Math.abs((((phase-prior+beat/2)%beat)+beat)%beat-beat/2);
      score-=d*.04;
      if(score>bestScore){bestScore=score;best=phase;}
    }
    return best;
  }

  async function analyzeSelectedFile(){
    if(busy)return null;
    if(!selectedFile){status('먼저 음악 파일을 선택하세요.');notify('분석할 음악 파일을 선택하세요.');return null;}
    const settings=currentSettings(),key=fileKey(selectedFile,settings.bpm,settings.meter);
    if(analysis&&analysisKey===key)return analysis;
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx){status('이 브라우저는 Web Audio 분석을 지원하지 않습니다.');return null;}
    busy=true;$id('analyzeAutoAudio').disabled=true;$id('generateAutoChart').disabled=true;
    analysisState('음악 디코딩 중…');progress(2);status('음악을 읽고 있습니다. 파일 크기에 따라 잠시 걸릴 수 있어요.');
    let context;
    try{
      context=new AudioCtx();
      const bytes=await selectedFile.arrayBuffer();
      const decoded=await context.decodeAudioData(bytes.slice(0));
      analysisState('리듬 특징 분석 중…');
      const detected=detectOnsets(decoded,value=>progress(5+value*.85));
      const phase=estimatePhase(detected.peaks,settings.bpm);
      const beatSeconds=60/settings.bpm,thirtySecondStep=beatSeconds/8;
      const earliestTick=detected.peaks.reduce((min,onset)=>Math.min(min,Math.round((onset.time-phase)/thirtySecondStep)),0);
      const timeShiftTicks=Math.max(0,-earliestTick),timeShiftSeconds=timeShiftTicks*thirtySecondStep;
      const appliedOffsetMs=(phase-timeShiftSeconds)*1000;
      analysis={bpm:settings.bpm,meter:settings.meter,duration:detected.duration,onsets:detected.peaks,phaseSeconds:phase,phaseMs:appliedOffsetMs,timeShiftTicks,timeShiftSeconds,createdAt:Date.now()};
      analysisKey=key;
      // Preserve the user's manual calibration while replacing only the prior auto phase.
      const previousAuto=Number(localStorage.getItem(OFFSET_KEY)||0);
      const manualBase=(bridge()?.getOffset()||0)-previousAuto;
      bridge()?.setOffset(manualBase+analysis.phaseMs);
      localStorage.setItem(OFFSET_KEY,String(analysis.phaseMs));
      updateAnalysisSummary(analysis);progress(100);analysisState('분석 완료 · 오프셋 적용됨');
      status(`분석 완료: 타격음 ${analysis.onsets.length}개 · 자동 오프셋 ${analysis.phaseMs.toFixed(1)}ms가 설정에 적용됐습니다. 입력한 BPM ${settings.bpm}은 유지했습니다.`);
      return analysis;
    }catch(error){
      console.error('[ADOA Auto Chart] analysis failed',error);
      analysis=null;analysisKey='';analysisState('분석 실패');progress(0);
      status('음악 분석 실패: '+(error?.message||'오디오를 해석할 수 없습니다.')+' · 다른 MP3/WAV 파일로 다시 시도해 주세요.');
      notify('음악 분석에 실패했습니다.');return null;
    }finally{
      try{await context?.close();}catch{}
      busy=false;$id('analyzeAutoAudio').disabled=false;$id('generateAutoChart').disabled=false;
    }
  }

  function centerLaneOrder(lanes){
    return Array.from({length:lanes},(_,i)=>i).sort((a,b)=>Math.abs(a-(lanes-1)/2)-Math.abs(b-(lanes-1)/2)||a-b);
  }
  function buildChart(result,settings){
    const beat=60/settings.bpm,step=beat/8,lanes=settings.lanes,maxChord=Math.max(1,Math.floor(lanes/2));
    const thresholds={1:.78,2:.53,3:.34,4:.20};
    const difficultyTick={1:8,2:4,3:2,4:1}[settings.difficulty];
    const selectedResolutionTick=8/settings.subdivision;
    const minimumTick=Math.max(difficultyTick,selectedResolutionTick);
    const barBeats=settings.meter===6?3:settings.meter;
    const barTicks=8*barBeats;
    const strengthThreshold=thresholds[settings.difficulty];
    const grouped=new Map();
    for(const onset of result.onsets){
      const relative=onset.time-result.phaseSeconds;
      const tick=Math.round(relative/step);
      const shiftedTick=tick+(result.timeShiftTicks||0);
      if(shiftedTick<0)continue;
      const gridTime=shiftedTick*step;
      const residual=Math.abs(relative-tick*step);
      if(residual>step*.46)continue;
      if(tick%minimumTick!==0)continue;
      if(settings.difficulty===1){const inBar=((tick%barTicks)+barTicks)%barTicks;if(inBar!==0)continue;}
      if(onset.normalized<strengthThreshold)continue;
      const old=grouped.get(tick);
      if(!old||old.normalized<onset.normalized)grouped.set(tick,{tick,time:gridTime,normalized:onset.normalized,bands:onset.bands});
    }
    const events=Array.from(grouped.values()).sort((a,b)=>a.tick-b.tick);
    const centerOrder=centerLaneOrder(lanes),notes=[];let rapidRun=0,previousTime=-Infinity,previousLane=-1;
    const difficultyName=['','Easy','Normal','Hard','Expert'][settings.difficulty];
    for(let i=0;i<events.length;i++){
      const event=events[i],gap=event.time-previousTime;
      const rapid=gap<=beat*.72;
      if(rapid)rapidRun++;else rapidRun=0;
      let baseLane;
      if(rapid){
        baseLane=centerOrder[rapidRun%Math.min(centerOrder.length,Math.max(2,Math.ceil(lanes/2)))];
      }else{
        const bar=Math.floor(event.time/(beat*settings.meter));
        baseLane=centerOrder[(i+bar*2)%centerOrder.length];
      }
      if(baseLane===previousLane&&centerOrder.length>1)baseLane=centerOrder[(centerOrder.indexOf(baseLane)+1)%centerOrder.length];
      const activeBands=event.bands.filter(v=>v>=.58).length;
      let chord=1;
      if(settings.difficulty>=2&&event.normalized>=.72&&activeBands>=2)chord=Math.min(maxChord,activeBands);
      if(settings.difficulty===1)chord=1;
      if(settings.difficulty===2)chord=Math.min(chord,2);
      const laneSet=[];
      for(let c=0;c<chord;c++){
        let lane=centerOrder[(centerOrder.indexOf(baseLane)+c)%centerOrder.length];
        if(laneSet.includes(lane))lane=centerOrder.find(x=>!laneSet.includes(x));
        if(Number.isInteger(lane))laneSet.push(lane);
      }
      for(const lane of laneSet.slice(0,maxChord)){
        notes.push({time:Number(event.time.toFixed(5)),lane,pos:Math.min(1,event.time/Math.max(1,result.duration)),id:`ai-${i}-${lane}`});
      }
      previousTime=event.time;previousLane=baseLane;
    }
    notes.sort((a,b)=>a.time-b.time||a.lane-b.lane);
    return {notes,events:events.length,difficultyName,step,threshold:strengthThreshold,maxChord};
  }

  async function generateChart(){
    if(busy)return;
    if(!selectedFile){notify('먼저 음악 파일을 선택하세요.');status('AI 채보를 생성하려면 음악 파일이 필요합니다.');return;}
    const settings=currentSettings();
    let result=analysis;
    if(!result||analysisKey!==fileKey(selectedFile,settings.bpm,settings.meter))result=await analyzeSelectedFile();
    if(!result)return;
    const generated=buildChart(result,settings);
    if(!generated.notes.length){status('분석은 완료됐지만 선택한 난이도에서 채보로 사용할 타격음을 찾지 못했습니다. 난이도를 높이거나 BPM/박자를 확인해 주세요.');notify('생성할 수 있는 노트가 부족합니다.');return;}
    const manualBase=Number(bridge()?.getOffset()||0)-Number(result.phaseMs);
    generatedChart={
      format:'RhythmForgeChart',version:2,bpm:settings.bpm,meter:settings.meter,subdivision:settings.subdivision,
      keyCount:settings.lanes,offset:Number(bridge()?.getOffset()||0),autoOffsetMs:result.phaseMs,manualOffsetMs:manualBase,
      notes:generated.notes,events:[],effects:[],images:[],duration:result.duration,
      title:$id('autoTitle').value.trim()||'AI 자동 생성 채보',artist:$id('autoArtist').value.trim()||'Unknown',difficulty:generated.difficultyName,
      aiAnalysis:{engine:'ADOA-local-rhythm-analysis-v1',onsetCount:result.onsets.length,usedOnsets:generated.events,
        maxSubdivision:32,difficultyScale:10,maxSimultaneousKeys:generated.maxChord,selectedMaxSubdivision:settings.subdivision*4,laneStrategy:'center-biased-rapid-patterns',
        rhythmDensity:generated.events/Math.max(.01,result.duration/60)}
    };
    bridge()?.setChart(generatedChart);
    status(`AI 채보 생성 완료: 노트 ${generated.notes.length}개 · ${settings.bpm} BPM · ${generated.difficultyName} · 오프셋 ${(Number(bridge()?.getOffset())||0).toFixed(1)}ms. 중앙 레인 연타와 동시 입력 제한을 적용했습니다.`);
    notify('AI 채보를 생성했습니다.');
  }

  function bind(){
    const fileInput=$id('autoAudioFile');
    fileInput.onchange=event=>{
      const file=event.target.files?.[0];if(!file)return;
      selectedFile=file;analysis=null;analysisKey='';
      if(audioUrl)URL.revokeObjectURL(audioUrl);
      audioUrl=URL.createObjectURL(file);
      bridge()?.setAudio(audioUrl,audioDuration);
      const audio=new Audio(audioUrl);
      audio.onloadedmetadata=()=>{
        audioDuration=Number.isFinite(audio.duration)?audio.duration:90;
        bridge()?.setAudio(audioUrl,audioDuration);
        $id('autoAudioName').textContent=`${file.name} · ${audioDuration.toFixed(1)}초`;
        analysisState('분석 전');progress(0);
        $id('autoAnalysisSummary').textContent='파일을 불러왔습니다. BPM을 확인하고 리듬 분석을 실행하세요.';
        status('음악 파일을 불러왔습니다. BPM을 입력하고 리듬 분석을 실행하세요.');
      };
      audio.onerror=()=>{status('오디오 길이를 확인하지 못했습니다. 브라우저에서 재생 가능한 파일인지 확인해 주세요.');};
    };
    $id('autoBpm').addEventListener('change',()=>{analysis=null;analysisKey='';analysisState('BPM 변경 · 재분석 필요');});
    $id('autoMeter').addEventListener('change',()=>{analysis=null;analysisKey='';analysisState('박자 변경 · 재분석 필요');});
    $id('analyzeAutoAudio').onclick=analyzeSelectedFile;
    $id('generateAutoChart').onclick=generateChart;
    $id('previewAutoChart').onclick=()=>{
      if(!generatedChart){notify('먼저 AI 채보를 생성하세요.');return;}
      bridge()?.preview(generatedChart);
    };
    $id('editAutoChart').onclick=()=>{
      if(!generatedChart){notify('먼저 AI 채보를 생성하세요.');return;}
      bridge()?.edit(generatedChart);
    };
    $id('saveAutoChart').onclick=()=>{
      if(!generatedChart){notify('먼저 AI 채보를 생성하세요.');return;}
      const blob=new Blob([JSON.stringify(generatedChart,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='adoa-ai-chart.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
  }
  bind();
  window.ADOAAutoChartAI={analyze:analyzeSelectedFile,generate:generateChart,getAnalysis:()=>analysis,getSettings:currentSettings,getChart:()=>generatedChart};
})();
