[README_KO.md](https://github.com/user-attachments/files/34417253/README_KO.md)
# A Dance Of Arrow — 화면 분리 / 기기 내 저장 버전

## 실행
- GitHub Pages 저장소의 기존 파일을 이 ZIP의 파일로 교체 업로드합니다.
- `index.html`, `pages/`, `css/`, `js/` 폴더 구조를 그대로 유지하세요.
- 로그인이나 Firebase 설정 없이 메뉴로 바로 진입합니다.

## 화면 파일
- `pages/menu.html`: 메인 메뉴
- `pages/editor.html`: 채보 에디터
- `pages/editor-play.html`: 에디터 테스트 플레이 경로 정의. 실제 플레이 무대는 아래 게임 화면과 공유합니다.
- `pages/game-play.html`: 일반 게임 플레이
- `pages/settings.html`: 키 설정 및 오프셋
- `pages/auto-chart.html`: 자동 채보 생성
- `pages/chart-library.html`: 기기 내 채보 보관함
- `pages/home.html`: 로그인 없는 시작 화면의 호환용 원본

화면은 `js/bootstrap.js`가 한 번에 불러오고, 기존 게임 런타임은 화면 상태를 전환합니다. 이 구조는 에디터에서 만든 채보/음원 참조를 페이지 이동으로 잃지 않으면서 화면별 HTML을 분리하기 위한 것입니다.

## 공통 기능
- `css/common.css`: 기존 공통 디자인
- `css/menu.css`, `editor.css`, `editor-play.css`, `game-play.css`: 화면별 스타일
- `js/app-core.js`: 게임/에디터 핵심 로직
- `js/local-chart-library.js`: 로컬 채보 보관함
- `js/editor-*.js`, `js/offset-*.js`: 에디터 및 오프셋 기능
- `js/bootstrap.js`: 화면 HTML과 스크립트 로드

## 저장 방식
- 설정과 작은 데이터는 LocalStorage에 저장됩니다.
- 프로젝트 음원은 IndexedDB에 저장됩니다.
- 데이터는 현재 브라우저/기기에만 저장되며 자동 동기화되지 않습니다.
- 브라우저 데이터 삭제 시 저장 내용이 사라질 수 있으므로 중요한 채보는 JSON으로 내보내 별도 보관하세요.

Firebase Authentication 및 클라우드 동기화는 사용하지 않습니다.
