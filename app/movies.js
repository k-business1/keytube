var _movies=[],_heroMovies=[],_heroIdx=0,_heroTimer=null,_watchTimer=null,_video=null;

function recordWatchTime(category,seconds){
  if(!category)return;
  try{
    let stats=JSON.parse(localStorage.getItem('movie_category_stats')||'{}');
    stats[category]=(stats[category]||0)+seconds;
    localStorage.setItem('movie_category_stats',JSON.stringify(stats));
  }catch(e){}
}

function getSmartArrangedMovies(movies){
  if(!movies||!Array.isArray(movies))return[];
  function shuffle(array){
    let arr=[...array];
    for(let i=arr.length-1;i>0;i--){
      let j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }
  let stats={};
  try{stats=JSON.parse(localStorage.getItem('movie_category_stats')||'{}');}catch(e){}
  let topCategory=Object.keys(stats).reduce((a,b)=>stats[a]>stats[b]?a:b,null);
  if(!topCategory)return shuffle(movies);
  let catMovies=movies.filter(m=>m.category===topCategory),
      otherMovies=movies.filter(m=>m.category!==topCategory),
      shuffledCat=shuffle(catMovies),
      shuffledOthers=shuffle(otherMovies),
      firstFive=shuffledCat.slice(0,5),
      remainingCat=shuffledCat.slice(5),
      remainingPool=shuffle([...remainingCat,...shuffledOthers]);
  if(firstFive.length===0)return remainingPool;
  return[...firstFive,...remainingPool];
}

function renderRow(id,movies){
  var c=document.getElementById(id);
  if(!c)return;
  c.innerHTML='';
  if(!movies.length){
    c.innerHTML='<p style="color:var(--t2);font-size:.79rem;padding:8px 0">Nothing here yet.</p>';
    return;
  }
  movies.forEach(function(m){c.appendChild(makeCard(m,'row'));});
}

// ── Infinite-scroll grid state (one active grid at a time) ──────
var _gridAllMovies=[],_gridRendered=0,_gridObserver=null;

function renderGrid(movies,gridId,emptyId,emptyMsg,batchSize){
  var id=gridId||'mGrid';
  var g=document.getElementById(id),e=document.getElementById(emptyId||'emptySt');
  if(!g)return;
  // Clean up any previous infinite-scroll watcher on this grid
  if(_gridObserver){_gridObserver.disconnect();_gridObserver=null;}
  var oldSentinel=document.getElementById(id+'-sentinel');
  if(oldSentinel)oldSentinel.remove();
  g.innerHTML='';
  if(!movies.length){
    if(e){
      e.classList.remove('hidden');
      var em=document.getElementById('emptyMsg');
      if(em)em.textContent=emptyMsg||'No movies found.';
    }
    return;
  }
  if(e)e.classList.add('hidden');
  if(!batchSize){
    // No batch size given — render everything at once (old behavior).
    movies.forEach(function(m){g.appendChild(makeCard(m,'grid'));});
    return;
  }
  // ── Batched / infinite-scroll rendering ──
  _gridAllMovies=movies;
  _gridRendered=0;
  appendNextGridBatch(g,batchSize);
  if(_gridRendered>=_gridAllMovies.length)return; // everything already fit in one batch
  var sentinel=document.createElement('div');
  sentinel.id=id+'-sentinel';
  sentinel.style.cssText='height:1px';
  g.parentNode.insertBefore(sentinel,g.nextSibling);
  if('IntersectionObserver' in window){
    _gridObserver=new IntersectionObserver(function(entries){
      if(entries[0].isIntersecting)appendNextGridBatch(g,batchSize,sentinel);
    },{rootMargin:'600px'});
    _gridObserver.observe(sentinel);
  }else{
    // Fallback for very old browsers: check on scroll/resize
    var onScroll=function(){
      var r=sentinel.getBoundingClientRect();
      if(r.top<window.innerHeight+600)appendNextGridBatch(g,batchSize,sentinel);
    };
    window.addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('resize',onScroll);
  }
}

function appendNextGridBatch(g,batchSize,sentinel){
  var next=_gridAllMovies.slice(_gridRendered,_gridRendered+batchSize);
  next.forEach(function(m){g.appendChild(makeCard(m,'grid'));});
  _gridRendered+=next.length;
  if(_gridRendered>=_gridAllMovies.length){
    if(_gridObserver){_gridObserver.disconnect();_gridObserver=null;}
    if(sentinel)sentinel.remove();
  }
}

function renderHero(i){
  var m=_heroMovies[i];
  if(!m)return;
  var hc=document.getElementById('hCover');if(hc)hc.src=m.cover||'';
  var ht=document.getElementById('hTitle');if(ht)ht.textContent=m.name;
  var hd=document.getElementById('hDesc');if(hd)hd.textContent=m.description||'';
  var hb=document.getElementById('hBadge');if(hb)hb.textContent=m.isNew?'🆕 New':'⭐ Featured';
  var hm=document.getElementById('hMeta');if(hm)hm.innerHTML='<span class="hrat">⭐ '+(m.rating||'?')+'</span><span>'+h(m.year||'')+'</span><span>'+cap(m.category)+'</span>';
  document.querySelectorAll('.hdot').forEach(function(d,j){d.classList.toggle('active',j===i);});
  var hero=document.getElementById('hero');
  if(hero)hero.onclick=function(){window.location.href='pages/watch.html?id='+m.id;};
}

function buildHeroDots(){
  var c=document.getElementById('hDots');
  if(!c)return;
  c.innerHTML='';
  _heroMovies.forEach(function(_,i){
    var d=document.createElement('span');
    d.className='hdot'+(i===0?' active':'');
    d.onclick=function(){_heroIdx=i;renderHero(i);};
    c.appendChild(d);
  });
}

function startHeroTimer(){
  clearInterval(_heroTimer);
  _heroTimer=setInterval(function(){
    _heroIdx=(_heroIdx+1)%Math.max(1,_heroMovies.length);
    renderHero(_heroIdx);
  },6500);
}

function heroPlay(){var m=_heroMovies[_heroIdx];if(m)window.location.href='pages/watch.html?id='+m.id;}
function heroInfo(){var m=_heroMovies[_heroIdx];if(m)window.location.href='pages/watch.html?id='+m.id;}

function initWatchPage(){
  var pgL=document.getElementById('pgLoad');
  var id=getParam('id');
  if(!id){window.location.href='../index.html';return;}
  var u=getUser();
  updateNavUI();
  api('getMovie',{id:id},function(r){
    if(pgL)pgL.style.display='none';
    if(!r.ok){
      toastErr(r.msg);
      setTimeout(function(){window.location.href='../index.html';},2000);
      return;
    }
    var m=r.movie;
    window._currentMovie=m;
    renderWatchMovie(m,u);
    api('logView',{movieId:m.id,gmail:u?u.gmail:'guest'});
    api('logTraffic',{user:u?u.gmail:'guest',action:'view',country:u?u.country:'',details:m.name});

    // Watch time tracker (safe guarded)
    var _wtSeconds=0;
    var _wtLastSent=0;
    clearInterval(_watchTimer);
    _watchTimer=setInterval(function(){
      try{
        var v = _video || document.querySelector('#videoWrap video');
        var isPlaying = false;
        if(v && !v.paused && !v.ended){
          isPlaying = true;
        } else if(!v && document.querySelector('#videoWrap iframe') && document.visibilityState==='visible'){
          isPlaying = true;
        }
        if(isPlaying){
          _wtSeconds+=5;
          recordWatchTime(m.category,5);
        }
        if(_wtSeconds-_wtLastSent>=30){
          var u2=getUser();
          api('logWatchTime',{gmail:u2?u2.gmail:'guest',movieId:m.id,seconds:_wtSeconds-_wtLastSent,cumulativeSeconds:_wtSeconds},function(){});
          _wtLastSent=_wtSeconds;
        }
      }catch(err){}
    },5000);

    window.addEventListener('beforeunload',function(){
      try{
        var remaining=_wtSeconds-_wtLastSent;
        if(remaining<1)return;
        var u3=getUser();
        var body=JSON.stringify({action:'logWatchTime',gmail:u3?u3.gmail:'guest',movieId:m.id,seconds:remaining,cumulativeSeconds:_wtSeconds,deviceId:getDeviceId()});
        if(navigator.sendBeacon && typeof API_URL !== 'undefined'){
          navigator.sendBeacon(API_URL,new Blob([body],{type:'text/plain'}));
        }
      }catch(err){}
    });

    api('getMovies',{isLoggedIn:!!u,category:m.category,type:'all'},function(r2){
      if(r2.ok){
        var related=r2.movies.filter(function(x){return x.id!==m.id;});
        renderRow('relatedRow',getSmartArrangedMovies(related).slice(0,10));
      }
    });

    if(typeof loadComments==='function')loadComments(m.id);

    api('getMovieLikes',{movieId:m.id,gmail:u?u.gmail:''},function(lr){
      if(lr.ok){
        var lc=document.getElementById('likeCount');
        if(lc)lc.textContent=fmtNum(lr.likeCount);
        window._isLiked=lr.isLiked;
        var li=document.getElementById('likeIcon');
        if(li)li.textContent=lr.isLiked?'❤️':'🤍';
        var lb=document.getElementById('actLike');
        if(lb)lb.style.color=lr.isLiked?'var(--red)':'';
      }
    });

    if(u&&typeof checkPlaylist==='function')checkPlaylist(m.id);

    api('getMovieViews',{movieId:m.id},function(vr){
      if(vr.ok){
        var vc=document.getElementById('viewCount');
        if(vc)vc.textContent=fmtNum(vr.viewCount)+' views';
      }
    });

    if(u)startPing();
  });
}

function renderWatchMovie(m,u){
  var ci=document.getElementById('mmCovI');if(ci)ci.src=m.cover||'';
  var bd=document.getElementById('mmBadges');if(bd)bd.innerHTML='<span class="cbg cb-c">'+cap(m.category)+'</span>'+(m.isNew?'<span class="cbg cb-n">NEW</span>':'')+(m.type==='series'?'<span class="cbg cb-e">📺 Series</span>':'');
  var tt=document.getElementById('mmTitle');if(tt)tt.textContent=m.name;
  var mm=document.getElementById('mmMeta');if(mm)mm.innerHTML='<span class="mm-rat">⭐ '+(m.rating||'N/A')+'</span><span>📅 '+h(m.year||'')+'</span><span>🌍 '+h(m.country||'International')+'</span>'+(m.season?'<span>S'+h(m.season)+'</span>':'')+(m.episode?'<span>E'+h(m.episode)+'</span>':'');
  var md=document.getElementById('mmDesc');if(md)md.textContent=(m.description||'').substring(0,120);
  var df=document.getElementById('descFull');if(df)df.textContent=m.description||'';
  window._descExpanded=false;
  var dt=document.getElementById('descToggle');if(dt&&m.description&&m.description.length>120)dt.style.display='block';else if(dt)dt.style.display='none';
  var pb=document.getElementById('playBtn');if(pb)pb.onclick=function(){onPlayTap();};
  var ad=document.getElementById('addedDate');if(ad)ad.textContent=fmtDateFull(m.added||m.addedDate||'');
  renderMovieChannel(m);
  var lb=document.getElementById('listBtn');if(lb)lb.textContent='+ My List';
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
    var u=getUser();
    var isFollowing=false;
    api('getFollowers',{channelGmail:ch.gmail,viewerGmail:u?u.gmail:''},function(fr){
      if(fr.ok)isFollowing=fr.isFollowing;
      var init=(ch.name||ch.gmail||'?')[0].toUpperCase();
      row.innerHTML='<div class="mch-avatar" onclick="window.location.href=\'channel.html?gmail='+encodeURIComponent(ch.gmail)+'\'">'+(ch.avatar?'<img src="'+h(ch.avatar)+'" alt="'+init+'" onerror="this.parentNode.innerHTML=\''+init+'\'">':init)+'</div>'+'<div class="mch-info"><div class="mch-name" onclick="window.location.href=\'channel.html?gmail='+encodeURIComponent(ch.gmail)+'\'">'+h(ch.name||ch.gmail)+'</div>'+'<div class="mch-followers">'+fmtNum(fr.ok?fr.count:0)+' followers</div></div>'+'<button class="mch-follow-btn'+(isFollowing?' following':'')+'" id="chFollowBtn" onclick="toggleChannelFollow(\''+ch.gmail+'\')">'+(isFollowing?'✓ Following':'Follow')+'</button>';
    });
  });
}

