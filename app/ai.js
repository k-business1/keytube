// ═══════════════════════════════════════════════════════════════
//  ai.js — KEYTUBE AI (dark UI)
//  Two backends:
//    1) COMMON script → api('aiQuery')   (../app/api.js) — KEYTUBE questions
//    2) DEEP script   → DEEP_URL         (Code.gs)       — web research, Wikipedia, images
//  Flow: KEYTUBE script first → if it has no answer → deep search.
//        Image requests and the Web / Image modes go straight to deep search.
// ═══════════════════════════════════════════════════════════════

var DEEP_URL     = 'https://script.google.com/macros/s/AKfycbzsixduDHGQkuUkXRLDhIjdOgCLLnHWKIM0HiCPTOEQNg0zcjbYsaKkteCEXOWu1LEK/exec';   // ← Code.gs /exec URL
var PAGES_BASE   = '../pages/';
var KT_TIMEOUT   = 15000;
var DEEP_TIMEOUT = 30000;

var _aiHistory = [];
var _aiBusy    = false;
var _aiGen     = 0;       // bumps on "new chat" so late replies are dropped
var _aiMode    = null;    // null | 'web' | 'images'

var ICON = {
  trend:  '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>',
  upload: '<path d="M12 16V4"/><polyline points="7 9 12 4 17 9"/><path d="M4 20h16"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>',
  image:  '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><polyline points="21 16 15 10 6 20"/>',
  chev:   '<polyline points="9 6 15 12 9 18"/>'
};

var _CARDS = [
  { icon: 'trend',  color: '#7c8cff', title: 'Trending movies',  sub: 'See what is popular on KEYTUBE',        q: 'What movies are trending?' },
  { icon: 'upload', color: '#34d399', title: 'Upload and earn',  sub: 'Channels, uploads and monetization',    q: 'How do I earn money?' },
  { icon: 'search', color: '#38bdf8', title: 'Search the web',   sub: 'Research any topic with a summary',     mode: 'web' },
  { icon: 'image',  color: '#c084fc', title: 'Find images',      sub: 'Search pictures from across the web',   mode: 'images' }
];

var _EMOJIS = ['😀','😂','😍','😎','🤔','👍','🙏','🔥','🎬','🍿','⭐','❤️','🎉','😢','😮','👋'];

// ── HELPERS ───────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function svg(inner, size, stroke) {
  return '<svg width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="' +
    (stroke || 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
}

function h(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeUrl(u) {
  u = String(u || '').trim();
  return /^https?:\/\//i.test(u) ? u : '';
}

function domainOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}

