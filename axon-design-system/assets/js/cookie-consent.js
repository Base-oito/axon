(function(){
var IS_CSR = false;
var resolveLocal = window.__resolveLocal || function(){return null;};
var rewriteSrcset = window.__rewriteSrcset || function(s){return s;};
function fixImg(el){
  if (!el || el.tagName !== 'IMG') return;
  var src = el.getAttribute('src');
  var loc = resolveLocal(src);
  if (loc && src !== loc) el.setAttribute('src', loc);
  var ss = el.getAttribute('srcset');
  if (ss) {
    var nss = rewriteSrcset(ss);
    if (nss !== ss) el.setAttribute('srcset', nss);
  }
}
function fixAll(){ document.querySelectorAll('img').forEach(fixImg); }
function hasSlideOffset(t){
  // True if a transform indicates a 'parked off-screen' starting
  // state: translation in px (>= 30) or % (>= 5), or a matrix
  // with non-zero translation. Returns false for crossfade-only
  // companions like scale(0.9) or pure centering translateX(-50%).
  if (!t || t === 'none') return false;
  // matrix(a,b,c,d,tx,ty) — parse tx/ty; matrix3d & friends → assume slide.
  var matMatch = t.match(/matrix\(([^)]+)\)/);
  if (matMatch) {
    var parts = matMatch[1].split(',').map(function(x){return parseFloat(x.trim());});
    if (parts.length === 6) {
      if (Math.abs(parts[4]) >= 30 || Math.abs(parts[5]) >= 30) return true;
    } else { return true; }
  }
  if (/matrix3d/i.test(t)) return true;
  var px = t.match(/(-?\d+\.?\d*)px/g) || [];
  for (var i = 0; i < px.length; i++) {
    if (Math.abs(parseFloat(px[i])) >= 30) return true;
  }
  var pct = t.match(/(-?\d+\.?\d*)%/g) || [];
  for (var j = 0; j < pct.length; j++) {
    if (Math.abs(parseFloat(pct[j])) >= 5) return true;
  }
  return false;
}
function isHiddenStart(s){
  // True if the element's inline style is parked at a 'before'
  // animation state. opacity:0 alone is ambiguous (could be a
  // crossfade companion); pair it with a slide transform OR an
  // explicit visibility:hidden (GSAP/SplitType signature) to be
  // confident it's a scroll-reveal waiting to fire.
  if (s.opacity !== '0' && s.visibility !== 'hidden') return false;
  if (s.visibility === 'hidden') return true;
  return hasSlideOffset(s.transform) || hasSlideOffset(s.translate);
}
function revealEl(el){
  var s = el.style;
  s.opacity = '1';
  if (s.visibility === 'hidden') s.visibility = 'visible';
  if (s.transform) s.transform = 'none';
  if (s.translate) s.translate = 'none';
  if (s.rotate)    s.rotate = 'none';
  if (s.scale)     s.scale = 'none';
  if (s.pointerEvents === 'none') s.pointerEvents = '';
}
function snapReveal(){
  // Safety net: any 'before-state' element still hidden gets
  // forced visible. Used as a deadline pass for non-CSR mode
  // (after GSAP/etc had a chance to play) and as a final guard.
  // Skip pinned-chain elements — same reason as findScrollAnchor.
  var n = 0;
  document.querySelectorAll('[style]').forEach(function(el){
    if (!isHiddenStart(el.style)) return;
    if (isInsideFixed(el)) return;
    revealEl(el); n++;
  });
  if (window.console && n) console.log('[offline-fix] snap-revealed', n);
}
function isInsideFixed(el){
  var p = el;
  while (p && p !== document.documentElement) {
    if (getComputedStyle(p).position === 'fixed') return true;
    p = p.parentElement;
  }
  return false;
}
function findScrollAnchor(el){
  // Pinned-narrative sections (one position:fixed ancestor wrapping
  // many sequenced headings the live JS reveals one-by-one across
  // scroll progress) can't be orchestrated offline — revealing all
  // of them at once produces an overlapping mess. Skip them: leave
  // the parked state intact, matching the live site at scroll=0.
  // For sticky chains, observe the sticky container itself (fires
  // when the user has scrolled past its stuck threshold).
  if (isInsideFixed(el)) return null;
  var p = el;
  while (p && p !== document.documentElement) {
    if (getComputedStyle(p).position === 'sticky') return p;
    p = p.parentElement;
  }
  return el;
}
function progressiveReveal(){
  // CSR mode: scripts stripped → no GSAP/IO is going to fire.
  // Mimic a scroll-driven reveal: each parked element gets a
  // CSS transition + IntersectionObserver. As it enters viewport
  // we transition to the 'after' state, with a small stagger by
  // document order so SplitType chars still feel letter-by-letter.
  var targets = [];
  document.querySelectorAll('[style]').forEach(function(el){
    if (isHiddenStart(el.style)) targets.push(el);
  });
  if (!targets.length) return;
  var EASE = 'cubic-bezier(.16,1,.3,1)';
  targets.forEach(function(el){
    el.style.transition =
      'opacity .6s ' + EASE + ', transform .6s ' + EASE + ', ' +
      'translate .6s ' + EASE + ', scale .6s ' + EASE + ', ' +
      'visibility 0s linear';
  });
  if (typeof IntersectionObserver === 'undefined') {
    targets.forEach(revealEl);
    return;
  }
  // Group targets by their scroll anchor. Anchors in sticky
  // sections share one observation point — when that anchor
  // intersects, we reveal all its parked descendants.
  // Targets with null anchor (inside position:fixed) are skipped.
  var groups = new Map();
  targets.forEach(function(el){
    var anchor = findScrollAnchor(el);
    if (!anchor) return;
    if (!groups.has(anchor)) groups.set(anchor, []);
    groups.get(anchor).push(el);
  });
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (!entry.isIntersecting) return;
      var children = groups.get(entry.target) || [entry.target];
      children.sort(function(a, b){
        var pos = a.compareDocumentPosition(b);
        return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
      });
      children.forEach(function(child, i){
        var delay = Math.min(i * 18, 700);
        setTimeout(function(){ revealEl(child); }, delay);
      });
      io.unobserve(entry.target);
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -8% 0px' });
  groups.forEach(function(_, anchor){ io.observe(anchor); });
  // Deadline guard: anything that never intersects still gets revealed.
  setTimeout(snapReveal, 8000);
}
function initUnicornStudio(){
  // Captured page already has the loaded UMD script + the inline
  // loader that says `if(!window.UnicornStudio)…`. The loader bails
  // because UnicornStudio is already defined, so init() never runs.
  if (window.UnicornStudio && typeof window.UnicornStudio.init === 'function'
      && !window.UnicornStudio.isInitialized) {
    try { window.UnicornStudio.init(); window.UnicornStudio.isInitialized = true; }
    catch(e){ if(window.console) console.warn('[offline-fix] UnicornStudio init failed:', e); }
  }
}
// Initial img sweep + observer for hydration-time updates
fixAll();
var obs = new MutationObserver(function(muts){
  for (var i = 0; i < muts.length; i++) {
    var m = muts[i];
    if (m.type === 'attributes' && m.target.tagName === 'IMG') fixImg(m.target);
    for (var j = 0; j < m.addedNodes.length; j++) {
      var n = m.addedNodes[j];
      if (n && n.nodeType === 1) {
        if (n.tagName === 'IMG') fixImg(n);
        if (n.querySelectorAll) n.querySelectorAll('img').forEach(fixImg);
      }
    }
  }
});
obs.observe(document, {childList:true, subtree:true,
  attributes:true, attributeFilter:['src','srcset']});
setTimeout(fixAll, 1000);
setTimeout(fixAll, 3000);
var go = function(){
  // CSR: scripts stripped, so 'before-state' elements stay parked
  // forever unless we do something. Use IntersectionObserver to
  // reveal them progressively as the user scrolls — preserves the
  // scroll-triggered animation feel for SplitType chars, etc.
  // Non-CSR: GSAP/Framer may still play; let them, then catch any
  // leftovers with a snap pass at 5 s.
  if (IS_CSR) progressiveReveal();
  else setTimeout(snapReveal, 5000);
  initUnicornStudio();
  setTimeout(initUnicornStudio, 500);
  setTimeout(initUnicornStudio, 2000);
};
if (document.readyState === 'complete') go();
else window.addEventListener('load', go);
})();