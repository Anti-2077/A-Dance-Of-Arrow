/* A Dance Of Arrow page loader. The legacy runtime expects shared screen DOM,
   so page fragments are assembled once while each screen remains in its own HTML file. */
(async function bootADoA() {
  'use strict';
  const root = document.getElementById('screen-root');
  const pages = [
    'home.html', 'menu.html', 'game-play.html', 'auto-chart.html',
    'chart-library.html', 'editor.html', 'editor-play.html', 'settings.html'
  ];
  const scripts = [
    'app-core.js', 'local-chart-library.js', 'editor-engine.js',
    'editor-controls.js', 'offset-visual-events.js', 'editor-stability.js',
    'editor-seek-offset.js', 'offset-persistence-v9.js', 'offset-persistence-v10.js'
  ];
  try {
    const fragments = await Promise.all(pages.map(async name => {
      const response = await fetch('pages/' + name);
      if (!response.ok) throw new Error('페이지 파일을 불러오지 못했습니다: pages/' + name);
      return response.text();
    }));
    root.innerHTML = fragments.join('\n');
    for (const name of scripts) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'js/' + name;
        script.onload = resolve;
        script.onerror = () => reject(new Error('스크립트를 불러오지 못했습니다: js/' + name));
        document.body.appendChild(script);
      });
    }
    // The home/login page is retained as a compatibility fragment, but no login is used.
    // Open the menu directly; all account/authentication code is absent from this build.
    document.getElementById('home')?.classList.remove('active');
    document.getElementById('menu')?.classList.add('active');
  } catch (error) {
    console.error(error);
    root.innerHTML = '<section class="screen active"><div class="panel"><h2>사이트를 불러오지 못했어요</h2><p>index.html, pages/, css/, js/ 폴더가 모두 업로드되었는지 확인해 주세요.</p><p class="muted" id="boot-error"></p></div></section>';
    const message = document.getElementById('boot-error');
    if (message) message.textContent = error.message;
  }
})();
