// ── search.js — Full search engine (KEYTUBE + AGASOBANUYE) ──
var _srTimer=null,_srHistory=[],_activeFilter='all',_activeSort='relevance',_activeCat='';
var _agSearchToken=0,_agSearchCount=0,_ktCount=0;

function initSearchPage(){
  var pgL=document.getElementById('pgLoad');if(pgL)pgL.style.display='none';
  var u=getUser();updateNavUI();
  if(u)startPing();
  try{_srHistory=JSON.parse(localStorage.getItem('kt_searchHistory')||'[]');}catch(e){_srHistory=[];}
  renderHistory();
  renderTrendingTags();
  api('getMovies',{isLoggedIn:!!u,category:'all',type:'all'},function(r){
    if(r.ok&&r.movies.length){
      var pop=r.movies.slice().sort(function(a,b){return (parseFloat(b.rating)||0)-(parseFloat(a.rating)||0);}).slice(0,12);
      var pg=document.getElementById('popularGrid');
      if(pg)pop.forEach(function(m){pg.appendChild(makeCard(m,'grid'));});
    }
  });
  var q=getParam('q');
  if(q){
    var si=document.getElementById('mainSearch');if(si)si.value=q;
    execSearch(q);
  }
}

var _TRENDING_TAGS=['Action Movies','Comedy','Drama Series','Chinese Drama','Bollywood','Cartoon','New Releases','Horror','Romance','Sci-Fi','Thriller','Animation'];

function renderTrendingTags(){
  var tt=document.getElementById('trendingTags');if(!tt)return;
  tt.innerHTML='';
  _TRENDING_TAGS.forEach(function(tag){
    var b=document.createElement('button');
    b.className='trending-tag';
    b.textContent=tag;
    b.onclick=function(){
      var si=document.getElementById('mainSearch');if(si)si.value=tag;
      execSearch(tag);
    };
    tt.appendChild(b);
  });
}

function onSearchInput(v){
  clearTimeout(_srTimer);
  var cb=document.getElementById('clearBtn');
  if(cb)cb.classList.toggle('hidden',!v.trim());
  if(!v.trim()){closeSearchResults();showSuggestions('');return;}
  showSuggestions(v);
  _srTimer=setTimeout(function(){execSearch(v.trim());},380);
}

function showSuggestions(q){
  var sg=document.getElementById('suggestions'),sl=document.getElementById('suggList');
  if(!sg||!sl)return;
  if(!q.trim()){sg.classList.add('hidden');return;}
  var matches=[],ql=q.toLowerCase();
  function has(t){return matches.some(function(x){return x.text===t;});}
  _srHistory.forEach(function(h2){
    if(h2.toLowerCase().indexOf(ql)===0&&matches.length<3)matches.push({text:h2,icon:'🕐'});
  });
  _TRENDING_TAGS.forEach(function(t){
    if(t.toLowerCase().indexOf(ql)===0&&!has(t)&&matches.length<5)matches.push({text:t,icon:'🔥'});
  });
  if(!matches.length){sg.classList.add('hidden');return;}
  sl.innerHTML='';
  matches.forEach(function(s){
    var d=document.createElement('div');d.className='sugg-item';
    d.innerHTML='<span class="sugg-icon">'+s.icon+'</span><span>'+h(s.text)+'</span>';
    d.onclick=function(){
      var si=document.getElementById('mainSearch');if(si)si.value=s.text;
      execSearch(s.text);sg.classList.add('hidden');
    };
    sl.appendChild(d);
  });
  sg.classList.remove('hidden');
}

function doSBtn(){
  var v=document.getElementById('mainSearch');if(!v)return;
  if(v.value.trim())execSearch(v.value.trim());else closeSearchResults();
}

function execSearch(q){
  q=q.trim();if(!q)return;
  saveSearchHistory(q);
  var ts=document.getElementById('trendingSection'),hs=document.getElementById('historySection');
  if(ts)ts.style.display='none';
  if(hs)hs.style.display='none';
  var sg=document.getElementById('suggestions');if(sg)sg.classList.add('hidden');
  history.pushState({},'','?q='+encodeURIComponent(q));
  var u=getUser();
  api('searchMovies',{query:q,isLoggedIn:!!u},function(r){
    if(!r||!r.ok){renderSearchResults(q,[],[]);return;}
    renderSearchResults(q,r.exact||[],r.similar||[]);
  });
  searchChannels(q);
  searchAgasobanuye(q);
}

