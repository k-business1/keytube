// ── ai.js — KEYTUBE AI Chat Interface ───────────────────────
// Used on help.html — streaming responses, movie links, user profile pic

var _aiHistory = [];   // {role:'user'|'ai', text, movieLinks}
var _aiStreaming = false;

// Suggested starter questions
var _SUGGESTIONS = [
  'How do I upload a video?',
  'How do I earn money?',
  'What movies are trending?',
  'How do I create a channel?',
  'How do I download videos?',
  'How many movies are on KEYTUBE?'
];

// ── INIT ──────────────────────────────────────────────────────
function initAIChat() {
  var u = typeof getUser === 'function' ? getUser() : null;
  renderSuggestions();
  
  // Welcome message
  setTimeout(function(){
    let firstName = "there";
    
    if (u) {
      let rawName = u.name || u.username || u.fullname || "";
      if (rawName.trim() !== "") {
        let firstPart = rawName.trim().split(" ")[0];
        firstName = firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase();
      }
    }

    var welcome = 'Hello ' + firstName + '! 👋 I am KEYTUBE AI. Ask me anything about movies, channels, uploading, earnings and more!';
      
    appendAIMessage(welcome, {}, true, true, '');
  }, 400);
}

// Automatically trigger initialization when the script loads or page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAIChat);
} else {
  initAIChat();
}

// ── RENDER SUGGESTIONS ────────────────────────────────────────
function renderSuggestions() {
  var wrap = document.getElementById('aiSuggestions');
  if (!wrap) return;
  wrap.innerHTML = '';
  _SUGGESTIONS.forEach(function(q){
    var btn = document.createElement('button');
    btn.className = 'ai-sugg-btn';
    btn.textContent = q;
    btn.onclick = function(){
      document.getElementById('aiInput').value = q;
      sendAIMessage();
      wrap.style.display = 'none';
    };
    wrap.appendChild(btn);
  });
}

// ── SEND MESSAGE ──────────────────────────────────────────────
function sendAIMessage() {
  if (_aiStreaming) return;
  var input = document.getElementById('aiInput');
  var q = (input.value || '').trim();
  if (!q) return;
  input.value = '';

  // Hide suggestions after first message
  var sugg = document.getElementById('aiSuggestions');
  if (sugg) sugg.style.display = 'none';

  // Append user message
  appendUserMessage(q);

  // Show typing indicator
  var typingId = showTyping();

  _aiStreaming = true;

  // Call AI backend
  api('aiQuery', {query: q}, function(r){
    removeTyping(typingId);
    _aiStreaming = false;
    var response = r.ok ? r.response : "...";
    var matched  = r.ok && r.matched;
    appendAIMessage(response, r.movieLinks||{}, true, matched, q);
  });
}

// ── APPEND USER MESSAGE ───────────────────────────────────────
function appendUserMessage(text) {
  var u = typeof getUser === 'function' ? getUser() : null;
  var chat = document.getElementById('aiChat');
  if (!chat) return;

  var wrap = document.createElement('div');
  wrap.className = 'ai-msg ai-msg-user';

  // Avatar — profile pic if logged in
  var avHTML = '';
  if (u && u.avatar) {
    avHTML = '<div class="ai-av ai-av-user">' +
             '<img src="' + h(u.avatar) + '" alt="' + h((u.name||'U')[0]) + '" ' +
                  'onerror="this.style.display=\'none\';this.nextSibling.style.display=\'grid\'">' +
             '<span class="ai-av-init" style="display:none">' + h((u.name||'U')[0].toUpperCase()) + '</span>' +
           '</div>';
  } else if (u) {
    var init = (u.name || u.gmail || 'U')[0].toUpperCase();
    avHTML = '<div class="ai-av ai-av-user"><span class="ai-av-init">' + init + '</span></div>';
  } else {
    avHTML = '<div class="ai-av ai-av-user"><span class="ai-av-init">U</span></div>';
  }

  // Name label
  var nameLabel = u ? h(u.name || 'You') : 'You';

  wrap.innerHTML =
    '<div class="ai-msg-inner user-inner">' +
      '<div class="ai-msg-name user-name">' + nameLabel + '</div>' +
      '<div class="ai-bubble user-bubble">' + h(text) + '</div>' +
    '</div>' +
    avHTML;

  chat.appendChild(wrap);
  scrollChat();
  _aiHistory.push({role:'user', text:text});
}

