// ── movies.js — Movie listing, cards, watch page & smart preferences ───────────
var _movies=[],_heroMovies=[],_heroIdx=0,_heroTimer=null,_watchTimer=null;

// 1. Category intelligence & smart movie arrangement
function recordWatchTime(category, seconds) {
  if (!category) return;
  try {
    let stats = JSON.parse(localStorage.getItem('movie_category_stats') || '{}');
    stats[category] = (stats[category] || 0) + seconds;
    localStorage.setItem('movie_category_stats', JSON.stringify(stats));
  } catch (e) {}
}

function getSmartArrangedMovies(movies) {
  if (!movies || !Array.isArray(movies)) return [];
  function shuffle(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  let stats = {};
  try {
    stats = JSON.parse(localStorage.getItem('movie_category_stats') || '{}');
  } catch (e) {}
  
  let topCategory = Object.keys(stats).reduce((a, b) => stats[a] > stats[b] ? a : b, null);
  let catMovies = topCategory ? movies.filter(m => m.category === topCategory) : [];
  let otherMovies = topCategory ? movies.filter(m => m.category !== topCategory) : movies;

  let shuffledCat = shuffle(catMovies);
  let shuffledOthers = shuffle(otherMovies);

  let firstFive = shuffledCat.slice(0, 5);
  let remainingCat = shuffledCat.slice(5);
  let remainingPool = shuffle([...remainingCat, ...shuffledOthers]);

  if (firstFive.length === 0) return remainingPool;
  return [...firstFive, ...remainingPool];
}

function renderRow(id,movies){var c=document.getElementById(id);if(!c)return;c.innerHTML='';if(!movies.length){c.innerHTML='<p style="color:var(--t2);font-size:.79rem;padding:8px 0">Nothing here yet.</p>';return;}movies.forEach(function(m){c.appendChild(makeCard(m,'row'));});}
function renderGrid(movies,gridId,emptyId,emptyMsg){
  var g=document.getElementById(gridId||'mGrid'),e=document.getElementById(emptyId||'emptySt');
  if(!g)return;g.innerHTML='';
  if(!movies.length){if(e){e.classList.remove('hidden');var em=document.getElementById('emptyMsg');if(em)em.textContent=emptyMsg||'No movies found.';}return;}
  if(e)e.classList.add('hidden');
  movies.forEach(function(m){g.appendChild(makeCard(m,'grid'));});
}

// HERO
function renderHero(i){
  var m=_heroMovies[i];if(!m)return;
  var hc=document.getElementById('hCover');if(hc)hc.src=m.cover||'';
  var ht=document.getElementById('hTitle');if(ht)ht.textContent=m.name;
  var hd=document.getElementById('hDesc');if(hd)hd.textContent=m.description||'';
  var hb=document.getElementById('hBadge');if(hb)hb.textContent=m.isNew?'🆕 New':'⭐ Featured';
  var hm=document.getElementById('hMeta');if(hm)hm.innerHTML='<span class="hrat">⭐ '+(m.rating||'?')+'</span><span>'+h(m.year||'')+'</span><span>'+cap(m.category)+'</span>';
  document.querySelectorAll('.hdot').forEach(function(d,j){d.classList.toggle('active',j===i);});
  var hero=document.getElementById('hero');if(hero)hero.onclick=function(){window.location.href='pages/watch.html?id='+m.id;};
}
function buildHeroDots(){var c=document.getElementById('hDots');if(!c)return;c.innerHTML='';_heroMovies.forEach(function(_,i){var d=document.createElement('span');d.className='hdot'+(i===0?' active':'');d.onclick=function(){_heroIdx=i;renderHero(i);};c.appendChild(d);});}
function startHeroTimer(){clearInterval(_heroTimer);_heroTimer=setInterval(function(){_heroIdx=(_heroIdx+1)%Math.max(1,_heroMovies.length);renderHero(_heroIdx);},6500);}
function heroPlay(){var m=_heroMovies[_heroIdx];if(m)window.location.href='pages/watch.html?id='+m.id;}
function heroInfo(){var m=_heroMovies[_heroIdx];if(m)window.location.href='pages/watch.html?id='+m.id;}

// WATCH PAGE
function initWatchPage(){
  var pgL=document.getElementById('pgLoad');
  var id=getParam('id');if(!id){window.location.href='../index.html';return;}
  var u=getUser();updateNavUI();
  // Load movie
  api('getMovie',{id:id},function(r){
    if(pgL)pgL.style.display='none';
    if(!r.ok){toastErr(r.msg);setTimeout(function(){window.location.href='../index.html';},2000);return;}
    var m=r.movie;window._currentMovie=m;
    renderWatchMovie(m,u);
    api('logView',{movieId:m.id,gmail:u?u.gmail:'guest'});
    api('logTraffic',{user:u?u.gmail:'guest',action:'view',country:u?u.country:'',details:m.name});
    
    // Start tracking watch time for smart category sorting
    clearInterval(_watchTimer);
    _watchTimer = setInterval(function(){
      recordWatchTime(m.category, 5);
    }, 5000);

    // Load related (smart sorted or filtered)
    api('getMovies',{isLoggedIn:!!u,category:m.category,type:'all'},function(r2){
      if(r2.ok){
        var related=r2.movies.filter(function(x){return x.id!==m.id;});
        renderRow('relatedRow',getSmartArrangedMovies(related).slice(0,10));
      }
    });
    // Comments
    if(typeof loadComments==='function')loadComments(m.id);
    // Likes
    api('getMovieLikes',{movieId:m.id,gmail:u?u.gmail:''},function(lr){
      if(lr.ok){var lc=document.getElementById('likeCount');if(lc)lc.textContent=fmtNum(lr.likeCount);window._isLiked=lr.isLiked;var li=document.getElementById('likeIcon');if(li)li.textContent=lr.isLiked?'❤️':'🤍';var lb=document.getElementById('actLike');if(lb)lb.style.color=lr.isLiked?'var(--red)':'';}
    });
    // Playlist check
    if(u&&typeof checkPlaylist==='function')checkPlaylist(m.id);
    // Views
    api('getMovieViews',{movieId:m.id},function(vr){if(vr.ok){var vc=document.getElementById('viewCount');if(vc)vc.textContent=fmtNum(vr.viewCount)+' views';}});
    if(u)startPing();
  });
}

function renderWatchMovie(m,u){
  var ci=document.getElementById('mmCovI');if(ci)ci.src=m.cover||'';
  // Badges
  var bd=document.getElementById('mmBadges');
  if(bd)bd.innerHTML='<span class="cbg cb-c">'+cap(m.category)+'</span>'+(m.isNew?'<span class="cbg cb-n">NEW</span>':'')+(m.type==='series'?'<span class="cbg cb-e">📺 Series</span>':'');
  var tt=document.getElementById('mmTitle');if(tt)tt.textContent=m.name;
  var mm=document.getElementById('mmMeta');
  if(mm)mm.innerHTML='<span class="mm-rat">⭐ '+(m.rating||'N/A')+'</span><span>📅 '+h(m.year||'')+'</span><span>🌍 '+h(m.country||'International')+'</span>'+(m.season?'<span>S'+h(m.season)+'</span>':'')+(m.episode?'<span>E'+h(m.episode)+'</span>':'');
  var md=document.getElementById('mmDesc');if(md)md.textContent=(m.description||'').substring(0,120);
  var df=document.getElementById('descFull');if(df)df.textContent=m.description||'';
  window._descExpanded=false;
  var dt=document.getElementById('descToggle');
  if(dt&&m.description&&m.description.length>120){dt.style.display='block';}
  else if(dt)dt.style.display='none';
  // Play button
  var pb=document.getElementById('playBtn');
  if(pb)pb.onclick=function(){onPlayTap();};
  // Added date
  var ad=document.getElementById('addedDate');if(ad)ad.textContent=fmtDateFull(m.added||m.addedDate||'');
  // Channel row
  renderMovieChannel(m);
  // List btn
  var lb=document.getElementById('listBtn');
  if(lb)lb.textContent='+ My List';
  document.title=m.name+' · KEYTUBE';
}

function toggleDesc(){
  var df=document.getElementById('descFull'),md=document.getElementById('mmDesc'),dt=document.getElementById('descToggle');
  window._descExpanded=!window._descExpanded;
  if(df)df.style.display=window._descExpanded?'block':'none';
  if(md)md.style.display=window._descExpanded?'none':'block';
  if(dt)dt.textContent=window._descExpanded?'Show less ▲':'Show more ▼';
}

function renderMovieChannel(m){
  var row=document.getElementById('channelRow');if(!row)return;
  if(!m.uploaderGmail){row.innerHTML='';return;}
  api('getChannel',{gmail:m.uploaderGmail},function(r){
    if(!r.ok||!r.channel){row.innerHTML='';return;}
    var ch=r.channel;
    var u=getUser();var isFollowing=false;
    api('getFollowers',{channelGmail:ch.gmail,viewerGmail:u?u.gmail:''},function(fr){
      if(fr.ok)isFollowing=fr.isFollowing;
      var init=(ch.name||ch.gmail||'?')[0].toUpperCase();
      row.innerHTML='<div class="mch-avatar" onclick="window.location.href=\'channel.html?gmail='+encodeURIComponent(ch.gmail)+'\'">'+(ch.avatar?'<img src="'+h(ch.avatar)+'" alt="'+init+'" onerror="this.parentNode.innerHTML=\''+init+'\'">':init)+'</div>'+
        '<div class="mch-info"><div class="mch-name" onclick="window.location.href=\'channel.html?gmail='+encodeURIComponent(ch.gmail)+'\'">'+h(ch.name||ch.gmail)+'</div>'+
        '<div class="mch-followers">'+fmtNum(fr.ok?fr.count:0)+' followers</div></div>'+
        '<button class="mch-follow-btn'+(isFollowing?' following':'')+'" id="chFollowBtn" onclick="toggleChannelFollow(\''+ch.gmail+'\')">'+
        (isFollowing?'✓ Following':'Follow')+'</button>';
    });
  });
}

function toggleChannelFollow(channelGmail){
  var u=getUser();if(!u){showLoginReq();return;}
  var btn=document.getElementById('chFollowBtn');
  var following=btn&&btn.classList.contains('following');
  var action=following?'unfollowChannel':'followChannel';
  api(action,{gmail:u.gmail,channelGmail:channelGmail},function(r){
    if(r.ok){
      if(btn){btn.classList.toggle('following',!following);btn.textContent=following?'Follow':'✓ Following';}
      toastOK(following?'Unfollowed':'Following ✓');
    }else toastErr(r.msg);
  });
}

// Play video
function onPlayTap(){
  var m=window._currentMovie;if(!m)return;
  if(!m.videoURL){toastErr('No video available for this title.');return;}
  var vw=document.getElementById('videoWrap'),cw=document.getElementById('mmCovI');
  var heroMedia=document.getElementById('heroMedia');
  vw.innerHTML=buildPlayer(m.videoURL);
  vw.style.display='block';
  if(heroMedia)heroMedia.style.display='none';
  vw.scrollIntoView({behavior:'smooth',block:'start'});
}

function buildPlayer(url){
  url=(url||'').trim();if(!url)return'<p style="padding:20px;color:#999;text-align:center">No video link.</p>';
  var yt=url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  if(yt)return'<iframe src="https://www.youtube.com/embed/'+yt[1]+'?autoplay=1&rel=0" allowfullscreen allow="autoplay;encrypted-media" style="width:100%;height:100%;border:none"></iframe>';
  var vi=url.match(/vimeo\.com\/(\d+)/);
  if(vi)return'<iframe src="https://player.vimeo.com/video/'+vi[1]+'?autoplay=1" allowfullscreen allow="autoplay" style="width:100%;height:100%;border:none"></iframe>';
  var dm=url.match(/dailymotion\.com\/video\/([a-z0-9]+)/i);
  if(dm)return'<iframe src="https://www.dailymotion.com/embed/video/'+dm[1]+'?autoplay=1" allowfullscreen allow="autoplay" style="width:100%;height:100%;border:none"></iframe>';
  var gd=url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if(gd)return'<iframe src="https://drive.google.com/file/d/'+gd[1]+'/preview" allowfullscreen allow="autoplay" style="width:100%;height:100%;border:none"></iframe>';

  if(/\.(mp4|webm|ogg|mkv|mov)(\?.*)?$/i.test(url)) return `
    <div style="position:relative;width:100%;height:100%;background:#000;overflow:hidden">
      <!-- Video Element -->
      <video autoplay controlsList="nodownload" src="${h(url)}" style="width:100%;height:100%;display:block" 
             ontimeupdate="var p=this.parentNode.querySelector('.v-prog-fill'); if(p && this.duration) p.style.width = (this.currentTime / this.duration) * 100 + '%';"
             onwaiting="var l=this.parentNode.querySelector('.v-loader'); if(l) l.style.display='block';"
             onplaying="var l=this.parentNode.querySelector('.v-loader'); if(l) l.style.display='none';"
             oncanplay="var l=this.parentNode.querySelector('.v-loader'); if(l) l.style.display='none';">
      </video>

      <!-- Red Loading Spinner -->
      <div class="v-loader" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;border:4px solid rgba(255,255,255,0.2);border-top:4px solid #ff0000;border-radius:50%;animation:vSpin 0.8s linear infinite;z-index:8;pointer-events:none;display:none;"></div>
      <style>@keyframes vSpin { 0% { transform: translate(-50%,-50%) rotate(0deg); } 100% { transform: translate(-50%,-50%) rotate(360deg); } }</style>

      <!-- Floating Badge: Shows Played Time / Total Duration -->
      <div class="v-time-badge" style="position:absolute;top:15px;left:50%;transform:translateX(-50%);color:#fff;background:rgba(0,0,0,0.75);padding:6px 14px;border-radius:20px;display:none;z-index:10;pointer-events:none;font-size:13px;font-family:sans-serif;font-weight:500;letter-spacing:0.5px;white-space:nowrap;">0:00 / 0:00</div>

      <!-- Red Progress Bar at Bottom -->
      <div style="position:absolute;bottom:0;left:0;width:100%;height:4px;background:rgba(255,255,255,0.2);z-index:9;pointer-events:none;">
        <div class="v-prog-fill" style="width:0%;height:100%;background:#ff0000;transition:width 0.1s linear;"></div>
      </div>

      <!-- Interaction Shield (Gestures, Play/Pause & Double-Tap Fullscreen) -->
      <div style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:5" 
           oncontextmenu="return false;"
           ontouchstart="this._sx=event.touches[0].clientX; var v=this.parentNode.querySelector('video'); this._st=v.currentTime;"
           ontouchmove="var wrapper=this.parentNode; var v=wrapper.querySelector('video'); var d=event.touches[0].clientX-this._sx; var t=this._st+(d/5); v.currentTime=Math.max(0,Math.min(v.duration||0,t)); var dur=v.duration||0; var fmt=function(sec){var m=Math.floor(sec/60); var s=Math.floor(sec%60); return m+':'+(s<10?'0':'')+s;}; var badge=wrapper.querySelector('.v-time-badge'); if(badge){badge.style.display='block'; badge.innerHTML=fmt(v.currentTime)+' / '+fmt(dur);}"
           ontouchend="var wrapper=this.parentNode; var badge=wrapper.querySelector('.v-time-badge'); if(badge) badge.style.display='none'; var dx=event.changedTouches[0].clientX-this._sx; if(Math.abs(dx)<10){ var now=Date.now(); if(window._lastTap && (now - window._lastTap < 300)){ var box=wrapper; if(!document.fullscreenElement){ if(box.requestFullscreen) box.requestFullscreen(); else if(box.webkitRequestFullscreen) box.webkitRequestFullscreen(); } else { if(document.exitFullscreen) document.exitFullscreen(); } window._lastTap=0; } else { window._lastTap=now; setTimeout(function(){ if(window._lastTap && Date.now() - window._lastTap >= 300){ var v=wrapper.querySelector('video'); v.paused?v.play():v.pause(); window._lastTap=0; } }, 300); } }"
           onclick="var wrapper=this.parentNode; var now=Date.now(); if(window._lastTap && (now - window._lastTap < 300)){ var box=wrapper; if(!document.fullscreenElement){ if(box.requestFullscreen) box.requestFullscreen(); else if(box.webkitRequestFullscreen) box.webkitRequestFullscreen(); } else { if(document.exitFullscreen) document.exitFullscreen(); } window._lastTap=0; } else { window._lastTap=now; setTimeout(function(){ if(window._lastTap && Date.now() - window._lastTap >= 300){ var v=wrapper.querySelector('video'); v.paused?v.play():v.pause(); window._lastTap=0; } }, 300); }">
      </div>
    </div>`;

  return'<iframe src="'+h(url)+'" allowfullscreen allow="autoplay;encrypted-media" style="width:100%;height:100%;border:none"></iframe>';
}
// Like toggle
function toggleLike(){
  var m=window._currentMovie;if(!m)return;
  if(!requireLogin())return;
  var u=getUser();
  var liked=window._isLiked;
  var action=liked?'unlikeMovie':'likeMovie';
  api(action,{gmail:u.gmail,movieId:m.id},function(r){
    if(r.ok){
      window._isLiked=!liked;
      var li=document.getElementById('likeIcon');if(li)li.textContent=window._isLiked?'❤️':'🤍';
      var lc=document.getElementById('likeCount');if(lc)lc.textContent=fmtNum(r.likeCount);
      var lb=document.getElementById('actLike');if(lb)lb.style.color=window._isLiked?'var(--red)':'';
      toastOK(window._isLiked?'Liked ❤️':'Removed like');
    }else toastErr(r.msg||'Error');
  });
}

// Download
function onDownloadTap(){
  var m=window._currentMovie;if(!m)return;
  if(!m.downloadURL){toastErr('No download available.');return;}
  if(!requireLogin())return;
  segDownload(m.downloadURL,(m.name.replace(/[^a-z0-9]/gi,'_')||'video')+'.mp4',m.id,m.name);
}

// Segmented download
async function segDownload(url,filename,movieId,movieName){
  var prog=document.getElementById('dlProg'),bar=document.getElementById('dlBar'),pct=document.getElementById('dlPct'),spd=document.getElementById('dlSpd');
  if(prog)prog.classList.add('show');if(bar)bar.style.width='0%';if(pct)pct.textContent='0%';if(spd)spd.textContent='Connecting…';
  try{
    var resp=await fetch(url,{redirect:'follow'});
    if(!resp.ok)throw new Error('HTTP '+resp.status);
    var total=parseInt(resp.headers.get('Content-Length')||'0');
    var reader=resp.body.getReader(),chunks=[],received=0,start=Date.now();
    while(true){var res=await reader.read();if(res.done)break;chunks.push(res.value);received+=res.value.length;
      var p=total?Math.round(received/total*100):Math.min(Math.round(received/1024/100),90);
      if(bar)bar.style.width=p+'%';if(pct)pct.textContent=p+'%';
      var elapsed=(Date.now()-start)/1000;var kbps=elapsed>0?Math.round(received/elapsed/1024):0;
      if(spd)spd.textContent=kbps+' KB/s — '+Math.round(received/1024)+' KB';}
    if(bar)bar.style.width='100%';if(pct)pct.textContent='100%';if(spd)spd.textContent='Saving…';
    var blob=new Blob(chunks);
    if('caches' in window){try{var cache=await caches.open('kkkkk');await cache.put('/downloads/'+filename,new Response(blob,{headers:{'Content-Type':blob.type||'video/mp4'}}));}catch(ce){}}
    var bUrl=URL.createObjectURL(blob);var a=document.createElement('a');a.href=bUrl;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(bUrl);},5000);
    if(spd)spd.textContent='✅ Downloaded & saved!';
    var u=getUser();api('logDownload',{gmail:u?u.gmail:'guest',movieId:movieId,movieName:movieName,status:'completed'});
    toastOK('Download complete ✓');setTimeout(function(){if(prog)prog.classList.remove('show');},3000);
  }catch(err){
    if(spd)spd.textContent='Error: '+err.message;toastErr('Download failed');
    setTimeout(function(){if(prog)prog.classList.remove('show');},3000);window.open(url,'_blank');
  }
}

function scrollToComments(){var el=document.getElementById('commentsAnchor');if(el)el.scrollIntoView({behavior:'smooth'});}
function shareMovie(){var m=window._currentMovie;if(navigator.share&&m){navigator.share({title:m.name,text:'Watch '+m.name+' on KEYTUBE',url:window.location.href}).catch(function(){});} else{navigator.clipboard&&navigator.clipboard.writeText(window.location.href).then(function(){toastOK('Link copied!');});}}