// ── AGASOBANUYE ─────────────────────────────────────────────
function getAgasobanuyeSection(){
  var section=document.getElementById('srAgasobanuye');
  if(section)return section;
  var results=document.getElementById('resultsSection');
  section=document.createElement('div');
  section.id='srAgasobanuye';
  section.style.marginTop='18px';
  if(results){
    var after=document.getElementById('srSimilar');
    if(after&&after.parentNode===results)results.insertBefore(section,after.nextSibling);
    else results.appendChild(section);
  }
  return section;
}

function searchAgasobanuye(q){
  var token=++_agSearchToken;
  _agSearchCount=0;
  var rs=document.getElementById('resultsSection');
  if(rs)rs.classList.remove('hidden');
  var section=getAgasobanuyeSection();
  var msgStyle='padding:12px;color:var(--t2);font-size:.85rem';
  section.style.display='block';
  if(!window.AgasobanuSearch||typeof AgasobanuSearch.search!=='function'){
    section.innerHTML='<div style="'+msgStyle+'">AGASOBANUYE: agasobanu-searchapi.js is not loaded (check file name and path in app/).</div>';
    return;
  }
  section.innerHTML='<div style="'+msgStyle+'">Searching AGASOBANUYE...</div>';
  AgasobanuSearch.search(q,12).then(function(movies){
    if(token!==_agSearchToken)return;
    renderAgasobanuyeResults(movies||[]);
  }).catch(function(err){
    if(token!==_agSearchToken)return;
    console.warn('AGASOBANUYE search error:',err);
    section.innerHTML='<div style="'+msgStyle+'">AGASOBANUYE error: '+h(String(err&&err.message||err))+'</div>';
  });
}

function renderAgasobanuyeResults(movies){
  var rs=document.getElementById('resultsSection');
  if(rs)rs.classList.remove('hidden');
  var section=getAgasobanuyeSection();
  section.innerHTML='';
  if(!movies.length){
    section.style.display='block';
    section.innerHTML='<div style="padding:12px;color:var(--t2);font-size:.85rem">AGASOBANUYE: no movies found.</div>';
    _agSearchCount=0;updateSearchSummary();return;
  }
  section.style.display='block';
  _agSearchCount=movies.length;

  var heading=document.createElement('div');
  heading.style.cssText='font-size:.9rem;font-weight:700;margin:10px 0 12px;display:flex;align-items:center;gap:8px';
  heading.textContent='🎬 AGASOBANUYE ('+movies.length+')';
  section.appendChild(heading);

  var grid=document.createElement('div');
  grid.className='gw';
  movies.forEach(function(movie){
    if(!movie)return;
    var card=document.createElement('div');
    card.className='agasobanuye-result-card';
    card.style.cssText='background:var(--w);border:1px solid var(--brd);border-radius:var(--r);overflow:hidden;cursor:pointer;min-width:0;';

    var posterBox=document.createElement('div');
    posterBox.style.cssText='width:100%;aspect-ratio:16/10;background:var(--bg2);overflow:hidden;';
    if(movie.poster){
      var img=document.createElement('img');
      img.src=movie.poster;img.alt=movie.title||'Movie poster';img.loading='lazy';
      img.style.cssText='width:100%;height:100%;object-fit:cover;display:block;';
      img.onerror=function(){this.style.display='none';};
      posterBox.appendChild(img);
    }else{
      posterBox.textContent='🎬';
      posterBox.style.display='grid';posterBox.style.placeItems='center';posterBox.style.fontSize='2rem';
    }
    card.appendChild(posterBox);

    var info=document.createElement('div');
    info.style.padding='10px';
    var title=document.createElement('div');
    title.textContent=movie.title||'Untitled movie';
    title.style.cssText='font-size:.86rem;font-weight:700;margin-bottom:5px;';
    info.appendChild(title);

    if(movie.description){
      var desc=document.createElement('div');
      desc.textContent=movie.description;
      desc.style.cssText='font-size:.73rem;color:var(--t2);margin-bottom:7px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;';
      info.appendChild(desc);
    }

    var meta=document.createElement('div');
    meta.style.cssText='font-size:.7rem;color:var(--t2);display:flex;gap:7px;flex-wrap:wrap;';
    if(movie.category){var c=document.createElement('span');c.textContent=movie.category;meta.appendChild(c);}
    if(movie.type){var t=document.createElement('span');t.textContent=movie.type;meta.appendChild(t);}
    if(movie.linksCount){var p=document.createElement('span');p.textContent='🔗 '+movie.linksCount+' links';meta.appendChild(p);}
    info.appendChild(meta);
    card.appendChild(info);

    card.onclick=function(){
      if(!movie.slug){console.warn('AGASOBANUYE movie has no slug:',movie);return;}
      window.location.href='watch.html?source=agasobanuye&slug='+encodeURIComponent(movie.slug);
    };
    grid.appendChild(card);
  });
  section.appendChild(grid);
  updateSearchSummary();
}