// ── APPEND AI MESSAGE ─────────────────────────────────────────
function appendAIMessage(text, movieLinks, doStream, matched, originalQuery) {
  var chat = document.getElementById('aiChat');
  if (!chat) return;
 
  var wrap = document.createElement('div');
  wrap.className = 'ai-msg ai-msg-ai';
 
  var avHTML =
    '<div class="ai-av ai-av-bot">' +
      '<img src="../imagelib/ailogo.png" alt="AI" ' +
           'onerror="this.style.display=\'none\';this.nextSibling.style.display=\'grid\'">' +
      '<span class="ai-av-init" style="display:none">AI</span>' +
    '</div>';
 
  var bubble = document.createElement('div');
  bubble.className = 'ai-bubble bot-bubble';
 
  var inner = document.createElement('div');
  inner.className = 'ai-msg-inner bot-inner';
  var nameDiv = document.createElement('div');
  nameDiv.className = 'ai-msg-name bot-name';
  nameDiv.textContent = 'KEYTUBE AI';
 
  inner.appendChild(nameDiv);
  inner.appendChild(bubble);
  wrap.insertAdjacentHTML('afterbegin', avHTML);
  wrap.appendChild(inner);
  chat.appendChild(wrap);
  scrollChat();
 
  function afterStream() {
    // If AI didn't match — show "Submit Question" button below bubble
    if (matched === false) {
      var submitRow = document.createElement('div');
      submitRow.className = 'ai-submit-row';
      submitRow.innerHTML =
        '<button class="ai-submit-q-btn" onclick="openSubmitQuestion(\'' +
        encodeURIComponent(originalQuery || '') + '\')">' +
        '📩 Submit this question to our team' +
        '</button>';
      inner.appendChild(submitRow);
    }
    scrollChat();
    _aiHistory.push({role:'ai', text:text});
  }
 
  if (doStream) {
    streamText(bubble, text, movieLinks || {}, afterStream);
  } else {
    bubble.innerHTML = formatResponse(text, movieLinks || {});
    afterStream();
  }
}
 
// ── SUBMIT QUESTION MODAL ─────────────────────────────────────
function openSubmitQuestion(encodedQ) {
  var q = decodeURIComponent(encodedQ || '');
  var modal = document.getElementById('aiSubmitModal');
  if (!modal) {
    // Fallback if modal HTML is missing from page
    var manualQ = prompt("Submit your question to our team:", q);
    if (manualQ) {
      var u = typeof getUser === 'function' ? getUser() : null;
      api('saveUnknownQuestion', {
        question: manualQ,
        gmail: u ? u.gmail : 'guest',
        email: ''
      }, function(r) {
        alert("✅ Thank you! Your question has been sent.");
      });
    }
    return;
  }
  var qInput = document.getElementById('submitQText');
  if (qInput) qInput.value = q;
  
  var u = typeof getUser === 'function' ? getUser() : null;
  var emailInput = document.getElementById('submitQEmail');
  if (emailInput && u) emailInput.value = u.gmail || '';
  
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}
 
