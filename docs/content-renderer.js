/* Bind uploaded photos by HTML context, never by replacing visible text with a data URL. */
(function (root) {
  'use strict';
  const photo = (pictures, slot) => typeof pictures?.[slot.slice(3)] === 'string' ? pictures[slot.slice(3)] : '';
  function replaceImageCss(css, pictures) {
    return String(css).replace(/url\(\s*(['"]?)(IMG[123])\1\s*\)/g,
      (whole, quote, slot) => photo(pictures, slot) ? 'url("' + photo(pictures, slot) + '")' : whole);
  }
  function replaceImageScript(script, pictures) {
    return script.replace(/(['"\x60])(IMG[123])\1/g,
      (whole, quote, slot) => photo(pictures, slot) ? quote + photo(pictures, slot) + quote : whole);
  }
  function replaceImages(html, pictures) {
    const fullDocument = /<!doctype\b|<html[\s>]/i.test(html);
    const doc = new root.DOMParser().parseFromString(html, 'text/html');
    for (const element of doc.querySelectorAll('*')) {
      for (const name of ['src', 'poster', 'href', 'xlink:href']) {
        const value = element.getAttribute(name)?.trim();
        if (/^IMG[123]$/.test(value || '') && photo(pictures, value)) element.setAttribute(name, photo(pictures, value));
      }
      if (element.hasAttribute('style')) element.setAttribute('style', replaceImageCss(element.getAttribute('style'), pictures));
      for (const attribute of Array.from(element.attributes)) {
        if (/^on/i.test(attribute.name)) element.setAttribute(attribute.name, replaceImageScript(attribute.value, pictures));
      }
    }
    for (const style of doc.querySelectorAll('style')) style.textContent = replaceImageCss(style.textContent, pictures);
    for (const script of doc.querySelectorAll('script')) script.textContent = replaceImageScript(script.textContent, pictures);

    // AI sometimes emits [사진 자료: IMG1] or a standalone IMG1 instead of an img element.
    const walker = doc.createTreeWalker(doc.body, 4); // SHOW_TEXT
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.parentElement?.closest('script,style,textarea,title,pre,code,noscript,option')) continue;
      const text = node.textContent;
      const pattern = /^\s*IMG[123]\s*$/.test(text) ? /\b(IMG[123])\b/g
        : /\[\s*(?:(?:사진(?:\s*자료)?|이미지)\s*[:：]?\s*)?(IMG[123])\s*\]/g;
      const matches = Array.from(text.matchAll(pattern));
      if (!matches.some(match => photo(pictures, match[1]))) continue;
      const fragment = doc.createDocumentFragment();
      let offset = 0;
      for (const match of matches) {
        fragment.appendChild(doc.createTextNode(text.slice(offset, match.index)));
        const source = photo(pictures, match[1]);
        if (source) {
          const img = doc.createElement('img');
          img.setAttribute('src', source);
          img.setAttribute('alt', '사진 ' + match[1].slice(3));
          img.setAttribute('data-mathtour-photo', match[1]);
          img.style.cssText = 'display:block;width:auto;height:auto;max-width:100%;max-height:55vh;object-fit:contain;margin:8px auto;';
          fragment.appendChild(img);
        } else fragment.appendChild(doc.createTextNode(match[0]));
        offset = match.index + match[0].length;
      }
      fragment.appendChild(doc.createTextNode(text.slice(offset)));
      node.replaceWith(fragment);
    }
    return fullDocument ? '<!doctype html>\n' + doc.documentElement.outerHTML : doc.head.innerHTML + doc.body.innerHTML;
  }
  function storyDocument(source, css, pictures) {
    const doc = new root.DOMParser().parseFromString(source, 'text/html');
    const section = doc.querySelector('section.scene');
    if (!section) throw new Error('본문 장면을 찾지 못했어요.');
    section.removeAttribute('hidden');
    section.style.cssText += ';display:block!important;visibility:visible!important;position:relative!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:100%;';
    // A standalone full-screen body must not center and crop a tall imported story.
    const frameStyle = 'html{height:auto!important;min-height:100%;overflow-x:hidden!important}' +
      'body{display:block!important;position:static!important;width:100%!important;max-width:100%!important;height:auto!important;min-height:100%;margin:0!important;padding:14px;overflow-x:hidden!important;overflow-y:auto!important}' +
      'img{max-width:100%}';
    return replaceImages('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Malgun Gothic,sans-serif}' + css + '</style><style>' + frameStyle + '</style></head><body>' + section.outerHTML + '</body></html>', pictures);
  }
  root.MathTourContent = { replaceImages, replaceImageCss, storyDocument };
})(window);