function fmtTime() {
  var d = new Date();
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

function currentUser() {
  try { return typeof getUser === 'function' ? getUser() : null; } catch (e) { return null; }
}

function firstNameOf(u) {
  if (!u) return '';
  var raw = String(u.name || u.username || u.fullname || '').trim();
  if (!raw) return '';
  var p = raw.split(/\s+/)[0];
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

function scrollChat() {
  var c = $('aiChat');
  if (c) c.scrollTop = c.scrollHeight;
}

// textarea auto-grow (kept only if api.js doesn't already provide one)
if (typeof window.autoResize !== 'function') {
  window.autoResize = function (t) {
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 120) + 'px';
  };
}

// ── INIT ──────────────────────────────────────────────────────
function initAIChat() {
  var name = firstNameOf(currentUser());
  var t = $('aiHeroTitle');
  if (t) t.textContent = name ? 'Hello, ' + name + '!' : 'Hello!';
  renderCards();
  renderEmojis();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAIChat);
else initAIChat();

function renderCards() {
  var wrap = $('aiSuggestions');
  if (!wrap) return;
  wrap.innerHTML = '';
  _CARDS.forEach(function (c, i) {
    var b = el('button', 'ai-card');
    b.type = 'button';
    b.setAttribute('data-card', i);
    b.innerHTML =
      '<span class="ai-card-ic" style="color:' + c.color + '">' + svg(ICON[c.icon], 22) + '</span>' +
      '<span class="ai-card-tx"><span class="ai-card-t">' + h(c.title) + '</span><span class="ai-card-s">' + h(c.sub) + '</span></span>' +
      '<span class="ai-card-ch">' + svg(ICON.chev, 18) + '</span>';
    wrap.appendChild(b);
  });
}

function renderEmojis() {
  var pop = $('aiEmojiPop');
  if (!pop) return;
  pop.innerHTML = '';
  _EMOJIS.forEach(function (e) {
    var b = el('button', 'ai-emoji', e);
    b.type = 'button';
    pop.appendChild(b);
  });
}

// ── MODE (plus menu) ──────────────────────────────────────────
function setMode(m) {
  _aiMode = m || null;
  var chip = $('aiModeChip'), inp = $('aiInput');
  if (chip) {
    if (_aiMode) {
      chip.hidden = false;
      chip.innerHTML = '<span>' + (_aiMode === 'images' ? '🖼 Image search' : '🌐 Web search') + '</span>' +
        '<button type="button" class="ai-chip-x" data-act="clear-mode" aria-label="Remove mode">✕</button>';
    } else {
      chip.hidden = true;
      chip.innerHTML = '';
    }
  }
  if (inp) {
    inp.placeholder = _aiMode === 'images' ? 'Describe the image to find…'
                    : _aiMode === 'web'    ? 'Search the web…'
                    : 'Type a message…';
  }
}

function closePops() {
  var a = $('aiPlusMenu'), b = $('aiEmojiPop');
  if (a) a.hidden = true;
  if (b) b.hidden = true;
}

function togglePop(id) {
  var p = $(id);
  if (!p) return;
  var open = p.hidden;
  closePops();
  p.hidden = !open;
}

// ── SEND / ROUTE ──────────────────────────────────────────────
function setBusy(b) {
  _aiBusy = b;
  var s = document.querySelector('.ai-send-btn');
  if (s) s.classList.toggle('busy', b);
}

function sendAIMessage() {
  if (_aiBusy) return;
  var input = $('aiInput');
  var q = (input.value || '').trim();
  if (!q) return;
  input.value = '';
  window.autoResize(input);
  closePops();

  var mode = _aiMode;
  setMode(null);

  appendUserMessage(q);
  var ctx = { gen: _aiGen, typingId: showTyping('') };
  setBusy(true);

  if (mode) return runDeep(q, mode, ctx, null);
  if (isImageIntent(q) && !/key\s?tube/i.test(q)) return runDeep(q, 'images', ctx, null);

  askKeytube(q, function (r) {
    if (ctx.gen !== _aiGen) return;
    if (r && r.ok && r.matched) {
      removeTyping(ctx.typingId);
      setBusy(false);
      appendAIMessage(r.response, r.movieLinks || {}, true, true, q);
    } else {
      runDeep(q, null, ctx, r);          // not about KEYTUBE → deep search
    }
  });
}

function isImageIntent(q) {
  return /\b(images?|pictures?|photos?|pics?|wallpapers?)\b/i.test(q) || /\bwhat (does|do) .+ look like\b/i.test(q);
}

// KEYTUBE script (common) — always calls back, even on network failure
function askKeytube(q, cb) {
  var done = false;
  var t = setTimeout(function () { if (!done) { done = true; cb(null); } }, KT_TIMEOUT);
  try {
    api('aiQuery', { query: q }, function (r) {
      if (done) return;
      done = true; clearTimeout(t); cb(r);
    });
  } catch (e) {
    if (!done) { done = true; clearTimeout(t); cb(null); }
  }
}

// Deep search script (Code.gs)
function deepApi(payload, cb) {
  if (!DEEP_URL || DEEP_URL.indexOf('PASTE_') === 0) { cb({ ok: false, msg: 'not_configured' }); return; }
  var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var t = setTimeout(function () { if (ctl) ctl.abort(); }, DEEP_TIMEOUT);
  fetch(DEEP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow',
    signal: ctl ? ctl.signal : undefined
  }).then(function (r) { return r.json(); })
    .then(function (j) { clearTimeout(t); cb(j); })
    .catch(function () { clearTimeout(t); cb({ ok: false, msg: 'network' }); });
}

