// ── short.js — KeyShort Comedy Shorts Player ────────────────
var _shorts = [];          // all comedy videos sorted
var _curIdx  = 0;          // current position
var _isLiked = false;
var _isSaved = false;
var _isFollowing = false;
var _curChannel  = null;
var _autoNextTimer  = null;
var _autoNextCount  = 0;
var _autoNextActive = false;
var _progressTimer  = null;
var _ksYTPlayer     = null; // YouTube IFrame API player
var _swipeStartY    = 0;
var _swipeLock      = false;
var _EMOJIS = ['💬','😂','❤️','🔥','😍','👍','🤣','💯','😎'];
var _selEmoji = '💬';

// ── INIT ──────────────────────────────────────────────────────
function initShorts() {
  var u = getUser();
  renderUserBtn(u);
  updateNavUI();

  // Load only comedy category
  api('getMovies', {isLoggedIn: !!u, category: 'comedy', type: 'all'}, function(r) {
    document.getElementById('ksLoader').style.display = 'none';
    if (!r.ok || !r.movies || !r.movies.length) {
      // Also try 'highlight' or 'cartoon' if comedy empty
      api('getMovies', {isLoggedIn: !!u, category: 'all', type: 'all'}, function(r2) {
        var list = (r2.movies || []).filter(function(m){
          return m.category === 'comedy' || m.category === 'highlight' || m.type === 'song';
        });
        if (!list.length) { showEmpty(); return; }
        startShorts(list, u);
      });
      return;
    }
    startShorts(r.movies, u);
  });

  setupSwipe();
  setupYouTubeAPI();

  if (u) startPing();
  api('logTraffic', {user: u ? u.gmail : 'guest', action: 'page:keyshort', country: u ? u.country : '', details: 'comedy shorts'});
}

function startShorts(movies, u) {
  // Sort by ID sequence (n, n+1, n+2…)
  _shorts = movies.slice().sort(function(a, b) {
    return String(a.id).localeCompare(String(b.id));
  });

  // Start from a random position to avoid always same video
  var savedIdx = 0;
  try { savedIdx = parseInt(sessionStorage.getItem('ks_idx') || '0') || 0; } catch(e){}
  _curIdx = savedIdx % _shorts.length;

  loadVideoAt(_curIdx, 'none');
}

function showEmpty() {
  document.getElementById('ksLoader').style.display = 'none';
  document.getElementById('ksEmpty').classList.remove('hidden');
}

// ── RENDER USER BUTTON ────────────────────────────────────────
function renderUserBtn(u) {
  var btn = document.getElementById('ksUserBtn');
  if (!btn) return;
  if (u) {
    if (u.avatar) {
      btn.className = 'ks-user-av-img';
      btn.innerHTML = '<img src="' + h(u.avatar) + '" alt="' + h((u.name||'U')[0]) + '" ' +
                      'onerror="this.parentNode.innerHTML=\'<span class=ks-user-av-init>' + h((u.name||'U')[0].toUpperCase()) + '</span>\'">';
    } else {
      btn.className = 'ks-user-av-init';
      btn.textContent = (u.name || u.gmail || 'U')[0].toUpperCase();
    }
    btn.onclick = function(){ window.location.href = 'profile.html'; };
  } else {
    btn.className = '';
    btn.innerHTML = '<button class="ks-signin-btn" onclick="window.location.href=\'login.html\'">Sign in</button>';
  }
}

