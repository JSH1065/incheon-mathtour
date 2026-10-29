# 인천 매쓰투어

인천 관광지를 탐험하며 학생이 만든 HTML 게임을 체험하는 지도와 미션 제작기입니다.

- [체험 지도](https://jsh1065.github.io/incheon-mathtour/)
- [미션 제작기](https://jsh1065.github.io/incheon-mathtour/make.html)
- [예시 게임](https://jsh1065.github.io/incheon-mathtour/example_game.html)

기존 지도·캐릭터·표정·보석 진행 방식을 유지하며, 게임 HTML 파일을 별도로 가져올 수 있습니다. 예시 게임은 정답을 맞히면 다음 버튼이 활성화되고, 마지막 미션 완료 버튼에서 완료 신호를 보냅니다.

학생 작품은 접수 서버를 거쳐 GitHub에 저장됩니다. 교사가 나눠 준 수업용 링크로 제작기를 열면 제출 설정이 자동 적용되어 코드 입력 없이 학교와 이름으로 제출할 수 있습니다.

수업용 링크는 `node scripts/build-student-maker.mjs --common`으로 생성되는 `.private/github-upload/수업용-접속링크.txt`에 있습니다. 링크의 실제 제출 코드는 공개 저장소에 올리지 않고 수업 참여자에게 공유합니다. 같은 브라우저에서는 제출 설정이 유지되며, 작품을 수정할 때도 같은 브라우저와 학교·이름·관광지를 사용합니다. 브라우저 저장 데이터를 지우거나 기기를 바꾸면 새 작품으로 저장될 수 있습니다.

GitHub Pages는 `main` 브랜치의 `docs/`를 게시합니다. `server/`는 별도 Node.js 서버용입니다. 설치 방법은 [설치안내.txt](설치안내.txt), 확인한 범위는 [검사결과.txt](검사결과.txt)를 참고하세요. 서버 검사는 `npm ci`와 `npm test`로 실행합니다.

실제 학생 명단, 제출코드, Microsoft 인증 정보, OneDrive 공유 링크는 이 저장소에 포함하지 않습니다.

원본 화면·리소스: [인천 매쓰투어](https://ahamathofey.netlify.app/mathtour/mathtour_incheon/incheon_mathtour), [원본 제작기](https://ahamathofey.netlify.app/mathtour/mathtour_incheon/incheon_mathtour_make).