function runDeep(q, mode, ctx, ktResp) {
  setTypingLabel(ctx.typingId, mode === 'images' ? 'Searching images…' : 'Searching the web…');
  deepApi({ action: 'deepSearch', query: q, mode: mode || '' }, function (r) {
    if (ctx.gen !== _aiGen) return;
    removeTyping(ctx.typingId);
    setBusy(false);
    if (r && r.ok) appendDeepMessage(r, q);
    else appendDeepError(q, r, ktResp);
  });
}

// ── MESSAGES ──────────────────────────────────────────────────
function appendUserMessage(text) {
  var msgs = $('aiMsgs');
  if (!msgs) return;
  var w = el('div', 'ai-msg ai-msg-user');
  var b = el('div', 'ai-bubble user-bubble');
  var t = el('span', 'ai-utext', text);
  var m = el('div', 'ai-meta');
  m.innerHTML = '<span>' + fmtTime() + '</span>' + svg('<polyline points="2 13 6 17 13 8"/><polyline points="10 15 12 17 20 7"/>', 14);
  b.appendChild(t);
  b.appendChild(m);
  w.appendChild(b);
  msgs.appendChild(w);
  scrollChat();
  _aiHistory.push({ role: 'user', text: text });
}

function createAIShell() {
  var wrap = el('div', 'ai-msg ai-msg-ai');
  var av = el('div', 'ai-av');
  var img = new Image();
  img.alt = 'AI';
  img.onerror = function () { img.onerror = null; img.src = '../imagelib/logo.png'; };
  img.src = '../imagelib/ailogo.png';
  av.appendChild(img);
  var col = el('div', 'ai-col');
  var bubble = el('div', 'ai-bubble bot-bubble');
  col.appendChild(bubble);
  col.appendChild(el('div', 'ai-time', fmtTime()));
  wrap.appendChild(av);
  wrap.appendChild(col);
  $('aiMsgs').appendChild(wrap);
  scrollChat();
  return { wrap: wrap, col: col, bubble: bubble };
}

function appendAIMessage(text, movieLinks, doStream, matched, originalQuery) {
  if (!$('aiMsgs')) return;
  var sh = createAIShell();

  function after() {
    if (matched === false) sh.col.insertBefore(submitRow(originalQuery), sh.col.lastChild);
    scrollChat();
    _aiHistory.push({ role: 'ai', text: text });
  }

  if (doStream) streamText(sh.bubble, text, movieLinks || {}, after);
  else { sh.bubble.innerHTML = formatResponse(text, movieLinks || {}); after(); }
}

function submitRow(q) {
  var row = el('div', 'ai-submit-row');
  var b = el('button', 'ai-submit-q-btn', '📩 Send this question to our team');
  b.type = 'button';
  b.setAttribute('data-q', q || '');
  row.appendChild(b);
  return row;
}

// ── DEEP SEARCH CARD ──────────────────────────────────────────
function appendDeepMessage(r, q) {
  var sh = createAIShell(), b = sh.bubble;
  var isImg = r.mode === 'images';
  var topic = r.topic || q;

  b.appendChild(el('div', 'ai-tag', isImg ? '🖼 Image results' : '🌐 Web research'));
  var body = el('div', 'ai-deep-text');
  b.appendChild(body);

  var intro;
  if (isImg) {
    intro = (r.images && r.images.length)
      ? 'Here are images for “' + topic + '”. Tap one to enlarge.'
      : 'I couldn’t find images for “' + topic + '”.';
  } else {
    intro = (r.answer ? '**' + r.answer + '**\n\n' : '') + (r.summary || 'Here is what I found.');
  }

  streamText(body, intro, {}, function () {
    finishDeep(b, r, q, topic);
    _aiHistory.push({ role: 'ai', text: intro });
  }, { simple: true });
}

