var _activeCat='all',_activeType='all',_advOpen=false,_adminClickCount=0,_adminClickTimer=null;

window.onload=function(){
  document.getElementById('fyear').textContent=new Date().getFullYear();
  var u=getUser();updateNavUI();
  // Apply saved theme
  try{var th=localStorage.getItem('kt_theme');if(th==='dark')document.body.classList.add('dark');}catch(e){}
  api('getSettings',{},function(r){
    if(r.ok){applyHomeSettings(r.settings);}
    loadHomeMovies();
    if(u){loadNotifications();startPing();}
    api('logTraffic',{user:u?u.gmail:'guest',action:'visit',country:u?u.country:'',details:navigator.language});
  });
  var tab=getParam('tab');if(tab==='downloads')showDownloads();else if(tab==='mylist')showMyList();
};

function applyHomeSettings(s){
  var sn=s['site_name']||'KEYTUBE';
  document.title=sn+' — Stream & Download Movies Worldwide';
  var snEl=document.getElementById('snEl');if(snEl)snEl.textContent=sn;
  var fb=document.getElementById('footBrand');if(fb)fb.textContent=sn;
  var ldn=document.getElementById('ld-site-name');if(ldn)ldn.textContent=sn;
  if(s['favicon_url']){var lk=document.getElementById('favicon')||document.createElement('link');lk.id='favicon';lk.rel='icon';lk.href=s['favicon_url'];document.head.appendChild(lk);}
  if(s['background_url']){document.body.style.backgroundImage='url('+s['background_url']+')';document.body.style.backgroundSize='cover';document.body.style.backgroundAttachment='fixed';}
  if(s['ads_top'])document.getElementById('adTop').innerHTML=s['ads_top'];
  if(s['ads_middle'])document.getElementById('adMid').innerHTML=s['ads_middle'];
  if(s['ads_bottom'])document.getElementById('adBot').innerHTML=s['ads_bottom'];
  if(s['app_download_url']&&s['app_download_url'].trim()){var ab=document.getElementById('appBanner');if(ab)ab.style.display='flex';var adb=document.getElementById('appDlBtn');if(adb)adb.dataset.url=s['app_download_url'];}
}

function downloadApp(){var url=document.getElementById('appDlBtn').dataset.url||'';if(url)window.open(url,'_blank');}

function loadHomeMovies(cat, type, year, minRating, country) {
  var u = getUser();
  api('getMovies', {
    isLoggedIn: !!u, 
    category: cat || _activeCat, 
    type: type || _activeType, 
    year: year || '', 
    minRating: minRating || '', 
    country: country || ''
  }, function(r) {
    var pgLoad = document.getElementById('pgLoad');
    if (pgLoad) pgLoad.style.display = 'none';
    
    if (!r.ok) { 
      if (typeof toastErr === 'function') toastErr(r.msg); 
      return; 
    }
    
    var movies = r.movies || [];
    _movies = movies;
    
    // Hero Section
    var feat = movies.filter(function(m){ return m.featured; });
    if (!feat.length) feat = movies.slice(0, Math.min(5, movies.length));
    _heroMovies = feat;
    _heroIdx = 0;
    
    var heroEl = document.getElementById('hero');
    if (feat.length && heroEl) {
      heroEl.style.display = 'block';
      if (typeof buildHeroDots === 'function') buildHeroDots();
      if (typeof renderHero === 'function') renderHero(0);
      if (typeof startHeroTimer === 'function') startHeroTimer();
    }
    
    // Trending row
    var tRow = document.getElementById('tRow');
    if (tRow) {
      renderRow('tRow', movies.filter(function(m){ return !m.isNew; }).slice(0, 20));
    }
    
    // New releases
    var newSec = document.getElementById('newSec');
    var guestBanner = document.getElementById('guestBanner');
    if (u) {
      var nw = movies.filter(function(m){ return m.isNew; });
      if (newSec) {
        if (nw.length) {
          newSec.classList.remove('hidden');
          renderRow('nRow', nw.slice(0, 20));
        } else {
          newSec.classList.add('hidden');
        }
      }
      if (guestBanner) guestBanner.style.display = 'none';
    } else {
      if (newSec) newSec.classList.add('hidden');
      if (guestBanner) guestBanner.style.display = 'block';
    }
    
    // Grid (Safely randomized inline so it never crashes if helper functions are missing)
    var gridMovies = movies.slice();
    for (var i = gridMovies.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = gridMovies[i];
      gridMovies[i] = gridMovies[j];
      gridMovies[j] = temp;
    }
    
    if (document.getElementById('mGrid')) {
      renderGrid(gridMovies, 'mGrid', 'emptySt', u ? 'No movies found.' : 'Sign in to see more.');
    }
  });
}

