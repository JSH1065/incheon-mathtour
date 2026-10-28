document.addEventListener('DOMContentLoaded', () => {
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', '매쓰투어 메뉴');
  nav.style.cssText = 'display:flex;gap:16px;align-items:center;padding:10px 16px;background:#fff;color:#223;font:14px/1.5 sans-serif;border-bottom:1px solid #dde3eb;';
  const brand = document.createElement('strong'); brand.textContent = '인천 매쓰투어'; nav.appendChild(brand);
  for (const [href, text] of [['./index.html','체험하기'],['./make.html','미션 만들기']]) {
    const a=document.createElement('a'); a.href=href; a.textContent=text; a.style.color='#2857aa'; nav.appendChild(a);
  }
  document.body.prepend(nav);
  if (!window.MATHTOUR_CONFIG?.apiUrl || window.MATHTOUR_CONFIG?.localTest) {
    const message = document.createElement('p');
    message.id='connectionNotice'; message.setAttribute('role','status');
    message.style.cssText='margin:0;padding:8px 16px;background:#fff4ce;color:#684d00;font:14px/1.5 sans-serif;';
    message.textContent=window.MATHTOUR_CONFIG?.localTest ? '로컬 검사 모드 · 이 화면에서 올린 작품은 OneDrive에 전송되지 않습니다.' : '저장소 연결 준비 중입니다. 게임 만들기와 미리보기는 사용할 수 있어요.';
    nav.after(message);
  }
});