function finishDeep(b, r, q, topic) {
  if (r.points && r.points.length) {
    var ul = el('ul', 'ai-points');
    r.points.forEach(function (p) {
      var li = el('li');
      li.innerHTML = formatResponse(p, {}, { simple: true });
      ul.appendChild(li);
    });
    b.appendChild(ul);
  }
  if (r.images && r.images.length) b.appendChild(buildGallery(r.images, topic));
  if (r.sources && r.sources.length) b.appendChild(buildSources(r.sources));

  var chips = el('div', 'ai-chips');
  if (r.mode !== 'images') chips.appendChild(chipBtn('🖼 Images of this', topic, 'images'));
  (r.related || []).slice(0, 3).forEach(function (t) { chips.appendChild(chipBtn('🔍 ' + t, t, 'web')); });
  (r.moreLinks || []).forEach(function (l) {
    var u = safeUrl(l.url);
    if (!u) return;
    var a = el('a', 'ai-chip ai-chip-link', '↗ ' + l.title);
    a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
    chips.appendChild(a);
  });
  if (chips.childNodes.length) b.appendChild(chips);
  scrollChat();
}

function chipBtn(label, q, mode) {
  var b = el('button', 'ai-chip', label);
  b.type = 'button';
  b.setAttribute('data-q', q);
  b.setAttribute('data-mode', mode);
  return b;
}

function buildGallery(images, topic) {
  var g = el('div', 'ai-gallery');
  images.forEach(function (im) {
    var thumb = safeUrl(im.thumb || im.full);
    if (!thumb) return;
    var a = el('a', 'ai-gimg');
    a.href = safeUrl(im.full) || thumb;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = im.title || '';
    a._im = im;
    var img = new Image();
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.alt = im.title || topic;
    img.onerror = function () { a.style.display = 'none'; };
    img.src = thumb;
    a.appendChild(img);
    g.appendChild(a);
  });
  return g;
}

function buildSources(list) {
  var box = el('div', 'ai-sources');
  box.appendChild(el('div', 'ai-sources-t', 'Sources'));
  list.forEach(function (s) {
    var u = safeUrl(s.url);
    if (!u) return;
    var a = el('a', 'ai-src');
    a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
    a.appendChild(el('span', 'ai-src-t', s.title || domainOf(u)));
    a.appendChild(el('span', 'ai-src-d', domainOf(u)));
    if (s.snippet) a.appendChild(el('span', 'ai-src-s', s.snippet));
    box.appendChild(a);
  });
  return box;
}

function appendDeepError(q, r, ktResp) {
  // Deep search unavailable → show the KEYTUBE script's own reply if it had one
  if (ktResp && ktResp.ok && ktResp.response) {
    appendAIMessage(ktResp.response, ktResp.movieLinks || {}, true, false, q);
    return;
  }
  var sh = createAIShell(), b = sh.bubble;
  var msg;
  if (r && r.msg === 'not_configured') msg = 'Web search is not set up yet. The admin needs to add the deep search URL.';
  else if (r && r.msg && r.msg !== 'network') msg = r.msg + '. You can try these instead:';
  else msg = 'I couldn’t reach the search service. Check your connection and try again, or use these links:';
  b.appendChild(el('div', 'ai-deep-text', msg));

  var enc = encodeURIComponent(q);
  var chips = el('div', 'ai-chips');
  [['DuckDuckGo', 'https://duckduckgo.com/?q=' + enc],
   ['Wikipedia', 'https://en.wikipedia.org/w/index.php?search=' + enc],
   ['Images', 'https://duckduckgo.com/?q=' + enc + '&iax=images&ia=images']].forEach(function (l) {
    var a = el('a', 'ai-chip ai-chip-link', '↗ ' + l[0]);
    a.href = l[1]; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
    chips.appendChild(a);
  });
  b.appendChild(chips);
  sh.col.insertBefore(submitRow(q), sh.col.lastChild);
  scrollChat();
}

