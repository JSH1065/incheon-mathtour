/* Reuses the maker's character wrapper. Source HTML is parsed inertly and only runs in sandboxed frames. */
(function () {
  'use strict';
  const FACES = [
    { key:'stand', name:'기본' },{ key:'how', name:'궁금' },{ key:'thinking', name:'생각중' },
    { key:'finding', name:'찾기' },{ key:'aha', name:'깨달음' },{ key:'thumb', name:'칭찬' },{ key:'lookmap', name:'지도보기' }
  ];
  /* 권역 이름 (상단 띠 표시용) — 첨부 기준으로 정리 */
  const REGION = { B:'계양·부평 권역', K:'검단·강화 권역', M:'미추홀·제물포 권역', N:'남동·연수 권역', S:'서해·영종 권역' };
  /* 권역별 고유 색상 (상단 띠 색) — B파랑/K초록/M빨강/N보라/S노랑 */
  /* grad: 그라데이션(진한→연한), text: 글씨색 */
  const REGION_COLOR = {
    B:{ grad:'linear-gradient(90deg,#1565c0,#42a5f5)', text:'#ffffff' }, // 파랑
    K:{ grad:'linear-gradient(90deg,#2e7d32,#66bb6a)', text:'#ffffff' }, // 초록
    M:{ grad:'linear-gradient(90deg,#c62828,#ef5350)', text:'#ffffff' }, // 빨강
    N:{ grad:'linear-gradient(90deg,#6a1b9a,#ab47bc)', text:'#ffffff' }, // 보라
    S:{ grad:'linear-gradient(90deg,#f9a825,#ffee58)', text:'#5d4037' }  // 노랑(글씨 진한 갈색)
  };
  /* 장소 이름 (상단 띠 표시용) */
  const PLACE_NAME = {
    B01:'부평지하상가·굴포천', B02:'부평향교', B03:'계양산성박물관·계양산',
    K01:'강화고인돌', K02:'마니산', K03:'보문사', K04:'검단선사박물관', K05:'정서진',
    M01:'SSG랜더스필드', M02:'문학산', M03:'수봉공원·수봉별마루', M04:'차이나타운·홍예문',
    N01:'인천대공원', N02:'소래포구 어시장', N03:'센트럴파크·문보트', N04:'인천대교',
    S01:'인천국제공항', S02:'아라뱃길', S03:'청라호수공원·음악분수'
  };

  window.renderStoredProject = function (project, meta) {
    const core = window.MathTourProject;
    const CHAR_BASE = new URL('./student_images/', location.href).href;
    const doc = new DOMParser().parseFromString(project.program.html, 'text/html');
    const sections = Array.from(doc.querySelectorAll('section.scene'));
    if (!sections.length || sections.length > 50) throw new Error('invalid_story');
    const face = value => FACES.some(item => item.key === value) ? value : 'stand';
    const scenes = sections.map((section, i) => ({
      outer: section.outerHTML, title: section.getAttribute('data-title') || '장면 ' + (i + 1),
      gameNumber: section.hasAttribute('data-game') ? core.gameNumber(section.getAttribute('data-game')) : null,
      boyFace: face(section.getAttribute('data-boy-face')), girlFace: face(section.getAttribute('data-girl-face')),
      boyText: section.getAttribute('data-boy-text') || '', girlText: section.getAttribute('data-girl-text') || '',
      isProblem: /^(true|1|yes)$/i.test(section.getAttribute('data-problem') || ''), hint: section.getAttribute('data-hint') || ''
    }));
    const pics = {}, picSrc = {};
    (project.pictures || []).forEach(pic => { pics[pic.number] = pic.data; picSrc[pic.number] = pic.source; });
    const studentStyle = Array.from(doc.querySelectorAll('style')).map(style => style.textContent).join('\n');
    const studentScript = '', activeAssetPreview = '';
    const esc = value => String(value == null ? '' : value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  function boyImg(face){ return CHAR_BASE+face+'_boy.webp'; }
  function girlImg(face){ return CHAR_BASE+face+'_girl.webp'; }
  function replaceImgTags(text){
    return window.MathTourContent.replaceImages(text, pics);
  }

  function buildFullHtml({ preview = false } = {}){
    const placeId=meta.placeId;
    const topic=meta.topic || "";
    const regionKey=placeId.charAt(0);
    const regionName=REGION[regionKey]||'';
    const placeName=PLACE_NAME[placeId]||placeId;
    const rc=REGION_COLOR[regionKey]||{ grad:'linear-gradient(90deg,#1565c0,#1e88e5)', text:'#ffffff' };

    const charData = scenes.map(sc=>{
      // 이 장면이 실제로 쓰는 사진 번호만 골라 출처 모으기
      const used=[1,2,3].filter(n=>pics[n] && picSrc[n] && picSrc[n].trim() && (sc.creditSource || (gameAsset ? gameAsset.html : sc.outer)).indexOf('IMG'+n)!==-1);
      const credit = used.length ? ('사진 출처: '+used.map(n=>picSrc[n].trim()).join(' / ')) : '';
      return {
        boy: boyImg(sc.boyFace), boyText: sc.boyText, boyFace: sc.boyFace,
        girl: girlImg(sc.girlFace), girlText: sc.girlText, girlFace: sc.girlFace,
        isProblem: sc.isProblem, hint: sc.hint,
        credit: credit
      };
    });
    const sceneHtml = gameAsset ? '<iframe id="mt-game-asset" title="학생이 만든 게임" sandbox="allow-scripts allow-forms" style="width:100%;height:100%;border:0;display:block"></iframe><div id="mt-game-error" hidden style="position:absolute;inset:0;background:#fff5f5;color:#b71c1c;padding:20px;overflow:auto;z-index:10001"></div>' : replaceImgTags(scenes.map(sc=>sc.outer).join('\n'));
    const styleCss = gameAsset ? '' : window.MathTourContent.replaceImageCss(studentStyle, pics);
    const scriptJs = gameAsset ? buildAssetHostScript() : studentScript;

    const titleBar = esc(regionName)+' › '+esc(placeName)+(topic?' › '+esc(topic):'');

    return [
'<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">',
'<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>매쓰투어 미션</title>',
'<style>',
'*{box-sizing:border-box;}html,body{margin:0;height:100%;}',
'body{font-family:"맑은 고딕","Malgun Gothic",sans-serif;background:#eaf2fb;display:flex;justify-content:center;align-items:center;overflow:hidden;}',
'#mt-stage{width:100%;height:100%;display:flex;flex-direction:column;position:relative;}',
/* 상단 권역·장소·주제 띠 — 색상은 권역별로 아래 인라인 style에서 지정, 글자크기 15px */
'#mt-topbar{flex:0 0 auto;font-size:15px;font-weight:bold;padding:7px 14px;text-align:center;line-height:1.3;word-break:break-word;}',
'#mt-body{flex:1 1 auto;display:flex;align-items:stretch;min-height:0;}',
/* 양옆 패널: 22:9 전체에서 16:9 뺀 나머지를 반씩 */
'.mt-side{flex:1 1 0;background:#fff;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding:10px 6px;min-width:70px;overflow:hidden;position:relative;}',
'.mt-side img.mt-char{width:100%;max-width:240px;object-fit:contain;max-height:80%;}',

/* 사진 출처 — 오른쪽 흰 패널 맨 위, 두 줄까지만, 넘치면 … / 마우스 올리면 title로 전체 보임 — 글자크기 9px */
'#mt-credit{position:absolute;top:4px;left:4px;right:4px;color:#607d8b;font-size:9px;line-height:1.3;text-align:left;word-break:break-all;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;max-height:24px;z-index:5;}',
'#mt-credit:empty{display:none;}',
/* 말풍선 — 진한 회색 바탕 + 흰 글씨 (글자크기 14px) */
'.mt-bubble{background:rgba(55,55,60,.92);border:none;border-radius:16px;padding:9px 12px;font-size:14px;line-height:1.45;color:#ffffff;margin-bottom:8px;width:100%;word-break:break-word;box-shadow:0 2px 6px rgba(0,0,0,.18);}',
'.mt-bubble:empty{display:none;}',
'.mt-bubble.mt-hinting{background:rgba(93,64,55,.95);color:#fff3e0;}',
/* 가운데 게임: 세로 높이를 꽉 쓰고 16:9 비율 유지 */
'.mt-center{flex:0 0 auto;height:100%;aspect-ratio:16/9;align-self:center;position:relative;overflow:hidden;}',
/* 힌트 버튼 — 가운데 아래로 이동 — 글자크기 */
'#mt-hintBtn{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);background:#ffb300;color:#fff;border:none;border-radius:10px;padding:6px 14px;font-size:13px;cursor:pointer;z-index:9999;white-space:nowrap;}',
'#mt-hintBtn.mt-on{background:#f57c00;}',
/* 미션 완료 — 글자크기 */
'#mt-clear{position:absolute;inset:0;background:rgba(232,245,233,.97);display:none;flex-direction:column;justify-content:center;align-items:center;font-size:22px;font-weight:bold;color:#2e7d32;z-index:10000;}',
'#mt-center-host{width:100%;height:100%;position:relative;}',
'#mt-center-host > #stage, #mt-center-host > div{width:100%;height:100%;max-width:100%!important;}',
'</style>',
'<style>'+styleCss+'</style>',
'</head><body>',
'<div id="mt-stage">',
'<div id="mt-topbar" style="background:'+rc.grad+';color:'+rc.text+';">'+titleBar+'</div>',
'<div id="mt-body">',
'<div class="mt-side"><div class="mt-bubble" id="mt-boyBubble"></div><img class="mt-char" id="mt-boyImg" src=""></div>',
'<div class="mt-center"><div id="mt-center-host">'+sceneHtml+'</div>',
'<button id="mt-hintBtn" style="display:none" onclick="mtToggleHint()">💡 힌트 보기</button>',
'<div id="mt-clear">'+(preview ? '미리보기 확인 완료' : '✨ 미션 완료! ✨')+'<div style="font-size:15px;margin-top:8px;">'+(preview ? '표정·대사·장면 순서를 확인했어요' : '보석을 받았어요')+'</div></div>',
'</div>',
'<div class="mt-side"><div id="mt-credit"></div><div class="mt-bubble" id="mt-girlBubble"></div><img class="mt-char" id="mt-girlImg" src=""></div>',
'</div>',
'</div>',
'<script>',
'var MT_CHAR='+scriptJSON(charData)+';',
'var CHAR_BASE='+JSON.stringify(CHAR_BASE)+';',
'var mt_done=false;',
/* 학생(AI) 코드가 호출만 하면 되도록 window에 명시적으로 정의 */
'window.missionClear=function(){if(mt_done)return;mt_done=true;var m=document.getElementById("mt-clear");if(m)m.style.display="flex";try{window.parent.postMessage({type:"MISSION_CLEAR"},"*");}catch(e){}};',
/* 힌트 토글: 여학생 말풍선에 띄우고 표정을 생각중으로 */
'var mt_hintOn=false;',
'function mtToggleHint(){',
'  var i=mtVisibleIndex();var c=MT_CHAR[i]||{};',
'  var gb=document.getElementById("mt-girlBubble");',
'  var gi=document.getElementById("mt-girlImg");',
'  var hb=document.getElementById("mt-hintBtn");',
'  mt_hintOn=!mt_hintOn;',
'  if(mt_hintOn && c.hint && c.hint.trim()){',
'    gb.textContent="💡 "+c.hint;',
'    gb.classList.add("mt-hinting");',
'    gi.src=CHAR_BASE+"thinking_girl.webp";',
'    if(hb)hb.classList.add("mt-on");',
'  }else{',
'    gb.textContent=c.girlText||"";',
'    gb.classList.remove("mt-hinting");',
'    gi.src=c.girl||"";',
'    if(hb)hb.classList.remove("mt-on");',
'  }',
'}',
'function mtSceneList(){return Array.from(document.querySelectorAll("section.scene"));}',
'function mtVisibleIndex(){var ss=mtSceneList();for(var i=0;i<ss.length;i++){var st=getComputedStyle(ss[i]);if(st.display!=="none"&&st.visibility!=="hidden"&&ss[i].offsetParent!==null){return i;}}return 0;}',
'function mtPaint(){var i=mtVisibleIndex();var c=MT_CHAR[i]||MT_CHAR[0]||{};',
'  mt_hintOn=false;',
'  document.getElementById("mt-boyImg").src=c.boy||"";',
'  document.getElementById("mt-girlImg").src=c.girl||"";',
'  document.getElementById("mt-boyBubble").textContent=c.boyText||"";',
'  var gb=document.getElementById("mt-girlBubble");gb.textContent=c.girlText||"";gb.classList.remove("mt-hinting");',
'  var cr=document.getElementById("mt-credit");if(cr){cr.textContent=c.credit||"";cr.title=c.credit||"";}',
'  var hb=document.getElementById("mt-hintBtn");',
'  if(hb){hb.classList.remove("mt-on");if(c.isProblem&&c.hint&&c.hint.trim()){hb.style.display="block";}else{hb.style.display="none";}}',
'}',
'var mtObs=new MutationObserver(function(){mtPaint();});',
'mtSceneList().forEach(function(s){mtObs.observe(s,{attributes:true,attributeFilter:["class","style"]});});',
scriptJs,
'setTimeout(mtPaint,60);',
gameAsset ? '' : 'if(mtSceneList().length===0){missionClear();}',
'<\/script></body></html>'
    ].join('\n');
  }


function gameAssetBridge(channel) {
  let completed = false;
  let previousIndex = -1;
  const send = (event, detail) => window.parent.postMessage(Object.assign({ type: 'MT_GAME_ASSET', channel, event }, detail || {}), '*');
  window.missionClear = function () {
    if (completed) return;
    completed = true;
    send('complete');
  };
  // 게임의 submit 이벤트는 실행하되 페이지 이동은 하지 않는다.
  document.addEventListener('submit', function (event) { event.preventDefault(); });
  window.addEventListener('error', function (event) {
    send('error', { message: event.message || '게임에서 실행 오류가 발생했어요.' });
  });
  window.addEventListener('unhandledrejection', function (event) {
    send('error', { message: String(event.reason && event.reason.message || event.reason || '게임 실행 오류') });
  });
  function reportScene() {
    const list = Array.from(document.querySelectorAll('section.scene'));
    let index = list.findIndex(function (section) {
      const style = getComputedStyle(section);
      return style.display !== 'none' && style.visibility !== 'hidden' && section.getClientRects().length > 0;
    });
    if (!list.length) index = 0;
    if (index >= 0 && index !== previousIndex) {
      previousIndex = index;
      send('scene', { index });
    }
  }
  function ready() {
    reportScene();
    new MutationObserver(reportScene).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    window.addEventListener('resize', reportScene);
    send('ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
}

function scriptJSON(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function buildAssetDocument(channel) {
  const doc = new DOMParser().parseFromString(replaceImgTags(gameAsset.html), 'text/html');
  const bridge = doc.createElement('script');
  bridge.textContent = '(' + gameAssetBridge.toString() + ')(' + JSON.stringify(channel) + ');';
  doc.head.prepend(bridge);
  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

function buildAssetHostScript() {
  const channel = 'mt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const source = buildAssetDocument(channel);
  return [
    'var mt_assetScene=0;',
    'mtVisibleIndex=function(){return mt_assetScene;};',
    '(function(){',
    'var frame=document.getElementById("mt-game-asset");',
    'var channel=' + scriptJSON(channel) + ';',
    'var previewRun=' + scriptJSON(activeAssetPreview) + ';',
    'var failed=false;',
    'function report(state,message){window.parent.postMessage({type:"MT_ASSET_PREVIEW",run:previewRun,state:state,message:message||""},"*");}',
    'window.addEventListener("message",function(event){',
    ' var d=event.data;',
    ' if(event.source!==frame.contentWindow||!d||d.type!=="MT_GAME_ASSET"||d.channel!==channel)return;',
    ' if(d.event==="scene"&&Number.isInteger(d.index)&&d.index>=0&&d.index<MT_CHAR.length){mt_assetScene=d.index;mtPaint();}',
    ' if(d.event==="ready")report("ready");',
    ' if(d.event==="error"){failed=true;var box=document.getElementById("mt-game-error");box.textContent="게임 실행 오류: "+String(d.message||"");box.hidden=false;report("error",String(d.message||""));}',
    ' if(d.event==="complete"&&!failed){report("complete");window.missionClear();}',
    '});',
    'frame.srcdoc=' + scriptJSON(source) + ';',
    '})();'
  ].join('\n');
}


    const steps = scenes.map((scene, i) => {
      const channel = 'stored-' + i + '-' + crypto.randomUUID();
      let html;
      if (scene.gameNumber) {
        const game = project.games.find(game => game.number === scene.gameNumber);
        if (!game) throw new Error('missing_game');
        scene.creditSource = game.html;
        const gameDoc = new DOMParser().parseFromString(replaceImgTags(game.html), 'text/html');
        const script = gameDoc.createElement('script'); script.textContent = '(' + gameAssetBridge.toString() + ')(' + JSON.stringify(channel) + ');'; gameDoc.head.prepend(script);
        html = '<!doctype html>' + gameDoc.documentElement.outerHTML;
      } else {
        scene.creditSource = scene.outer;
        html = window.MathTourContent.storyDocument(scene.outer, studentStyle, pics);
      }
      return { title: scene.title, game: scene.gameNumber, channel, html };
    });
    const gameAsset = { name: 'storyboard.html', html: core.tourDocument(steps), hasScenes: true };
    return buildFullHtml();
  };
})();