function toggleChannelFollow(channelGmail){
  var u=getUser();
  if(!u){showLoginReq();return;}
  var btn=document.getElementById('chFollowBtn');
  var following=btn&&btn.classList.contains('following');
  var action=following?'unfollowChannel':'followChannel';
  api(action,{gmail:u.gmail,channelGmail:channelGmail},function(r){
    if(r.ok){
      if(btn){
        btn.classList.toggle('following',!following);
        btn.textContent=following?'Follow':'✓ Following';
      }
      toastOK(following?'Unfollowed':'Following ✓');
    }else toastErr(r.msg);
  });
}

function onPlayTap(){
  var m=window._currentMovie;
  if(!m)return;
  if(!m.videoURL){toastErr('No video available for this title.');return;}
  var vw=document.getElementById('videoWrap'),cw=document.getElementById('mmCovI');
  var heroMedia=document.getElementById('heroMedia');
  vw.innerHTML=buildPlayer(m.videoURL);
  _video=vw.querySelector('video');
  vw.style.display='block';
  if(heroMedia)heroMedia.style.display='none';
  vw.scrollIntoView({behavior:'smooth',block:'start'});
}

// ════════════════ CUSTOM VIDEO PLAYER HELPERS ════════════════
function ktFmt(s){
  s=Math.max(0,s||0);
  var h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=Math.floor(s%60);
  return (h?h+':'+(m<10?'0':''):'')+m+':'+(x<10?'0':'')+x;
}
function ktW(el){return el.closest('.kt-pl');}
function ktUI(w,t){
  var v=w.querySelector('video'),d=v.duration||0;
  var pct=d?Math.max(0,Math.min(100,t/d*100)):0;
  var f=w.querySelector('.v-prog-fill');if(f)f.style.width=pct+'%';
  var th=w.querySelector('.v-thumb');if(th)th.style.left=pct+'%';
  var tl=w.querySelector('.v-time-lbl');if(tl)tl.textContent=ktFmt(t)+' / '+ktFmt(d);
}
function ktBuf(w){
  var v=w.querySelector('video'),b=w.querySelector('.v-buf');
  if(!b||!v.duration||!v.buffered.length)return;
  b.style.width=(v.buffered.end(v.buffered.length-1)/v.duration*100)+'%';
}
function ktTU(v){
  var w=ktW(v);
  if(w._busy)return;
  ktUI(w,v.currentTime);ktBuf(w);
}
function ktSeekTo(w,t){
  var v=w.querySelector('video');
  if(!v||!v.duration)return;
  t=Math.max(0,Math.min(v.duration,t));
  var l=w.querySelector('.v-loader');
  if(l)l.style.display='block';
  v.addEventListener('seeked',function(){if(l)l.style.display='none';},{once:true});
  v.currentTime=t;
  ktUI(w,t);
}
function ktFlash(w,txt,side){
  var f=w.querySelector('.kt-fl-'+side);if(!f)return;
  f.textContent=txt;f.style.display='block';
  clearTimeout(f._t);
  f._t=setTimeout(function(){f.style.display='none';},600);
}
function ktSkip(w,sec){
  var v=w.querySelector('video');
  ktSeekTo(w,v.currentTime+sec);
  ktFlash(w,(sec>0?'+':'−')+Math.abs(sec)+'s',sec>0?'r':'l');
}
function ktFS(w){
  if(!document.fullscreenElement){
    if(w.requestFullscreen)w.requestFullscreen();
    else if(w.webkitRequestFullscreen)w.webkitRequestFullscreen();
  }else{
    if(document.exitFullscreen)document.exitFullscreen();
  }
}
function ktTapAct(w,ratio){
  var now=Date.now();
  if(w._lt&&now-w._lt<300){
    clearTimeout(w._tt);w._lt=0;
    if(ratio<0.33)ktSkip(w,-10);
    else if(ratio>0.67)ktSkip(w,10);
    else ktFS(w);
  }else{
    w._lt=now;
    w._tt=setTimeout(function(){
      w._lt=0;
      var v=w.querySelector('video');
      v.paused?v.play():v.pause();
    },300);
  }
}
/* ── Overlay: swipe + tap ── */
function ktOS(el,e){
  var w=ktW(el),v=w.querySelector('video');
  el._sx=e.touches[0].clientX;el._sy=e.touches[0].clientY;
  el._st=v.currentTime;el._moved=false;el._t=null;
}
function ktOM(el,e){
  var w=ktW(el),v=w.querySelector('video');
  var dx=e.touches[0].clientX-el._sx,dy=e.touches[0].clientY-el._sy;
  if(!el._moved&&Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)){el._moved=true;w._busy=true;}
  if(!el._moved||!v.duration)return;
  if(e.cancelable)e.preventDefault();
  el._t=Math.max(0,Math.min(v.duration,el._st+dx/5));
  ktUI(w,el._t);
  var b=w.querySelector('.v-time-badge');
  if(b){b.style.display='block';b.textContent=ktFmt(el._t)+' / '+ktFmt(v.duration);}
}
function ktOE(el,e){
  var w=ktW(el);
  var b=w.querySelector('.v-time-badge');if(b)b.style.display='none';
  el._tch=Date.now();
  if(e.cancelable)e.preventDefault(); // ibuza click ikurikira
  if(el._moved){
    w._busy=false;
    if(el._t!=null)ktSeekTo(w,el._t);
    el._moved=false;el._t=null;
    return;
  }
  var r=el.getBoundingClientRect();
  var x=(e.changedTouches[0].clientX-r.left)/r.width;
  ktTapAct(w,x);
}
function ktOC(el,e){
  if(el._tch&&Date.now()-el._tch<600)return; // touch yamaze kuyikora
  var r=el.getBoundingClientRect();
  ktTapAct(ktW(el),(e.clientX-r.left)/r.width);
}
/* ── Progress bar: tap / drag ── */
function ktBR(el,x){
  var r=el.getBoundingClientRect();
  return Math.max(0,Math.min(1,(x-r.left)/r.width));
}
function ktBS(el,e){
  e.stopPropagation();
  var w=ktW(el),v=w.querySelector('video');
  if(!v.duration)return;
  w._busy=true;
  el._t=ktBR(el,e.touches[0].clientX)*v.duration;
  ktUI(w,el._t);
}
function ktBM(el,e){
  e.stopPropagation();
  if(e.cancelable)e.preventDefault();
  var w=ktW(el),v=w.querySelector('video');
  if(!v.duration)return;
  el._t=ktBR(el,e.touches[0].clientX)*v.duration;
  ktUI(w,el._t);
  var b=w.querySelector('.v-time-badge');
  if(b){b.style.display='block';b.textContent=ktFmt(el._t)+' / '+ktFmt(v.duration);}
}
function ktBE(el,e){
  e.stopPropagation();
  if(e.cancelable)e.preventDefault();
  var w=ktW(el);
  el._tch=Date.now();
  var b=w.querySelector('.v-time-badge');if(b)b.style.display='none';
  w._busy=false;
  if(el._t!=null)ktSeekTo(w,el._t);
  el._t=null;
}
function ktBC(el,e){
  e.stopPropagation();
  if(el._tch&&Date.now()-el._tch<600)return;
  var w=ktW(el),v=w.querySelector('video');
  if(!v.duration)return;
  ktSeekTo(w,ktBR(el,e.clientX)*v.duration);
}
// ════════════════ END PLAYER HELPERS ════════════════