// ── STREAMING TEXT ────────────────────────────────────────────
function streamText(node, text, movieLinks, onDone, opts) {
  var i = 0;
  var step = Math.max(3, Math.ceil(text.length / 180));
  node.textContent = '';
  node.style.whiteSpace = 'pre-wrap';
  var iv = setInterval(function () {
    if (!node.isConnected) { clearInterval(iv); return; }          // chat was cleared
    if (i >= text.length) {
      clearInterval(iv);
      node.style.whiteSpace = '';
      node.innerHTML = formatResponse(text, movieLinks, opts);
      if (onDone) onDone();
      return;
    }
    i += step;
    node.textContent = text.slice(0, i) + '▌';
    scrollChat();
  }, 14);
}

// ── FORMAT RESPONSE ───────────────────────────────────────────
// Escapes text, then turns links, image URLs, **bold**, movie names and "quoted terms" into HTML.
// Generated HTML is parked in a stash while the regexes run, so the passes can never corrupt each other.
function formatResponse(text, movieLinks, opts) {
  opts = opts || {};
  var stash = [];
  function keep(html) { stash.push(html); return '\u0001' + (stash.length - 1) + '\u0002'; }

  var s = String(text || '').replace(/[\u0001\u0002]/g, '');

  // [label](https://url)
  s = s.replace(/\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]+)\)/g, function (m, label, url) {
    return keep(linkHtml(url, label));
  });

  // bare URLs (image URLs render as pictures)
  s = s.replace(/https?:\/\/[^\s<>"'“”]+/g, function (m) {
    var trail = '';
    var t = m.match(/[.,;:!?)\]]+$/);
    if (t) { trail = t[0]; m = m.slice(0, -trail.length); }
    return keep(urlHtml(m)) + trail;
  });

  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/\n/g, '<br>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  if (!opts.simple) {
    // KEYTUBE movie names → direct watch links
    if (movieLinks && Object.keys(movieLinks).length) {
      Object.keys(movieLinks).forEach(function (name) {
        var safeName = String(name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var esc = safeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var re = new RegExp('["“](' + esc + ')["”]', 'gi');
        s = s.replace(re, function (m, nm) {
          return keep('"<a href="#" class="ai-movie-link" data-movie-id="' + encodeURIComponent(movieLinks[name]) + '">' + nm + '</a>"');
        });
      });
    }

    // other "quoted terms" → search the site
    s = s.replace(/["“]([^"“”\u0001\u0002]{1,80}?)["”]/g, function (m, name) {
      name = name.trim();
      if (!name) return m;
      return keep('"<span class="ai-movie-search" data-search-query="' + encodeURIComponent(name) + '" title="Search for this">' + name + '</span>"');
    });

    // "1. Title (123 views)"
    s = s.replace(/(\d+)\.\s*([^<\u0001\u0002]+?)(?=\s*\(\d+\s*views?\))/g, function (m, n, title) {
      title = title.trim();
      if (!title) return m;
      return n + '. ' + keep('<span class="ai-movie-search" data-search-query="' + encodeURIComponent(title) + '" title="Search for this">' + title + '</span>');
    });
  }

  s = s.replace(/^• /gm, '<span class="ai-bullet">•</span> ');

  return s.replace(/\u0001(\d+)\u0002/g, function (m, i) { return stash[+i] || ''; });
}

function linkHtml(url, label) {
  var u = safeUrl(url);
  if (!u) return h(label);
  return '<a class="ai-link" href="' + h(u) + '" target="_blank" rel="noopener noreferrer nofollow">' + h(label) + '</a>';
}

