import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
const docs = new URL('../docs/', import.meta.url), context = vm.createContext({});
vm.runInContext(await readFile(new URL('storyboard-core.js', docs), 'utf8'), context);
const core = context.MathTourStoryboard;
const blank = core.template({ placeId:'K02', placeName:'마니산' });
await writeFile(new URL('examples/스토리보드_작성양식.txt', docs), '\ufeff' + core.toText(blank));
await writeFile(new URL('examples/스토리보드_작성양식.html', docs), core.toHtml(blank));
const path = new URL('examples/manisan/storyboard.json', docs);
const example = JSON.parse(await readFile(path, 'utf8'));
const plain = html => String(html || '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(p|div|h1|h2|article)>/gi, '\n').replace(/<[^>]*>/g, '').trim();
example.scenes.forEach(scene => {
  scene.gameNumber = scene.gameNumber || null;
  scene.sceneType = scene.gameNumber ? 'game' : 'story';
  scene.gameFile = scene.gameNumber ? example.placeId + '-G' + scene.gameNumber + '.html' : '';
});
await writeFile(path, JSON.stringify(example, null, 2) + '\n');
const board = { ...example, placeName:'마니산', scenes:example.scenes.map(scene => ({ ...scene,
  screenText:scene.gameNumber ? '게임 1 안에서 문제 두 개를 풀어요.\n문제 1: 직각인 두 변 6 m, 8 m → 빗변 10 m.\n문제 2: 빗변 13 m, 한 변 5 m → 나머지 변 12 m.\n정답 확인 후 다음 버튼을 켜고, 마지막 미션 완료에서 missionClear()를 호출해요.' : plain(scene.content),
  pictures:scene.photo ? [1] : [], isProblem:!!scene.gameNumber
})) };
await writeFile(new URL('examples/manisan/스토리보드.txt', docs), '\ufeff' + core.toText(board) + '\n\n관광지 소개 참고: 강화군 마니산 https://www.ganghwa.go.kr/manisan/\n게임 속 수치와 산길은 가상이며 실제 관광지의 측정값이 아닙니다. 그림은 AI 생성 일러스트입니다.\n');
await writeFile(new URL('examples/manisan/스토리보드.html', docs), core.toHtml(board));
const indexPath = new URL('examples/manisan/index.html', docs);
let index = await readFile(indexPath, 'utf8');
if (!index.includes('<th>게임 번호·연결 파일</th>')) {
  index = index.replace('<th>가운데 화면</th>', '<th>게임 번호·연결 파일</th><th>가운데 화면</th>');
  example.scenes.forEach((scene, i) => {
    const heading = '<tr><th>' + (i + 1) + '<br>' + scene.title + '</th>';
    index = index.replace(heading, heading + '<td>' + (scene.gameNumber ? '게임 ' + scene.gameNumber + '<br>' + scene.gameFile : '해당 없음') + '</td>');
  });
}
index = index.replace('GitHub Pages에 게시한 수업 예시입니다. OneDrive 제출은 아직 연결 전이며, 파일 일괄 업로드는 로컬 시험 환경에서 확인했습니다.', 'GitHub Pages에 게시한 수업 예시입니다. 제작기에서 본문·게임·사진을 함께 가져와 GitHub로 제출할 수 있어요.');
index = index.replace('학교·이름을 입력하고 미리보기 확인 완료 후, 제출 파일 준비 (개별 파일)를 눌러 파일을 저장해요. OneDrive 제출 링크는 아직 연결 전이에요.', '학교·이름을 입력하고 미리보기 확인 완료 후, GitHub에 업로드를 눌러 제출해요. 좌측 상단 1. 스토리보드 작성에서 장면별 게임 번호를 확인하고 기획안을 저장할 수 있어요.');
index = index.replace('우측 상단 스토리보드 보기·다운로드', '좌측 상단 1. 스토리보드 작성');
index = index.replace('<a href="./스토리보드.txt" download>스토리보드.txt</a>', '<a href="./스토리보드.txt" download>스토리보드 TXT · AI에 전달</a>');
if (!index.includes('href="./스토리보드.html"')) index = index.replace('<li><a href="./K02.html"', '<li><a href="./스토리보드.html">스토리보드 HTML · 표로 보기</a></li><li><a href="./K02.html"');
await writeFile(indexPath, index);
console.log('Built planning templates and the updated Manisan storyboard with explicit game numbers.');
