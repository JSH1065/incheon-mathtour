# 인천 매쓰투어

인천 관광지를 탐험하며 학생이 만든 HTML 게임을 체험하는 지도와 미션 제작기입니다.

- [체험 지도](https://jsh1065.github.io/incheon-mathtour/)
- [미션 제작기](https://jsh1065.github.io/incheon-mathtour/make.html)
- [예시 게임](https://jsh1065.github.io/incheon-mathtour/example_game.html)

기존 지도·캐릭터·표정·보석 진행 방식을 유지하며, 게임 HTML 파일을 별도로 가져올 수 있습니다. 예시 게임은 정답을 맞히면 다음 버튼이 활성화되고, 마지막 미션 완료 버튼에서 완료 신호를 보냅니다.

학생 작품은 접수 서버를 거쳐 GitHub에 저장됩니다. 모든 학생이 [같은 공통 제작기 HTML](https://jsh1065.github.io/incheon-mathtour/학생용_매스투어_제작기.html)을 내려받아 학교와 이름을 입력하고 제출할 수 있습니다. 웹 제작기에서도 개인 제출코드나 GitHub 로그인 없이 제출합니다. 다운로드 파일을 사용할 때도 업로드에는 인터넷 연결이 필요합니다.

제작기는 학생별 수정용 키를 브라우저에서 자동 생성하고 보관합니다. 같은 학교·이름이라도 서로 다른 브라우저의 작품은 별도로 저장하며, 서버가 저장 위치를 정해 다른 학생 작품을 덮어쓸 수 없게 합니다. 작품을 수정할 때는 같은 브라우저와 학교·이름·관광지를 사용합니다. 브라우저 저장 데이터를 지우거나 기기를 바꾸면 새 작품으로 저장될 수 있습니다. 수정용 키와 서버의 GitHub 토큰은 공개 작품에 저장하지 않습니다.

기존 수업용 링크와 개인 코드가 들어 있는 제작기도 계속 사용할 수 있습니다. 새 공통 제작기는 `node scripts/build-student-maker.mjs`로 생성합니다. 접수 서버도 함께 배포해야 하며, `/api?action=status`의 `codeFreeMaker: true`로 지원 여부를 확인합니다. Render 서비스의 자동 배포가 꺼져 있으면 서버 변경 후 최신 커밋을 직접 배포해야 합니다.

GitHub Pages는 `main` 브랜치의 `docs/`를 게시합니다. `server/`는 별도 Node.js 서버용입니다. 설치 방법은 [설치안내.txt](설치안내.txt), 확인한 범위는 [검사결과.txt](검사결과.txt)를 참고하세요. 서버 검사는 `npm ci`와 `npm test`로 실행합니다.

실제 학생 명단, 제출코드, Microsoft 인증 정보, OneDrive 공유 링크는 이 저장소에 포함하지 않습니다.

원본 화면·리소스: [인천 매쓰투어](https://ahamathofey.netlify.app/mathtour/mathtour_incheon/incheon_mathtour), [원본 제작기](https://ahamathofey.netlify.app/mathtour/mathtour_incheon/incheon_mathtour_make).
