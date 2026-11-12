/* A Dance Of Arrow page loader. The legacy runtime expects shared screen DOM,
   so page fragments are assembled once while each screen remains in its own HTML file. */
(async function bootADoA() {
  'use strict';
  const root = document.getElementById('screen-root');
  const pages = [
    'menu.html', 'game-play.html', 'auto-chart.html',
    'chart-library.html', 'editor.html', 'editor-play.html', 'settings.html'
  ];
  const scripts = [
    'app-core.js', 'auto-chart-ai.js', 'local-chart-library.js', 'editor-engine.js',
    'editor-controls.js', 'offset-visual-events.js', 'editor-stability.js',
    'editor-seek-offset.js', 'editor-final-customizations.js'
  ];
  try {
    const fragments = await Promise.all(pages.map(async name => {
      const response = await fetch('pages/' + name + '?v=20261112b', {cache:'no-store'});
      if (!response.ok) throw new Error('페이지 파일을 불러오지 못했습니다: pages/' + name);
      return response.text();
    }));
    root.innerHTML = fragments.join('\n');
    for (const name of scripts) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'js/' + name + '?v=20261112b';
        script.onload = resolve;
        script.onerror = () => reject(new Error('스크립트를 불러오지 못했습니다: js/' + name));
        document.body.appendChild(script);
      });
    }
    // Load the user-provided JSON as the first built-in song. Its embedded audio is
    // decoded by the app at selection time; the JSON remains a standalone project asset.
    try {
      const songResponse = await fetch('songs/DiDice - Phantigma.json?v=20261112b', {cache:'no-store'});
      if (!songResponse.ok) throw new Error('기본 수록곡 JSON을 불러오지 못했습니다.');
      const songProject = await songResponse.json();
      const audio = songProject.audio;
      let audioUrl = null;
      if (audio?.data && audio.encoding === 'base64') {
        const binary = atob(audio.data);
        const chunks = [];
        for (let i=0; i<binary.length; i+=32768) {
          const part = binary.slice(i,i+32768);
          const bytes = new Uint8Array(part.length);
          for (let j=0; j<part.length; j++) bytes[j]=part.charCodeAt(j);
          chunks.push(bytes);
        }
        audioUrl = URL.createObjectURL(new Blob(chunks,{type:audio.mimeType||'audio/mpeg'}));
      }
      window.ADOASetBundledCharts?.([{
        id:'bundled-didice-phantigma', title:songProject.project?.name||'DiDice - Phantigma',
        artist:'수록곡', difficulty:'Lv.'+(songProject.difficulty||17),
        bpm:songProject.bpm, keyCount:songProject.keyCount, noteCount:songProject.notes?.length||0,
        chart:songProject, audioUrl, source:'bundled'
      }]);
    } catch (songError) {
      console.error('[ADoA] 기본 수록곡 로드 실패',songError);
      const status=document.getElementById('gameChartStatus');
      if(status) status.textContent='기본 곡을 불러오지 못했습니다. songs 폴더 업로드를 확인해 주세요.';
    }
    // Open directly into the menu; the unused login/guest landing fragment is not loaded.
    document.getElementById('menu')?.classList.add('active');
  } catch (error) {
    console.error(error);
    root.innerHTML = '<section class="screen active"><div class="panel"><h2>사이트를 불러오지 못했어요</h2><p>index.html, pages/, css/, js/ 폴더가 모두 업로드되었는지 확인해 주세요.</p><p class="muted" id="boot-error"></p></div></section>';
    const message = document.getElementById('boot-error');
    if (message) message.textContent = error.message;
  }
})();