// ── LOAD VIDEO AT INDEX ───────────────────────────────────────
function loadVideoAt(idx, direction) {
  if (!_shorts.length) return;
  idx = ((idx % _shorts.length) + _shorts.length) % _shorts.length;
  _curIdx = idx;

  // Save position to session
  try { sessionStorage.setItem('ks_idx', String(idx)); } catch(e) {}

  var m = _shorts[idx];
  if (!m) return;

  cancelAutoNext();
  clearInterval(_progressTimer);

  // Animate stage
  var stage = document.getElementById('ksPlayerWrap');
  if (direction === 'next') {
    stage.className = 'ks-player-wrap ks-slide-enter';
  } else if (direction === 'prev') {
    stage.className = 'ks-player-wrap ks-slide-enter-rev';
  } else {
    stage.className = 'ks-player-wrap';
  }
  setTimeout(function(){stage.className = 'ks-player-wrap';}, 350);

  // Build player — no thumbnail, direct autoplay
  stage.innerHTML = buildShortPlayer(m.videoURL, m.id);

  // Update info
  document.getElementById('ksTitle').textContent = m.name || 'Comedy Short';
  document.getElementById('ksVidMeta').textContent = '⭐ ' + (m.rating || '?') + '  ·  ' + cap(m.category || 'comedy');

  // Reset states
  _isLiked   = false;
  _isSaved   = false;
  _isFollowing = false;
  _curChannel  = null;
  resetActions();
  resetProgress();

  // Load stats
  loadVideoStats(m);

  // Log view
  var u = getUser();
  api('logView', {movieId: m.id, gmail: u ? u.gmail : 'guest'});
}

// ── BUILD PLAYER (no thumbnail, autoplay, no controls for YouTube) ──
function buildShortPlayer(url, movieId) {
  url = (url || '').trim();
  if (!url) return '<div style="width:100%;height:100%;display:grid;place-items:center;color:rgba(255,255,255,.3);font-size:.85rem">No video link</div>';

  // YouTube
  var yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  if (yt) {
    var ytId = yt[1];
    return '<iframe id="ksYTFrame" ' +
      'src="https://www.youtube.com/embed/' + ytId +
      '?autoplay=1&mute=0&controls=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1&origin=' + encodeURIComponent(window.location.origin) + '" ' +
      'allow="autoplay;encrypted-media" allowfullscreen ' +
      'style="width:100%;height:100%;border:none;pointer-events:all"></iframe>';
  }

  // Google Drive
  var gd = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (gd) {
    return '<iframe src="https://drive.google.com/file/d/' + gd[1] + '/preview" ' +
      'allowfullscreen allow="autoplay" style="width:100%;height:100%;border:none"></iframe>';
  }

  // Vimeo
  var vi = url.match(/vimeo\.com\/(\d+)/);
  if (vi) {
    return '<iframe src="https://player.vimeo.com/video/' + vi[1] + '?autoplay=1&loop=0&background=0" ' +
      'allowfullscreen allow="autoplay" style="width:100%;height:100%;border:none"></iframe>';
  }

  // MP4 / direct video — fullscreen with onended
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url)) {
    return '<video id="ksVideo" autoplay playsinline ' +
      'style="width:100%;height:100%;object-fit:cover;background:#000" ' +
      'onended="onVideoEnded()" onerror="onVideoError()">' +
      '<source src="' + h(url) + '"><p style="color:#fff;padding:20px">Video format not supported.</p>' +
      '</video>';
  }

  // Fallback iframe
  return '<iframe src="' + h(url) + '" allowfullscreen allow="autoplay;encrypted-media" ' +
    'style="width:100%;height:100%;border:none"></iframe>';
}

// ── YOUTUBE IFRAME API AUTO-NEXT ──────────────────────────────
function setupYouTubeAPI() {
  // Listen for YouTube postMessage events
  window.addEventListener('message', function(e) {
    try {
      var data = JSON.parse(e.data);
      // YouTube player state: 0 = ended
      if (data.event === 'onStateChange' && data.info === 0) {
        onVideoEnded();
      }
      // Also handle info=1 (playing) to start progress
      if (data.event === 'onStateChange' && data.info === 1) {
        startProgressSimulation(300); // simulate 5 min
      }
    } catch(ex) {}
  });
}

// ── VIDEO ENDED HANDLER ───────────────────────────────────────
function onVideoEnded() {
  startAutoNext();
}

