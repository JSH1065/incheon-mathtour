// 공개해도 되는 사이트 설정만 적습니다. Microsoft 비밀번호·토큰을 넣지 마세요.
window.MATHTOUR_CONFIG = Object.freeze({
  storageProvider: "github",
  siteBase: "https://jsh1065.github.io/incheon-mathtour/",
  apiUrl: "", // GitHub 접수 서버의 https://.../api 주소. 저장 권한은 서버에서만 관리합니다.
  githubCatalog: "./submissions/catalog.json",
  title: "인천 매쓰투어",
  // 교사가 GitHub Pages에 게시한 공개 예시. 학생 제출 저장소와 분리합니다.
  exampleMissions: [{ placeId: "K02", id: "EXAMPLE-K02", name: "수업 예시 · GitHub 게시", topic: "마니산에서 만난 삼각형의 비밀", url: "./examples/manisan/mission.html" }],
  // 함께 하는 선생님의 기존 목록 API를 확인한 뒤 추가합니다. 읽기만 합니다.
  // 예: [{ apiUrl: "https://.../exec" }]
  sharedSources: []
});