function updateSearchSummary(){
  var sum=document.getElementById('srSummary');if(!sum)return;
  var q=(document.getElementById('mainSearch')||{}).value||'';
  var total=_ktCount+_agSearchCount;
  sum.innerHTML='<strong>'+total+'</strong> results for "<em>'+h(q.trim())+'</em>"'+(_agSearchCount?' including AGASOBANUYE':'');
}

// ── KEYTUBE results ─────────────────────────────────────────
function renderSearchResults(q,exact,similar){
  var rs=document.getElementById('resultsSection');if(rs)rs.classList.remove('hidden');
  exact=applyClientFilters(exact);
  similar=applyClientFilters(similar);
  _ktCount=exact.length+similar.length;
  var srQ=document.getElementById('srQ');if(srQ)srQ.textContent=q;
  var srSub=document.getElementById('srSub');if(srSub)srSub.textContent=exact.length+' exact · '+similar.length+' similar';

  var ex=document.getElementById('srExact');if(ex)ex.innerHTML='';
  var em=document.getElementById('srEmpty');
  if(exact.length){
    var g=document.createElement('div');g.className='gw';
    exact.forEach(function(m){g.appendChild(makeCard(m,'grid'));});
    if(ex)ex.appendChild(g);
  }else if(ex){
    ex.innerHTML='<div class="nomatch" style="background:var(--w);border:1px solid var(--brd);border-radius:var(--r);padding:22px;text-align:center"><h3>No exact match for "'+h(q)+'"</h3><p style="color:var(--t2);font-size:.8rem;margin-top:4px">See similar results below ↓</p></div>';
  }

  var simHd=document.getElementById('srSimHd'),sim=document.getElementById('srSimilar');
  if(sim)sim.innerHTML='';
  if(similar.length){
    if(simHd)simHd.classList.remove('hidden');
    var g2=document.createElement('div');g2.className='gw';
    similar.forEach(function(m){g2.appendChild(makeCard(m,'grid'));});
    if(sim)sim.appendChild(g2);
  }else if(simHd)simHd.classList.add('hidden');

  if(em){
    if(!exact.length&&!similar.length){
      em.classList.remove('hidden');
      var et=document.getElementById('srEmptyTitle');if(et)et.textContent='No results for "'+q+'"';
      var ep=document.getElementById('srEmptyMsg');if(ep)ep.textContent='Try different keywords or check your spelling';
      api('getMovies',{isLoggedIn:!!getUser(),category:'all',type:'all'},function(r){
        if(r.ok){
          var sg=document.getElementById('srSuggestMovies');
          if(sg){sg.innerHTML='';r.movies.slice(0,5).forEach(function(m){sg.appendChild(makeCard(m,'row'));});}
        }
      });
    }else{
      em.classList.add('hidden');
    }
  }
  updateSearchSummary();
}

function applyClientFilters(movies){
  var type=_activeFilter,cat=_activeCat,sort=_activeSort;
  var filtered=movies;
  if(type&&type!=='all')filtered=filtered.filter(function(m){return m.type===type||m.category===type;});
  if(cat)filtered=filtered.filter(function(m){return m.category===cat;});
  if(sort==='newest')filtered=filtered.slice().sort(function(a,b){return parseInt(b.year||0)-parseInt(a.year||0);});
  else if(sort==='rating')filtered=filtered.slice().sort(function(a,b){return (parseFloat(b.rating)||0)-(parseFloat(a.rating)||0);});
  return filtered;
}