function onVideoError() {
  toast('Video failed to load — skipping…', 'terr');
  setTimeout(function(){ nextVideo(); }, 1500);
}

// ── AUTO-NEXT ─────────────────────────────────────────────────
function startAutoNext() {
  cancelAutoNext();
  _autoNextActive = true;
  _autoNextCount  = 5;
  var el = document.getElementById('ksAutoNext');
  var num = document.getElementById('anNum');
  var fill = document.getElementById('anFill');
  if (el) el.style.display = 'flex';
  if (num) num.textContent = _autoNextCount;
  // Ring animation: circumference = 2*PI*18 ≈ 113
  if (fill) { fill.style.transition = 'stroke-dashoffset ' + _autoNextCount + 's linear'; fill.style.strokeDashoffset = '0'; }

  _autoNextTimer = setInterval(function() {
    _autoNextCount--;
    if (num) num.textContent = _autoNextCount;
    if (_autoNextCount <= 0) {
      cancelAutoNext();
      nextVideo();
    }
  }, 1000);
}

function cancelAutoNext() {
  clearInterval(_autoNextTimer);
  _autoNextActive = false;
  var el = document.getElementById('ksAutoNext');
  if (el) el.style.display = 'none';
  var fill = document.getElementById('anFill');
  if (fill) { fill.style.transition = 'none'; fill.style.strokeDashoffset = '113'; }
}

// ── PROGRESS BAR (for iframes without end event) ─────────────
function resetProgress() {
  var bar = document.getElementById('ksProgressBar');
  if (bar) { bar.style.transition = 'none'; bar.style.width = '0%'; }
}

function startProgressSimulation(seconds) {
  clearInterval(_progressTimer);
  var bar = document.getElementById('ksProgressBar');
  if (!bar) return;
  bar.style.transition = seconds + 's linear';
  bar.style.width = '100%';
  // After duration, auto-next
  _progressTimer = setTimeout(function(){
    onVideoEnded();
  }, seconds * 1000);
}

// ── NAVIGATION ────────────────────────────────────────────────
function nextVideo() {
  cancelAutoNext();
  var nextIdx = (_curIdx + 1) % _shorts.length;
  loadVideoAt(nextIdx, 'next');
}

function prevVideo() {
  cancelAutoNext();
  var prevIdx = ((_curIdx - 1) + _shorts.length) % _shorts.length;
  loadVideoAt(prevIdx, 'prev');
}

// ── SWIPE DETECTION ───────────────────────────────────────────
function setupSwipe() {
  var stage = document.getElementById('ksStage');
  if (!stage) return;
  stage.addEventListener('touchstart', function(e){ _swipeStartY = e.touches[0].clientY; _swipeLock = false; }, {passive:true});
  stage.addEventListener('touchend', function(e){
    if (_swipeLock) return;
    var dy = _swipeStartY - e.changedTouches[0].clientY;
    if (Math.abs(dy) < 50) return; // too small
    _swipeLock = true;
    if (dy > 0) nextVideo(); else prevVideo();
  }, {passive:true});
}