function urlHtml(url) {
  var u = safeUrl(url);
  if (!u) return h(url);
  if (/\.(png|jpe?g|gif|webp|avif)(\?[^\s]*)?$/i.test(u)) {
    return '<a class="ai-inline-img" href="' + h(u) + '" target="_blank" rel="noopener noreferrer">' +
           '<img src="' + h(u) + '" alt="image" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.className=\'ai-link\';this.parentNode.textContent=this.src"></a>';
  }
  var label = u.length > 60 ? u.slice(0, 57) + '…' : u;
  return linkHtml(u, label);
}

// ── TYPING INDICATOR ──────────────────────────────────────────
function showTyping(label) {
  var chat = $('aiMsgs');
  if (!chat) return null;
  var id = 'typing_' + Date.now();
  var wrap = el('div', 'ai-msg ai-msg-ai');
  wrap.id = id;
  var av = el('div', 'ai-av');
  var img = new Image();
  img.alt = 'AI';
  img.onerror = function () { img.onerror = null; img.src = '../imagelib/logo.png'; };
  img.src = '../imagelib/ailogo.png';
  av.appendChild(img);
  var b = el('div', 'ai-bubble bot-bubble');
  b.innerHTML = '<div class="ai-typing-dots"><span></span><span></span><span></span></div><span class="ai-typing-label"></span>';
  b.lastChild.textContent = label || '';
  wrap.appendChild(av);
  wrap.appendChild(b);
  chat.appendChild(wrap);
  scrollChat();
  return id;
}

function setTypingLabel(id, label) {
  var n = id && $(id);
  if (!n) return;
  var l = n.querySelector('.ai-typing-label');
  if (l) l.textContent = label;
}

function removeTyping(id) {
  var n = id && $(id);
  if (n) n.remove();
}

// ── LIGHTBOX ──────────────────────────────────────────────────
function ensureLightbox() {
  var lb = $('aiLightbox');
  if (lb) return lb;
  lb = el('div', 'ai-lb');
  lb.id = 'aiLightbox';
  lb.hidden = true;
  lb.innerHTML = '<button type="button" class="ai-lb-x" aria-label="Close">✕</button>' +
                 '<img class="ai-lb-img" alt="" referrerpolicy="no-referrer">' +
                 '<div class="ai-lb-cap"></div><div class="ai-lb-links"></div>';
  document.body.appendChild(lb);
  return lb;
}

function openLightbox(im) {
  var lb = ensureLightbox();
  var img = lb.querySelector('.ai-lb-img');
  var full = safeUrl(im.full), thumb = safeUrl(im.thumb);
  img.onerror = function () { if (thumb && img.src !== thumb) { img.onerror = null; img.src = thumb; } };
  img.src = full || thumb;
  lb.querySelector('.ai-lb-cap').textContent = im.title || '';
  var links = lb.querySelector('.ai-lb-links');
  links.innerHTML = '';
  [['Open image', full || thumb], ['Source page', safeUrl(im.page)]].forEach(function (l) {
    if (!l[1]) return;
    var a = el('a', 'ai-chip ai-chip-link', '↗ ' + l[0]);
    a.href = l[1]; a.target = '_blank'; a.rel = 'noopener noreferrer';
    links.appendChild(a);
  });
  lb.hidden = false;
}

function closeLightbox() {
  var lb = $('aiLightbox');
  if (lb) { lb.hidden = true; lb.querySelector('.ai-lb-img').src = ''; }
}