function buildPlayer(url){
  url=(url||'').trim();
  if(!url)return'<p style="padding:20px;color:#999;text-align:center">No video link.</p>';
  var yt=url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  if(yt)return'<iframe src="https://www.youtube.com/embed/'+yt[1]+'?autoplay=1&rel=0" allowfullscreen allow="autoplay;encrypted-media" style="width:100%;height:100%;border:none"></iframe>';
  var vi=url.match(/vimeo\.com\/(\d+)/);
  if(vi)return'<iframe src="https://player.vimeo.com/video/'+vi[1]+'?autoplay=1" allowfullscreen allow="autoplay" style="width:100%;height:100%;border:none"></iframe>';
  var dm=url.match(/dailymotion\.com\/video\/([a-z0-9]+)/i);
  if(dm)return'<iframe src="https://www.dailymotion.com/embed/video/'+dm[1]+'?autoplay=1" allowfullscreen allow="autoplay" style="width:100%;height:100%;border:none"></iframe>';
  var gd=url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if(gd)return'<iframe src="https://drive.google.com/file/d/'+gd[1]+'/preview" allowfullscreen allow="autoplay" style="width:100%;height:100%;border:none"></iframe>';
  if(/\.(mp4|webm|ogg|mkv|mov)(\?.*)?$/i.test(url)){
    var src=h(typeof ktVideoURL==='function'?ktVideoURL(url):url);
    var poster=h((window._currentMovie&&window._currentMovie.cover)||'');
    var fl='position:absolute;top:50%;transform:translateY(-50%);color:#fff;background:rgba(0,0,0,0.6);padding:10px 16px;border-radius:24px;font:600 14px sans-serif;display:none;z-index:10;pointer-events:none;';
    return ''
    +'<div class="kt-pl" style="position:relative;width:100%;height:100%;background:#000;overflow:hidden">'
    +'<video autoplay playsinline preload="auto" poster="'+poster+'" controlsList="nodownload" src="'+src+'" data-orig="'+h(url)+'" style="width:100%;height:100%;display:block"'
    +' onerror="window.ktVideoFallback&&ktVideoFallback(this)"'
    +' ontimeupdate="ktTU(this)" onprogress="ktTU(this)" onloadedmetadata="ktTU(this)" ondurationchange="ktTU(this)"'
    +' onwaiting="var l=this.parentNode.querySelector(\'.v-loader\');if(l)l.style.display=\'block\';"'
    +' onplaying="var l=this.parentNode.querySelector(\'.v-loader\');if(l)l.style.display=\'none\';"'
    +' oncanplay="var l=this.parentNode.querySelector(\'.v-loader\');if(l)l.style.display=\'none\';"></video>'
    +'<div class="v-loader" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;border:4px solid rgba(255,255,255,0.2);border-top:4px solid #ff0000;border-radius:50%;animation:vSpin 0.8s linear infinite;z-index:8;pointer-events:none;display:none;"></div>'
    +'<style>@keyframes vSpin{0%{transform:translate(-50%,-50%) rotate(0deg)}100%{transform:translate(-50%,-50%) rotate(360deg)}}</style>'
    +'<div class="v-time-badge" style="position:absolute;top:15px;left:50%;transform:translateX(-50%);color:#fff;background:rgba(0,0,0,0.75);padding:6px 14px;border-radius:20px;display:none;z-index:10;pointer-events:none;font-size:13px;font-family:sans-serif;font-weight:500;white-space:nowrap;">0:00 / 0:00</div>'
    +'<div class="kt-fl-l" style="'+fl+'left:12%;"></div>'
    +'<div class="kt-fl-r" style="'+fl+'right:12%;"></div>'
    /* overlay: tap / double-tap / swipe */
    +'<div style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:5;touch-action:none" oncontextmenu="return false;"'
    +' ontouchstart="ktOS(this,event)" ontouchmove="ktOM(this,event)" ontouchend="ktOE(this,event)" onclick="ktOC(this,event)"></div>'
    /* time label */
    +'<div class="v-time-lbl" style="position:absolute;left:10px;bottom:20px;color:#fff;font:500 12px sans-serif;text-shadow:0 1px 3px #000;z-index:9;pointer-events:none;">0:00 / 0:00</div>'
    /* progress bar (touch zone 30px, track 4px) */
    +'<div style="position:absolute;left:0;bottom:0;width:100%;height:30px;z-index:11;touch-action:none;cursor:pointer"'
    +' ontouchstart="ktBS(this,event)" ontouchmove="ktBM(this,event)" ontouchend="ktBE(this,event)" onclick="ktBC(this,event)">'
    +'<div style="position:absolute;left:0;bottom:0;width:100%;height:4px;background:rgba(255,255,255,0.25);">'
    +'<div class="v-buf" style="position:absolute;left:0;top:0;height:100%;width:0%;background:rgba(255,255,255,0.4);"></div>'
    +'<div class="v-prog-fill" style="position:absolute;left:0;top:0;height:100%;width:0%;background:#ff0000;"></div>'
    +'<div class="v-thumb" style="position:absolute;top:-4px;left:0%;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:#ff0000;"></div>'
    +'</div></div>'
    +'</div>';
  }
  return'<iframe src="'+h(url)+'" allowfullscreen allow="autoplay;encrypted-media" style="width:100%;height:100%;border:none"></iframe>';
}

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