function setFilter(type,btn){
  _activeFilter=type;
  document.querySelectorAll('.fpill').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  var si=document.getElementById('mainSearch');
  if(si&&si.value.trim())execSearch(si.value.trim());
}

function applyFilters(){
  var fc=document.getElementById('filterCat'),fs=document.getElementById('filterSort');
  _activeCat=fc?fc.value:'';
  _activeSort=fs?fs.value:'relevance';
  var si=document.getElementById('mainSearch');
  if(si&&si.value.trim())execSearch(si.value.trim());
}

function toggleAdvFilter(){
  var p=document.getElementById('advPanel');if(p)p.classList.toggle('hidden');
}

function closeSearchResults(){
  _agSearchToken++;_agSearchCount=0;_ktCount=0;
  var ag=document.getElementById('srAgasobanuye');
  if(ag){ag.innerHTML='';ag.style.display='none';}
  var rs=document.getElementById('resultsSection');if(rs)rs.classList.add('hidden');
  var ts=document.getElementById('trendingSection');if(ts)ts.style.display='';
  var hs=document.getElementById('historySection');if(hs)hs.style.display='';
  history.pushState({},'','search.html');
}

function clearSearch(){
  var si=document.getElementById('mainSearch');if(si)si.value='';
  var cb=document.getElementById('clearBtn');if(cb)cb.classList.add('hidden');
  closeSearchResults();
  var sg=document.getElementById('suggestions');if(sg)sg.classList.add('hidden');
}

// ── History ─────────────────────────────────────────────────
function saveHistoryToStorage(){
  try{localStorage.setItem('kt_searchHistory',JSON.stringify(_srHistory));}catch(e){}
}

function saveSearchHistory(q){
  _srHistory=_srHistory.filter(function(x){return x!==q;});
  _srHistory.unshift(q);
  _srHistory=_srHistory.slice(0,10);
  saveHistoryToStorage();
  renderHistory();
}

function renderHistory(){
  var hs=document.getElementById('historySection'),hl=document.getElementById('historyList');
  if(!hl)return;
  if(!_srHistory.length){if(hs)hs.style.display='none';return;}
  if(hs)hs.style.display='';
  hl.innerHTML='';
  _srHistory.forEach(function(q){
    var d=document.createElement('div');d.className='history-item';
    d.innerHTML='<span class="h-icon">🕐</span><span class="h-text">'+h(q)+'</span><button class="h-del">✕</button>';
    d.querySelector('.h-text').onclick=function(){
      var si=document.getElementById('mainSearch');if(si)si.value=q;
      execSearch(q);
    };
    d.querySelector('.h-del').onclick=function(){removeHistoryItem(this,q);};
    hl.appendChild(d);
  });
}

function removeHistoryItem(btn,q){
  _srHistory=_srHistory.filter(function(x){return x!==q;});
  saveHistoryToStorage();
  var p=btn.closest('.history-item');if(p)p.remove();
  if(!_srHistory.length){var hs=document.getElementById('historySection');if(hs)hs.style.display='none';}
}

function clearHistory(){
  _srHistory=[];
  try{localStorage.removeItem('kt_searchHistory');}catch(e){}
  var hl=document.getElementById('historyList');if(hl)hl.innerHTML='';
  var hs=document.getElementById('historySection');if(hs)hs.style.display='none';
}

// ── Channels ────────────────────────────────────────────────
function searchChannels(q){
  api('searchChannels',{query:q},function(r){
    if(!r.ok)return;
    renderChannelResults(r.channels||[]);
  });
}

function renderChannelResults(channels){
  var wrap=document.getElementById('srChannels');
  if(!wrap)return;
  wrap.innerHTML='';
  if(!channels.length){wrap.style.display='none';return;}
  var hd=document.createElement('div');
  hd.style.cssText='font-size:.82rem;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.4px;margin:14px 0 10px;display:flex;align-items:center;gap:6px';
  hd.innerHTML='📺 Channels <span style="font-weight:400;color:var(--t3);font-size:.75rem">('+channels.length+')</span>';
  wrap.appendChild(hd);
  channels.forEach(function(ch){wrap.appendChild(makeChannelCard(ch));});
  wrap.style.display='block';
}