// ── GLOBAL CLICK DELEGATION ───────────────────────────────────
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;

  var card = t.closest('.ai-card');
  if (card) {
    var c = _CARDS[+card.getAttribute('data-card')];
    if (!c) return;
    if (c.mode) { setMode(c.mode); $('aiInput').focus(); }
    else if (!_aiBusy) { $('aiInput').value = c.q; sendAIMessage(); }
    return;
  }

  var chip = t.closest('button.ai-chip');
  if (chip && chip.hasAttribute('data-q')) {
    if (_aiBusy) return;
    $('aiInput').value = chip.getAttribute('data-q');
    setMode(chip.getAttribute('data-mode') || null);
    sendAIMessage();
    return;
  }

  var gimg = t.closest('.ai-gimg');
  if (gimg && gimg._im) { e.preventDefault(); openLightbox(gimg._im); return; }

  if (t.closest('.ai-lb-x') || t === $('aiLightbox')) { closeLightbox(); return; }

  var sub = t.closest('.ai-submit-q-btn');
  if (sub) { openSubmitQuestion(sub.getAttribute('data-q') || ''); return; }

  var movie = t.closest('.ai-movie-link');
  if (movie) {
    e.preventDefault();
    var id = decodeURIComponent(movie.getAttribute('data-movie-id') || '');
    if (id) window.location.href = PAGES_BASE + 'watch.html?id=' + encodeURIComponent(id);
    return;
  }

  var srch = t.closest('.ai-movie-search');
  if (srch) {
    e.preventDefault();
    var query = decodeURIComponent(srch.getAttribute('data-search-query') || '');
    if (query) window.location.href = PAGES_BASE + 'search.html?q=' + encodeURIComponent(query);
    return;
  }

  if (t.closest('[data-act="clear-mode"]')) { setMode(null); return; }

  if (t.closest('#aiPlusBtn')) { togglePop('aiPlusMenu'); return; }
  if (t.closest('#aiEmojiBtn')) { togglePop('aiEmojiPop'); return; }

  var item = t.closest('.ai-pop-item');
  if (item) {
    var m = item.getAttribute('data-mode');
    setMode(_aiMode === m ? null : m);
    closePops();
    $('aiInput').focus();
    return;
  }

  var emo = t.closest('.ai-emoji');
  if (emo) {
    var inp = $('aiInput'), pos = inp.selectionStart || inp.value.length;
    inp.value = inp.value.slice(0, pos) + emo.textContent + inp.value.slice(inp.selectionEnd || pos);
    inp.focus();
    window.autoResize(inp);
    return;
  }

  if (!t.closest('.ai-pop')) closePops();
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { closeLightbox(); closePops(); closeSubmitQuestion(); }
});

function aiKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIMessage(); }
}

// ── SUBMIT QUESTION TO TEAM ───────────────────────────────────
function openSubmitQuestion(q) {
  var modal = $('aiSubmitModal');
  if (!modal) return;
  $('submitQText').value = q || '';
  var u = currentUser();
  $('submitQEmail').value = u && u.gmail ? u.gmail : '';
  $('submitQErr').textContent = '';
  modal.classList.add('open');
}

function closeSubmitQuestion() {
  var modal = $('aiSubmitModal');
  if (modal) modal.classList.remove('open');
}

function sendSubmitQuestion() {
  var q  = ($('submitQText').value || '').trim();
  var em = ($('submitQEmail').value || '').trim();
  if (!q) { $('submitQErr').textContent = 'Please write your question.'; return; }
  $('submitQErr').textContent = '';

  var btn = $('submitQBtn');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  var done = false;
  function finish(ok) {
    if (done) return;
    done = true;
    btn.disabled = false;
    btn.textContent = 'Send question';
    if (ok) {
      closeSubmitQuestion();
      appendAIMessage('✅ Thanks! Your question was sent to our team.\n\nYou can also reach us at contact@keytube.com', {}, true, true, '');
    } else {
      $('submitQErr').textContent = 'Could not send. Check your connection and try again.';
    }
  }
  setTimeout(function () { finish(false); }, 15000);

  var u = currentUser();
  api('saveUnknownQuestion', { question: q, gmail: u ? u.gmail : 'guest', email: em }, function (r) {
    finish(!r || r.ok !== false);
  });
}

// ── NEW CHAT ──────────────────────────────────────────────────
function clearAIChat() {
  _aiGen++;
  _aiHistory = [];
  setBusy(false);
  setMode(null);
  closePops();
  closeLightbox();
  var m = $('aiMsgs');
  if (m) m.innerHTML = '';
  var c = $('aiChat');
  if (c) c.scrollTop = 0;
}