function goHome(){_activeCat='all';_activeType='all';clearF();document.querySelectorAll('.cp').forEach(function(b){b.classList.remove('active');});var first=document.querySelector('.cp');if(first)first.classList.add('active');document.getElementById('gTitle').textContent='All Movies';loadHomeMovies();window.scrollTo({top:0,behavior:'smooth'});}
function setCat(cat,btn){_activeCat=cat;document.querySelectorAll('.cp').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');_activeType=cat==='series'?'series':'all';loadHomeMovies(cat,_activeType);document.querySelector('main').scrollIntoView({behavior:'smooth'});}
function setCatName(type){_activeType=type;document.getElementById('gTitle').textContent=type==='series'?'TV Shows':'Movies';loadHomeMovies(_activeCat,type);document.querySelector('main').scrollIntoView({behavior:'smooth'});}
function toggleAdv(){_advOpen=!_advOpen;document.getElementById('advF').classList.toggle('open',_advOpen);document.getElementById('fArrow').textContent=_advOpen?'▲':'▼';}
function applyF(){var yr=document.getElementById('fYear').value,rat=document.getElementById('fRat').value,co=document.getElementById('fCo').value,tp=document.getElementById('fType2').value;loadHomeMovies(_activeCat,tp||_activeType,yr,rat,co);}
function clearF(){document.getElementById('fYear').value='';document.getElementById('fRat').value='';document.getElementById('fCo').value='';document.getElementById('fType2').value='all';loadHomeMovies();}
function sRow(id,dir){var el=document.getElementById(id);if(el)el.scrollBy({left:dir*340,behavior:'smooth'});}

function showDownloads(){
  if(!getUser()){showLoginReq();return;}
  window.location.href='pages/playlist.html?tab=downloads';
}
function showMyList(){
  if(!getUser()){showLoginReq();return;}
  window.location.href='pages/playlist.html?tab=saved';
}

// Search on home
var _srTimer2=null;
function onSearchInput(v){clearTimeout(_srTimer2);if(!v.trim()){cSearch();return;}_srTimer2=setTimeout(function(){doSearch(v.trim());},380);}
function doSBtn(){var v=document.getElementById('si').value.trim();if(v)doSearch(v);else cSearch();}
function doSearch(q){
  var u=getUser();
  api('searchMovies',{query:q,isLoggedIn:!!u},function(r){
    if(!r.ok)return;
    var so=document.getElementById('srOverlay');so.style.display='block';
    document.getElementById('srQ').textContent=q;
    var exact=r.exact||[],sim=r.similar||[];
    document.getElementById('srSub').textContent=exact.length+' exact · '+sim.length+' similar';
    var ex=document.getElementById('srEx');ex.innerHTML='';
    if(exact.length){var g=document.createElement('div');g.className='gw';exact.forEach(function(m){g.appendChild(makeCard(m,'grid'));});ex.appendChild(g);}
    else ex.innerHTML='<div style="background:var(--w);border:1px solid var(--brd);border-radius:var(--r);padding:22px;text-align:center"><strong>No exact match for "'+h(q)+'"</strong><p style="font-size:.8rem;color:var(--t2);margin-top:4px">See similar results below</p></div>';
    var sm=document.getElementById('srSim');sm.innerHTML='';
    if(sim.length){var t=document.createElement('div');t.style.cssText='font-size:.8rem;font-weight:700;color:var(--t2);text-transform:uppercase;margin:14px 0 9px';t.textContent='Similar Results';var g2=document.createElement('div');g2.className='gw';sim.forEach(function(m){g2.appendChild(makeCard(m,'grid'));});sm.appendChild(t);sm.appendChild(g2);}
  });
  searchChannels(q);  // ← ADD THIS LINE
} // search chaner
function searchChannels(q) {
  api('searchChannels', {query: q}, function(r) {
    if (!r.ok) return;
    var channels = r.channels || [];
    renderChannelResults(channels);
  });
}

function renderChannelResults(channels) {
  // Find or create the channels container
  var wrap = document.getElementById('srChannels');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (!channels.length) {
    wrap.style.display = 'none';
    return;
  }

  // Section heading
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:.82rem;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.4px;margin:14px 0 10px;display:flex;align-items:center;gap:6px';
  hd.innerHTML = '📺 Channels <span style="font-weight:400;color:var(--t3);font-size:.75rem">('+channels.length+')</span>';
  wrap.appendChild(hd);

  // Channel cards
  channels.forEach(function(ch) {
    wrap.appendChild(makeChannelCard(ch));
  });

  wrap.style.display = 'block';
}

function makeChannelCard(ch) {
  var d = document.createElement('div');
  d.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 14px;' +
                    'background:var(--w);border:1px solid var(--brd);border-radius:var(--r);' +
                    'cursor:pointer;transition:background .15s;margin-bottom:8px';
  d.onmouseenter = function(){ this.style.background = 'var(--bg2)'; };
  d.onmouseleave = function(){ this.style.background = 'var(--w)'; };

  // Pick a unique colour for channels without avatars
  var colors = ['#e53935','#d81b60','#8e24aa','#1e88e5',
                '#00897b','#43a047','#f4511e','#fb8c00'];
  var gmail  = ch.gmail || '';
  var seed   = gmail.split('').reduce(function(a,c){ return a * 31 + c.charCodeAt(0); }, 0);
  var color  = colors[Math.abs(seed) % colors.length];
  var init   = (ch.name || ch.gmail || '?')[0].toUpperCase();

  // Avatar: real photo if available, coloured initial otherwise
  var avHTML;
  if (ch.avatar && ch.avatar.trim()) {
    avHTML = '<div style="width:52px;height:52px;border-radius:50%;overflow:hidden;flex-shrink:0;background:var(--bg2)">' +
               '<img src="' + h(ch.avatar) + '" alt="' + init + '" ' +
                    'style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block" ' +
                    'onerror="this.parentNode.style.background=\'' + color + '\';' +
                              'this.parentNode.innerHTML=\'<span style=&quot;width:100%;height:100%;color:#fff;' +
                              'font-size:1.3rem;font-weight:700;display:grid;place-items:center&quot;>' + init + '</span>\'">' +
             '</div>';
  } else {
    avHTML = '<div style="width:52px;height:52px;border-radius:50%;background:' + color + ';color:#fff;' +
                         'font-size:1.3rem;font-weight:700;display:grid;place-items:center;flex-shrink:0">' +
               init +
             '</div>';
  }

  // Monetized badge
  var badge = ch.monetizationEnabled
    ? '<span style="font-size:.63rem;background:rgba(245,197,24,.15);color:#9a7d0a;' +
             'border:1px solid rgba(245,197,24,.5);border-radius:3px;padding:1px 5px;font-weight:700">💰 Monetized</span>'
    : '';

  d.innerHTML =
    avHTML +
    '<div style="flex:1;min-width:0">' +
      '<div style="font-size:.9rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
        h(ch.name || ch.gmail) +
      '</div>' +
      '<div style="font-size:.74rem;color:var(--t2);margin:2px 0">' + h(ch.handle || '') + '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:2px">' +
        '<span style="font-size:.74rem;color:var(--t2)">👥 ' + fmtNum(ch.followerCount || 0) + ' followers</span>' +
        '<span style="font-size:.74rem;color:var(--t2)">🎬 ' + (ch.videoCount || 0) + ' videos</span>' +
        badge +
      '</div>' +
      (ch.bio
        ? '<div style="font-size:.74rem;color:var(--t3);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
            h(ch.bio) + '</div>'
        : '') +
    '</div>' +
    '<button onclick="event.stopPropagation(); followFromSearch(\'' + h(ch.gmail) + '\', this)" ' +
            'style="padding:6px 14px;border-radius:20px;border:1.5px solid var(--red);' +
                   'background:var(--red);color:#fff;font-size:.76rem;font-weight:700;' +
                   'cursor:pointer;white-space:nowrap;flex-shrink:0;transition:all .2s">' +
      'Follow' +
    '</button>';

  // Click card → go to channel page
  d.onclick = function() {
    window.location.href = 'channel.html?gmail=' + encodeURIComponent(ch.gmail);
  };

  return d;
}

// Follow / Unfollow directly from search results
function followFromSearch(channelGmail, btn) {
  var u = getUser();
  if (!u) { showLoginReq(); return; }

  var isFollowing = btn.textContent.trim() === 'Following';

  api(isFollowing ? 'unfollowChannel' : 'followChannel',
      {gmail: u.gmail, channelGmail: channelGmail},
      function(r) {
        if (r.ok) {
          if (isFollowing) {
            btn.textContent = 'Follow';
            btn.style.background = 'var(--red)';
            btn.style.color = '#fff';
          } else {
            btn.textContent = 'Following';
            btn.style.background = 'var(--w)';
            btn.style.color = 'var(--red)';
            btn.style.borderColor = 'var(--red)';
            toastOK('Following ✓');
          }
        } else {
          toastErr(r.msg || 'Error');
        }
      });
}