function makeChannelCard(ch){
  var d=document.createElement('div');
  d.style.cssText='display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--w);border:1px solid var(--brd);border-radius:var(--r);cursor:pointer;transition:background .15s;margin-bottom:8px';
  d.onmouseenter=function(){this.style.background='var(--bg2)';};
  d.onmouseleave=function(){this.style.background='var(--w)';};

  var colors=['#e53935','#d81b60','#8e24aa','#1e88e5','#00897b','#43a047','#f4511e','#fb8c00'];
  var gmail=ch.gmail||'';
  var seed=gmail.split('').reduce(function(a,c){return a*31+c.charCodeAt(0);},0);
  var color=colors[Math.abs(seed)%colors.length];
  var init=(ch.name||ch.gmail||'?')[0].toUpperCase();

  // Avatar (built with DOM, no inline-quote tricks)
  var av=document.createElement('div');
  av.style.cssText='width:52px;height:52px;border-radius:50%;overflow:hidden;flex-shrink:0;background:'+color+';color:#fff;font-size:1.3rem;font-weight:700;display:grid;place-items:center';
  if(ch.avatar&&String(ch.avatar).trim()){
    var img=document.createElement('img');
    img.src=ch.avatar;img.alt=init;
    img.style.cssText='width:100%;height:100%;object-fit:cover;display:block';
    img.onerror=function(){av.innerHTML='';av.textContent=init;};
    av.style.background='var(--bg2)';
    av.appendChild(img);
  }else{
    av.textContent=init;
  }
  d.appendChild(av);

  var badge=ch.monetizationEnabled
    ?'<span style="font-size:.63rem;background:rgba(245,197,24,.15);color:#9a7d0a;border:1px solid rgba(245,197,24,.5);border-radius:3px;padding:1px 5px;font-weight:700">💰 Monetized</span>'
    :'';

  var body=document.createElement('div');
  body.style.cssText='flex:1;min-width:0';
  body.innerHTML=
    '<div style="font-size:.9rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+h(ch.name||ch.gmail)+'</div>'+
    '<div style="font-size:.74rem;color:var(--t2);margin:2px 0">'+h(ch.handle||'')+'</div>'+
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:2px">'+
      '<span style="font-size:.74rem;color:var(--t2)">👥 '+fmtNum(ch.followerCount||0)+' followers</span>'+
      '<span style="font-size:.74rem;color:var(--t2)">🎬 '+(ch.videoCount||0)+' videos</span>'+
      badge+
    '</div>'+
    (ch.bio?'<div style="font-size:.74rem;color:var(--t3);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+h(ch.bio)+'</div>':'');
  d.appendChild(body);

  var fb=document.createElement('button');
  fb.textContent='Follow';
  fb.style.cssText='padding:6px 14px;border-radius:20px;border:1.5px solid var(--red);background:var(--red);color:#fff;font-size:.76rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:all .2s';
  fb.onclick=function(e){e.stopPropagation();followFromSearch(ch.gmail,fb);};
  d.appendChild(fb);

  d.onclick=function(){
    window.location.href='channel.html?gmail='+encodeURIComponent(ch.gmail||'');
  };
  return d;
}

function followFromSearch(channelGmail,btn){
  var u=getUser();
  if(!u){showLoginReq();return;}
  var isFollowing=btn.textContent.trim()==='Following';
  api(isFollowing?'unfollowChannel':'followChannel',{gmail:u.gmail,channelGmail:channelGmail},function(r){
    if(r.ok){
      if(isFollowing){
        btn.textContent='Follow';
        btn.style.background='var(--red)';
        btn.style.color='#fff';
      }else{
        btn.textContent='Following';
        btn.style.background='var(--w)';
        btn.style.color='var(--red)';
        btn.style.borderColor='var(--red)';
        toastOK('Following ✓');
      }
    }else{
      toastErr(r.msg||'Error');
    }
  });
}