// ── LOAD VIDEO STATS ─────────────────────────────────────────
function loadVideoStats(m) {
  var u = getUser();

  // Views
  api('getMovieViews', {movieId: m.id}, function(r){
    if (r.ok) setText('ksViewCount', fmtNum(r.viewCount));
  });

  // Likes
  api('getMovieLikes', {movieId: m.id, gmail: u ? u.gmail : ''}, function(r){
    if (r.ok) {
      setText('ksLikeCount', fmtNum(r.likeCount));
      _isLiked = r.isLiked;
      updateLikeIcon();
    }
  });

  // Comments
  api('getComments', {movieId: m.id}, function(r){
    if (r.ok) setText('ksCmtCount', fmtNum(r.comments.length));
  });

  // Playlist check
  if (u) {
    api('getPlaylist', {gmail: u.gmail}, function(r){
      if (r.ok) {
        _isSaved = r.movies.some(function(mv){ return mv.id === m.id; });
        updateSaveIcon();
      }
    });
  }

  // Channel info
  if (m.uploaderGmail) {
    api('getChannel', {gmail: m.uploaderGmail}, function(r){
      if (!r.ok || !r.channel) {
        setText('ksChannelName', '@' + (m.uploaderGmail||'').split('@')[0]);
        return;
      }
      _curChannel = r.channel;
      var ch = r.channel;
      setText('ksChannelName', ch.name || ('@' + (m.uploaderGmail||'').split('@')[0]));
      // Channel avatar in actions
      var init = (ch.name || '?')[0].toUpperCase();
      var chImg = document.getElementById('ksChImg');
      var chInit = document.getElementById('ksChInit');
      if (ch.avatar && chImg) {
        chImg.src = ch.avatar;
        chImg.style.display = 'block';
        if (chInit) chInit.style.display = 'none';
      } else if (chInit) {
        chInit.textContent = init;
        if (chImg) chImg.style.display = 'none';
      }
      // Follow status
      if (u) {
        api('getFollowers', {channelGmail: ch.gmail, viewerGmail: u.gmail}, function(fr){
          if (fr.ok) {
            _isFollowing = fr.isFollowing;
            updateFollowDot();
          }
        });
      }
    });
  } else {
    setText('ksChannelName', '');
  }
}

// ── LIKE ─────────────────────────────────────────────────────
function toggleLike() {
  var m = _shorts[_curIdx];
  if (!m) return;
  var u = getUser();
  if (!u) { showLoginReq(); return; }
  var action = _isLiked ? 'unlikeMovie' : 'likeMovie';
  api(action, {gmail: u.gmail, movieId: m.id}, function(r){
    if (r.ok) {
      _isLiked = !_isLiked;
      setText('ksLikeCount', fmtNum(r.likeCount));
      updateLikeIcon();
      if (_isLiked) {
        var icon = document.getElementById('ksLikeIcon');
        if (icon) icon.classList.add('liked');
        setTimeout(function(){if(icon)icon.classList.remove('liked');}, 400);
      }
    } else toast(r.msg || 'Error', 'terr');
  });
}

function updateLikeIcon() {
  var icon = document.getElementById('ksLikeIcon');
  if (icon) icon.textContent = _isLiked ? '❤️' : '🤍';
}

// ── SAVE ──────────────────────────────────────────────────────
function saveVideo() {
  var m = _shorts[_curIdx];
  if (!m) return;
  var u = getUser();
  if (!u) { showLoginReq(); return; }
  var action = _isSaved ? 'removeFromPlaylist' : 'addToPlaylist';
  api(action, {gmail: u.gmail, movieId: m.id}, function(r){
    if (r.ok) {
      _isSaved = !_isSaved;
      updateSaveIcon();
      toast(_isSaved ? 'Saved to My List ✓' : 'Removed from list', _isSaved ? 'tok' : '');
    } else toast(r.msg || 'Error', 'terr');
  });
}

function updateSaveIcon() {
  var icon = document.getElementById('ksSaveIcon');
  var txt  = document.getElementById('ksSaveTxt');
  if (icon) icon.textContent = _isSaved ? '✅' : '📋';
  if (txt)  txt.textContent  = _isSaved ? 'Saved' : 'Save';
}

// ── SHARE ─────────────────────────────────────────────────────
function shareVideo() {
  var m = _shorts[_curIdx];
  if (!m) return;
  var url = window.location.origin + '/pages/watch.html?id=' + encodeURIComponent(m.id);
  if (navigator.share) {
    navigator.share({title: m.name + ' · KEYTUBE', text: 'Watch on KEYTUBE Shorts!', url: url}).catch(function(){});
  } else {
    navigator.clipboard && navigator.clipboard.writeText(url).then(function(){ toast('Link copied ✓', 'tok'); });
  }
}