function onDownloadTap(){
  var m=window._currentMovie;if(!m)return;
  if(!m.downloadURL){toastErr('No download available.');return;}
  if(!requireLogin())return;
  segDownload(m.downloadURL,(m.name.replace(/[^a-z0-9]/gi,'_')||'video')+'.mp4',m.id,m.name);
}

async function segDownload(url,filename,movieId,movieName){
  var prog=document.getElementById('dlProg'),bar=document.getElementById('dlBar'),pct=document.getElementById('dlPct'),spd=document.getElementById('dlSpd');
  if(prog)prog.classList.add('show');if(bar)bar.style.width='0%';if(pct)pct.textContent='0%';if(spd)spd.textContent='Connecting…';
  try{
    var resp=await fetch(url,{redirect:'follow'});
    if(!resp.ok)throw new Error('HTTP '+resp.status);
    var total=parseInt(resp.headers.get('Content-Length')||'0');
    var reader=resp.body.getReader(),chunks=[],received=0,start=Date.now();
    while(true){
      var res=await reader.read();
      if(res.done)break;
      chunks.push(res.value);
      received+=res.value.length;
      var p=total?Math.round(received/total*100):Math.min(Math.round(received/1024/100),90);
      if(bar)bar.style.width=p+'%';if(pct)pct.textContent=p+'%';
      var elapsed=(Date.now()-start)/1000;
      var kbps=elapsed>0?Math.round(received/elapsed/1024):0;
      if(spd)spd.textContent=kbps+' KB/s — '+Math.round(received/1024)+' KB';
    }
    if(bar)bar.style.width='100%';if(pct)pct.textContent='100%';if(spd)spd.textContent='Saving…';
    var blob=new Blob(chunks);
    if('caches' in window){
      try{
        var cache=await caches.open('kkkkk');
        await cache.put('/downloads/'+filename,new Response(blob,{headers:{'Content-Type':blob.type||'video/mp4'}}));
      }catch(ce){}
    }
    var bUrl=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=bUrl;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(bUrl);},5000);
    if(spd)spd.textContent='✅ Downloaded & saved!';
    var u=getUser();
    api('logDownload',{gmail:u?u.gmail:'guest',movieId:movieId,movieName:movieName,status:'completed'},function(){});
    toastOK('Download complete ✓');
    setTimeout(function(){if(prog)prog.classList.remove('show');},3000);
  }catch(err){
    if(spd)spd.textContent='Error: '+err.message;
    toastErr('Download failed');
    setTimeout(function(){if(prog)prog.classList.remove('show');},3000);
    window.open(url,'_blank');
  }
}

function scrollToComments(){var el=document.getElementById('commentsAnchor');if(el)el.scrollIntoView({behavior:'smooth'});}

function shareMovie(){
  var m=window._currentMovie;
  if(navigator.share&&m){
    navigator.share({title:m.name,text:'Watch '+m.name+' on KEYTUBE',url:window.location.href}).catch(function(){});
  }else{
    navigator.clipboard&&navigator.clipboard.writeText(window.location.href).then(function(){toastOK('Link copied!');});
  }
}