function closeSubmitQuestion() {
  var modal = document.getElementById('aiSubmitModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}
 
function sendSubmitQuestion() {
  var qEl  = document.getElementById('submitQText');
  var emEl = document.getElementById('submitQEmail');
  var erEl = document.getElementById('submitQErr');
  var q    = (qEl  ? qEl.value.trim()  : '');
  var em   = (emEl ? emEl.value.trim() : '');
 
  if (!q) { if (erEl) erEl.textContent = 'Please describe your question.'; return; }
  if (erEl) erEl.textContent = '';
 
  var btn = document.getElementById('submitQBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
 
  var u = typeof getUser === 'function' ? getUser() : null;
  api('saveUnknownQuestion', {
    question: q,
    gmail:       u ? u.gmail : 'guest',
    email:       em
  }, function(r) {
    if (btn) { btn.disabled = false; btn.textContent = '📩 Submit Question'; }
    closeSubmitQuestion();
    appendAIMessage(
      '✅ Thank you! Your question has been sent to our team.\n\nWe will add an answer soon. You can also reach us directly at contact@keytube.com 📧',
      {}, true, true, ''
    );
  });
}

// ── STREAMING TEXT (like ChatGPT) ─────────────────────────────
function streamText(el, text, movieLinks, onDone) {
  var i = 0;
  el.textContent = '';
  el.style.whiteSpace = 'pre-wrap';

  var interval = setInterval(function(){
    if (i >= text.length) {
      clearInterval(interval);
      el.style.whiteSpace = '';
      el.innerHTML = formatResponse(text, movieLinks);
      if (onDone) onDone();
      return;
    }
    var speed = text.charCodeAt(i) === 10 ? 1 : 3;
    el.textContent = text.slice(0, i + speed) + '▌';
    i += speed;
    scrollChat();
  }, 14);
}

// ── FORMAT RESPONSE — links + newlines ───────────────────────
function formatResponse(text, movieLinks) {
  var safe = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // New lines
  safe = safe.replace(/\n/g, '<br>');

  // **bold**
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // ── MOVIE LINKS ─────────────────────────────────────────────
  if (movieLinks && Object.keys(movieLinks).length) {
    Object.keys(movieLinks).forEach(function(name) {
      var id = movieLinks[name];
      var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // "Movie Name"
      safe = safe.replace(
        new RegExp('&quot;(' + esc + ')&quot;', 'g'),
        '&quot;<a href="../pages/watch.html?id=' +
          encodeURIComponent(id) +
          '" class="ai-movie-link" onclick="openMovieFromAI(event,\'' +
          encodeURIComponent(id) +
          '\')">$1</a>&quot;'
      );

      // 🎬 "Movie Name"
      safe = safe.replace(
        new RegExp('🎬 &quot;(' + esc + ')&quot;', 'g'),
        '🎬 &quot;<a href="../pages/watch.html?id=' +
          encodeURIComponent(id) +
          '" class="ai-movie-link" onclick="openMovieFromAI(event,\'' +
          encodeURIComponent(id) +
          '\')">$1</a>&quot;'
      );
    });
  }

  // ── QUOTED MOVIE SEARCH (e.g. "TikTok reels") ────────────────
  safe = safe.replace(
    /&quot;([^&]{1,80})&quot;/g,
    function(match, name) {
      // Don't modify an already-created link
      if (match.indexOf('<a ') !== -1) {
        return match;
      }
      return '&quot;<span class="ai-movie-search" ' +
        'onclick="searchMovieFromAI(\'' +
        encodeURIComponent(name) +
        '\')" ' +
        'title="Search for this">' +
        name +
        '</span>&quot;';
    }
  );

  // ── NUMBERED LIST ITEM TITLE SEARCH (n. Title (views)) ───────
  safe = safe.replace(
    /(\d+)\.\s*([^<]+?)(?=\s*\(\d+\s*views?\))/g,
    function(match, number, title) {
      title = title.trim();
      if (!title) return match;
      return number + '. <span class="ai-movie-search" ' +
        'onclick="searchMovieFromAI(\'' +
        encodeURIComponent(title) +
        '\')" ' +
        'title="Search for this">' +
        title +
        '</span>';
    }
  );

  // ── BULLETS ─────────────────────────────────────────────────
  safe = safe.replace(
    /^• /gm,
    '<span class="ai-bullet">•</span> '
  );

  return safe;
}

// ── OPEN MOVIE FROM AI LINK ───────────────────────────────────
function openMovieFromAI(event, movieId) {
  event.preventDefault();
  var base = window.location.pathname.indexOf('../pages/') !== -1 ? '' : '../pages/';
  window.location.href = base + 'watch.html?id=' + encodeURIComponent(movieId);
}

// ── SEARCH MOVIE BY NAME ──────────────────────────────────────
function searchMovieFromAI(encodedName) {
  var name = decodeURIComponent(encodedName);
  var base = window.location.pathname.indexOf('../pages/') !== -1 ? '' : '../pages/';
  window.location.href = base + 'search.html?q=' + encodeURIComponent(name);
}

// ── TYPING INDICATOR ─────────────────────────────────────────
function showTyping() {
  var chat = document.getElementById('aiChat');
  if (!chat) return null;
  var id = 'typing_' + Date.now();
  var wrap = document.createElement('div');
  wrap.className = 'ai-msg ai-msg-ai';
  wrap.id = id;
  wrap.innerHTML =
    '<div class="ai-av ai-av-bot">' +
      '<img src="../imagelib/ailogo.png" alt="AI" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'grid\'">' +
      '<span class="ai-av-init" style="display:none">AI</span>' +
    '</div>' +
    '<div class="ai-msg-inner bot-inner">' +
      '<div class="ai-msg-name bot-name">KEYTUBE AI</div>' +
      '<div class="ai-bubble bot-bubble">' +
        '<div class="ai-typing-dots"><span></span><span></span><span></span></div>' +
      '</div>' +
    '</div>';
  chat.appendChild(wrap);
  scrollChat();
  return id;
}

function removeTyping(id) {
  if (!id) return;
  var el = document.getElementById(id);
  if (el) el.remove();
}

// ── HELPERS ───────────────────────────────────────────────────
function scrollChat() {
  var chat = document.getElementById('aiChat');
  if (chat) chat.scrollTop = chat.scrollHeight;
}

function h(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function aiKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIMessage(); }
}

function clearAIChat() {
  var chat = document.getElementById('aiChat');
  if (chat) chat.innerHTML = '';
  _aiHistory = [];
  var sugg = document.getElementById('aiSuggestions');
  if (sugg) sugg.style.display = '';
  setTimeout(function(){
    let firstName = "there";
    var u = typeof getUser === 'function' ? getUser() : null;
    if (u) {
      let rawName = u.name || u.username || u.fullname || "";
      if (rawName.trim() !== "") {
        let firstPart = rawName.trim().split(" ")[0];
        firstName = firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase();
      }
    }
    var welcome = 'Hello ' + firstName + '! 👋 I am KEYTUBE AI. Ask me anything about movies, channels, uploading, earnings and more!';
    appendAIMessage(welcome, {}, true, true, '');
  }, 200);
}