// ── CHANNEL ───────────────────────────────────────────────────
function goToChannel() {
  if (_curChannel) {
    window.location.href = 'channel.html?gmail=' + encodeURIComponent(_curChannel.gmail);
  }
}

function followChannel() {
  if (!_curChannel) return;
  var u = getUser();
  if (!u) { showLoginReq(); return; }
  var action = _isFollowing ? 'unfollowChannel' : 'followChannel';
  api(action, {gmail: u.gmail, channelGmail: _curChannel.gmail}, function(r){
    if (r.ok) {
      _isFollowing = !_isFollowing;
      updateFollowDot();
      toast(_isFollowing ? 'Following ✓' : 'Unfollowed', _isFollowing ? 'tok' : '');
    } else toast(r.msg || 'Error', 'terr');
  });
}

function updateFollowDot() {
  var dot = document.getElementById('ksFollowDot');
  if (!dot) return;
  if (_isFollowing) {
    dot.textContent = '✓';
    dot.classList.add('following');
  } else {
    dot.textContent = '+';
    dot.classList.remove('following');
  }
}

// ── COMMENTS ─────────────────────────────────────────────────
function openComments() {
  var m = _shorts[_curIdx];
  if (!m) return;
  var overlay = document.getElementById('ksCmtOverlay');
  overlay.classList.remove('hidden');
  loadShortComments(m.id);
}

function closeComments() {
  document.getElementById('ksCmtOverlay').classList.add('hidden');
}

function loadShortComments(movieId) {
  var u   = getUser();
  var list= document.getElementById('ksCmtList');
  var tot = document.getElementById('ksCmtTotal');
  list.innerHTML = '<div class="ks-empty-cmt">Loading…</div>';

  api('getComments', {movieId: movieId}, function(r){
    if (!r.ok) { list.innerHTML = '<div class="ks-empty-cmt">Error loading comments.</div>'; return; }
    var cmts = r.comments || [];
    if (tot) tot.textContent = '(' + cmts.length + ')';
    setText('ksCmtCount', fmtNum(cmts.length));

    list.innerHTML = '';
    if (!cmts.length) {
      list.innerHTML = '<div class="ks-empty-cmt">No comments yet. Be first! 💬</div>';
    } else {
      cmts.forEach(function(c){
        var d = document.createElement('div');
        d.className = 'ks-cmt-item';
        var init = (c.name || c.gmail || '?')[0].toUpperCase();
        // Avatar: if comment has avatar field use it, else color initial
        var colors = ['#e53935','#d81b60','#8e24aa','#1e88e5','#00897b','#43a047','#f4511e','#fb8c00'];
        var seed   = (c.gmail || '').split('').reduce(function(a,ch){return a*31+ch.charCodeAt(0);},0);
        var color  = colors[Math.abs(seed) % colors.length];
        var avHTML = c.avatar
          ? '<div class="ks-cmt-av"><img src="'+h(c.avatar)+'" alt="'+init+'" onerror="this.parentNode.style.background=\''+color+'\';this.parentNode.textContent=\''+init+'\'"></div>'
          : '<div class="ks-cmt-av" style="background:'+color+'">'+init+'</div>';

        d.innerHTML = avHTML +
          '<div class="ks-cmt-body">' +
            '<div class="ks-cmt-name">' + h(c.name || c.gmail) + ' <span class="ks-cmt-emoji">' + h(c.emoji||'💬') + '</span></div>' +
            '<div class="ks-cmt-text">' + h(c.comment) + '</div>' +
            '<div class="ks-cmt-date">' + fmtDate(c.date) + '</div>' +
          '</div>';
        list.appendChild(d);
      });
    }

    // Comment input
    renderCommentInput(movieId, u);
  });
}

