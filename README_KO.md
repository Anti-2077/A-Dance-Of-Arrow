# A Dance Of Arrow — 기기 내 저장 버전

## 실행
- GitHub Pages에 `index.html`, `css/`, `js/`, `screens/`를 업로드합니다.
- 로그인이나 Firebase 설정 없이 바로 시작할 수 있습니다.

## 저장 방식
- 설정과 게임 데이터는 브라우저의 LocalStorage에 저장됩니다.
- 프로젝트 음원 데이터는 브라우저의 IndexedDB에 저장됩니다.
- 데이터는 현재 사용 중인 브라우저와 기기에만 저장되며 다른 기기와 자동 동기화되지 않습니다.
- 브라우저 데이터/사이트 저장 공간을 삭제하면 저장한 데이터가 사라질 수 있으므로 중요한 채보는 에디터의 JSON 내보내기 기능으로 별도 백업해 주세요.

## 파일 구조
- `index.html`: 화면 로드 및 앱 시작
- `screens/`: 홈, 메뉴, 게임, 에디터, 설정 화면
- `js/app-core.js`: 게임 및 로컬 저장 핵심 기능
- `js/local-chart-library.js`: 로컬 채보 보관함 (Firebase 미사용)
- `js/editor-*.js`, `js/offset-*.js`: 에디터 및 오프셋 기능
- `css/styles.css`: 디자인

Firebase Authentication, Firestore, Firebase Storage 연결은 제거했습니다. 공개 서버 채보 및 기기간 클라우드 동기화는 제공하지 않습니다.
