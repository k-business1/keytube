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
  var u = getUser();
  renderSuggestions();
  // Welcome message
  setTimeout(function(){
    var welcome = u
      ? 'Hello ' + (u.name || 'there') + '! 👋 I am KEYTUBE AI. Ask me anything about movies, channels, uploading, earnings and more!'
      : 'Hello! 👋 I am KEYTUBE AI. Ask me anything about movies, channels, how to upload, earn money and more!';
    appendAIMessage(welcome, {}, false);
  }, 400);
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
    var response = r.ok
      ? r.response
      : "I'm not sure about that. 🤔\n\nTry asking about:\n• Uploading videos\n• Earning money\n• Finding movies\n• Creating a channel\n\nOr email us at contact@keytube.com";
    var movieLinks = (r.ok && r.movieLinks) ? r.movieLinks : {};
    appendAIMessage(response, movieLinks, true);
  });
}

// ── APPEND USER MESSAGE ───────────────────────────────────────
function appendUserMessage(text) {
  var u = getUser();
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
function appendAIMessage(text, movieLinks, doStream) {
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
  wrap.insertAdjacentHTML('beforeend', avHTML);
  wrap.insertBefore(inner, wrap.firstChild);

  chat.appendChild(wrap);
  scrollChat();

  if (doStream) {
    streamText(bubble, text, movieLinks || {}, function(){
      scrollChat();
      _aiHistory.push({role:'ai', text:text});
    });
  } else {
    bubble.innerHTML = formatResponse(text, movieLinks || {});
    _aiHistory.push({role:'ai', text:text});
  }
}

// ── STREAMING TEXT (like ChatGPT) ─────────────────────────────
function streamText(el, text, movieLinks, onDone) {
  var i = 0;
  el.textContent = '';
  el.style.whiteSpace = 'pre-wrap';

  var interval = setInterval(function(){
    if (i >= text.length) {
      clearInterval(interval);
      // After streaming finishes — format with links and icons
      el.style.whiteSpace = '';
      el.innerHTML = formatResponse(text, movieLinks);
      if (onDone) onDone();
      return;
    }
    // Stream 3-5 chars at a time — faster feels more natural
    var speed = text.charCodeAt(i) === 10 ? 1 : 3; // slow on newlines
    var chunk  = text.slice(i, i + speed);
    el.textContent = text.slice(0, i + speed) + '▌';
    i += speed;
    scrollChat();
  }, 14);
}

// ── FORMAT RESPONSE — links + newlines ───────────────────────
function formatResponse(text, movieLinks) {
  // Escape HTML first
  var safe = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Convert newlines to <br>
  safe = safe.replace(/\n/g, '<br>');

  // Bold **text**
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Make movie names clickable — backend sends movieLinks: {name: id}
  if (movieLinks && Object.keys(movieLinks).length) {
    Object.keys(movieLinks).forEach(function(name) {
      var id   = movieLinks[name];
      var esc  = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match the name inside quotes or alone
      safe = safe.replace(
        new RegExp('"(' + esc + ')"', 'g'),
        '"<a href="../pages/watch.html?id=' + id +
          '" class="ai-movie-link" onclick="openMovieFromAI(event,\'' + id + '\')">$1</a>"'
      );
      safe = safe.replace(
        new RegExp('🎬 &quot;(' + esc + ')&quot;', 'g'),
        '🎬 "<a href="../pages/watch.html?id=' + id +
          '" class="ai-movie-link" onclick="openMovieFromAI(event,\'' + id + '\')">$1</a>"'
      );
    });
  }

  // Also detect quoted movie names without IDs and make them searchable
  safe = safe.replace(
    /"([^"]{3,60})"/g,
    function(match, name){
      // Skip if already a link
      if(match.indexOf('<a ')!==-1) return match;
      return '"<span class="ai-movie-search" onclick="searchMovieFromAI(\'' +
             encodeURIComponent(name) + '\')" title="Search for this">' + name + '</span>"';
    }
  );

  // Numbered list styling
  safe = safe.replace(/(\d+)\. /g, '<span class="ai-num">$1.</span> ');

  // Bullet styling
  safe = safe.replace(/^• /gm, '<span class="ai-bullet">•</span> ');

  return safe;
}

// ── OPEN MOVIE FROM AI LINK ───────────────────────────────────
function openMovieFromAI(event, movieId) {
  event.preventDefault();
  // Check if help.html is inside pages/ or root
  var base = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
  window.location.href = base + 'watch.html?id=' + encodeURIComponent(movieId);
}

// ── SEARCH MOVIE BY NAME (fallback for quoted names without IDs)
function searchMovieFromAI(encodedName) {
  var name = decodeURIComponent(encodedName);
  var base = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
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

// Handle Enter key
function aiKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIMessage(); }
}

// Clear chat
function clearAIChat() {
  var chat = document.getElementById('aiChat');
  if (chat) chat.innerHTML = '';
  _aiHistory = [];
  var sugg = document.getElementById('aiSuggestions');
  if (sugg) sugg.style.display = '';
  setTimeout(function(){
    var u = getUser();
    var welcome = u
      document.addEventListener("DOMContentLoaded", function() {
    var u = getUser();
    var container = document.getElementById("aiHeaderUserAvatar");
    if (!container) return;

    var avHTML = '';
    if (u && u.avatar) {
        avHTML = '<div class="ai-av ai-av-user ai-chat-header" style="width:36px;height:36px;cursor:pointer;" onclick="window.location.href=\'../pages/profile.html\'">' +
                   '<img src="' + h(u.avatar) + '" alt="' + h((u.name||'U')[0]) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'grid\'">' +
                   '<span class="ai-av-init" style="display:none;width:100%;height:100%;place-items:center;font-size:0.75rem;font-weight:700;color:#fff;background:var(--blue);border-radius:50%;">' + h((u.name||'U')[0].toUpperCase()) + '</span>' +
                 '</div>';
    } else if (u) {
        var init = (u.name || u.gmail || 'U')[0].toUpperCase();
        avHTML = '<div class="ai-av ai-av-user ai-chat-header" style="width:36px;height:36px;cursor:pointer;display:grid;place-items:center;background:var(--blue);color:#fff;border-radius:50%;font-size:0.75rem;font-weight:700;" onclick="window.location.href=\'../pages/profile.html\'">' + init + '</div>';
    } else {
        avHTML = '<a href="../pages/login.html" class="ai-header-login-btn" style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:linear-gradient(135deg,#6c3fc5,#4a2a8a);color:#fff;border-radius:20px;font-size:0.78rem;font-weight:600;text-decoration:none;">Login</a>';
    }

    container.innerHTML = avHTML;
});
      ? 'Hello ' + (u.name||'there') + '! 👋 How can I help you today?'
      : 'Hello! 👋 Ask me anything about KEYTUBE!';
    appendAIMessage(welcome, {}, false);
  }, 200);
}