function renderCommentInput(movieId, u) {
  var row = document.getElementById('ksCmtInputRow');
  if (!row) return;
  if (u) {
    var init  = (u.name || u.gmail || 'U')[0].toUpperCase();
    var avHTML = u.avatar
      ? '<div class="ks-cmt-av-own"><img src="'+h(u.avatar)+'" alt="'+init+'" onerror="this.parentNode.textContent=\''+init+'\'"></div>'
      : '<div class="ks-cmt-av-own" style="background:var(--ks-r)">'+init+'</div>';

    row.innerHTML = avHTML +
      '<textarea class="ks-cmt-input" id="ksCmtTa" placeholder="Add a comment…" rows="1"></textarea>' +
      '<button class="ks-cmt-send" onclick="postShortComment(\''+movieId+'\')">Post</button>';
  } else {
    row.innerHTML = '<div class="ks-cmt-signin">'+
      '<a href="login.html">Sign in</a> to comment 💬</div>';
  }
}

function postShortComment(movieId) {
  var u  = getUser(); if (!u) return;
  var ta = document.getElementById('ksCmtTa');
  if (!ta || !ta.value.trim()) { toast('Write something first', 'terr'); return; }
  api('addComment', {gmail: u.gmail, name: u.name||u.gmail, movieId: movieId, comment: ta.value.trim(), emoji: '😂', avatar: u.avatar||''}, function(r){
    if (r.ok) { toast('Comment posted ✓', 'tok'); ta.value = ''; loadShortComments(movieId); }
    else toast(r.msg || 'Error', 'terr');
  });
}

// ── LOGIN REQUIRED ────────────────────────────────────────────
function showLoginReq() {
  document.getElementById('ksLoginReq').classList.remove('hidden');
}
function closeLoginReq() {
  document.getElementById('ksLoginReq').classList.add('hidden');
}

// ── RESET ACTIONS ─────────────────────────────────────────────
function resetActions() {
  setText('ksLikeCount', '0');
  setText('ksCmtCount',  '0');
  setText('ksViewCount', '0');
  setText('ksSaveTxt',   'Save');
  var likeIcon = document.getElementById('ksLikeIcon'); if (likeIcon) likeIcon.textContent = '🤍';
  var saveIcon = document.getElementById('ksSaveIcon'); if (saveIcon) saveIcon.textContent = '📋';
  var followDot = document.getElementById('ksFollowDot'); if (followDot) { followDot.textContent = '+'; followDot.classList.remove('following'); }
  var chImg = document.getElementById('ksChImg'); if (chImg) { chImg.src=''; chImg.style.display='none'; }
  var chInit = document.getElementById('ksChInit'); if (chInit) { chInit.textContent='?'; chInit.style.display=''; }
}

// ── HELPERS ───────────────────────────────────────────────────
function h(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function cap(s){ return s ? String(s)[0].toUpperCase() + String(s).slice(1) : ''; }
function setText(id, val){ var el=document.getElementById(id); if(el) el.textContent=val; }
function fmtNum(n){ n=parseInt(n||0); if(n>=1000000) return (n/1000000).toFixed(1)+'M'; if(n>=1000) return (n/1000).toFixed(1)+'K'; return String(n); }
function fmtDate(d){ var dt=new Date(d); if(isNaN(dt)) return d||''; var diff=Date.now()-dt; if(diff<60000) return 'just now'; if(diff<3600000) return Math.floor(diff/60000)+'m'; if(diff<86400000) return Math.floor(diff/3600000)+'h'; return Math.floor(diff/86400000)+'d'; }

// Keyboard nav
document.addEventListener('keydown', function(e){
  if(e.key==='ArrowDown'||e.key==='ArrowRight') nextVideo();
  else if(e.key==='ArrowUp'||e.key==='ArrowLeft') prevVideo();
  else if(e.key==='Escape'){ closeComments(); closeLoginReq(); }
});
