// ── search.js — Full search engine ──────────────────────────
var _srTimer=null,_srHistory=[],_activeFilter='all',_activeSort='relevance',_activeCat='';

function initSearchPage(){
  var pgL=document.getElementById('pgLoad');if(pgL)pgL.style.display='none';
  var u=getUser();updateNavUI();
  if(u)startPing();
  // Load history
  try{_srHistory=JSON.parse(localStorage.getItem('kt_searchHistory')||'[]');}catch(e){_srHistory=[];}
  renderHistory();
  // Load trending tags
  renderTrendingTags();
  // Load popular
  api('getMovies',{isLoggedIn:!!u,category:'all',type:'all'},function(r){
    if(r.ok&&r.movies.length){
      var pop=r.movies.slice().sort(function(a,b){return (parseFloat(b.rating)||0)-(parseFloat(a.rating)||0);}).slice(0,12);
      var pg=document.getElementById('popularGrid');if(pg)pop.forEach(function(m){pg.appendChild(makeCard(m,'grid'));});
    }
  });
  // Check for query in URL
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
  // Build suggestions from history + trending tags
  var matches=[];
  var ql=q.toLowerCase();
  _srHistory.forEach(function(h2){if(h2.toLowerCase().indexOf(ql)===0&&matches.length<3)matches.push({text:h2,icon:'🕐'});});
  _TRENDING_TAGS.forEach(function(t){if(t.toLowerCase().indexOf(ql)===0&&matches.indexOf(t)===-1&&matches.length<5)matches.push({text:t,icon:'🔥'});});
  if(!matches.length){sg.classList.add('hidden');return;}
  sl.innerHTML='';
  matches.forEach(function(s){
    var d=document.createElement('div');d.className='sugg-item';
    d.innerHTML='<span class="sugg-icon">'+s.icon+'</span><span>'+h(s.text)+'</span>';
    d.onclick=function(){var si=document.getElementById('mainSearch');if(si)si.value=s.text;execSearch(s.text);sg.classList.add('hidden');};
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
  // Save to history
  saveSearchHistory(q);
  // Hide sections
  var ts=document.getElementById('trendingSection'),hs=document.getElementById('historySection');
  if(ts)ts.style.display='none';if(hs)hs.style.display='none';
  var sg=document.getElementById('suggestions');if(sg)sg.classList.add('hidden');
  // Update URL
  history.pushState({},'','?q='+encodeURIComponent(q));
  // Call API
  var u=getUser();
  api('searchMovies',{query:q,isLoggedIn:!!u},function(r){
    if(!r.ok)return;
    renderSearchResults(q,r.exact||[],r.similar||[]);
  });
}

function renderSearchResults(q,exact,similar){
  var rs=document.getElementById('resultsSection');if(rs)rs.classList.remove('hidden');
  // Apply filters
  exact=applyClientFilters(exact);
  similar=applyClientFilters(similar);
  var sum=document.getElementById('srSummary');
  if(sum)sum.innerHTML='<strong>'+(exact.length+similar.length)+'</strong> results for "<em>'+h(q)+'</em>"';
  var srQ=document.getElementById('srQ');if(srQ)srQ.textContent=q;
  var srSub=document.getElementById('srSub');if(srSub)srSub.textContent=exact.length+' exact · '+similar.length+' similar';
  // Exact
  var ex=document.getElementById('srExact');if(ex)ex.innerHTML='';
  var em=document.getElementById('srEmpty');
  if(exact.length){
    var g=document.createElement('div');g.className='gw';
    exact.forEach(function(m){g.appendChild(makeCard(m,'grid'));});
    if(ex)ex.appendChild(g);
    if(em)em.classList.add('hidden');
  } else {
    if(ex)ex.innerHTML='<div class="nomatch" style="background:var(--w);border:1px solid var(--brd);border-radius:var(--r);padding:22px;text-align:center"><h3>No exact match for "'+h(q)+'"</h3><p style="color:var(--t2);font-size:.8rem;margin-top:4px">See similar results below ↓</p></div>';
  }
  // Similar
  var simHd=document.getElementById('srSimHd'),sim=document.getElementById('srSimilar');
  if(sim)sim.innerHTML='';
  if(similar.length){
    if(simHd)simHd.classList.remove('hidden');
    var g2=document.createElement('div');g2.className='gw';
    similar.forEach(function(m){g2.appendChild(makeCard(m,'grid'));});
    if(sim)sim.appendChild(g2);
  } else if(simHd)simHd.classList.add('hidden');
  // No results at all
  if(!exact.length&&!similar.length){
    if(em){em.classList.remove('hidden');
      var et=document.getElementById('srEmptyTitle');if(et)et.textContent='No results for "'+q+'"';
      var ep=document.getElementById('srEmptyMsg');if(ep)ep.textContent='Try different keywords or check your spelling';
      // Suggest random movies
      api('getMovies',{isLoggedIn:!!getUser(),category:'all',type:'all'},function(r){
        if(r.ok){var sg=document.getElementById('srSuggestMovies');if(sg){r.movies.slice(0,5).forEach(function(m){sg.appendChild(makeCard(m,'row'));});}}
      });
    }
  }
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
  _activeCat=document.getElementById('filterCat')?(document.getElementById('filterCat').value):'';
  _activeSort=document.getElementById('filterSort')?(document.getElementById('filterSort').value):'relevance';
  var si=document.getElementById('mainSearch');
  if(si&&si.value.trim())execSearch(si.value.trim());
}

function toggleAdvFilter(){
  var p=document.getElementById('advPanel');if(p)p.classList.toggle('hidden');
}

function closeSearchResults(){
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

// History
function saveSearchHistory(q){
  _srHistory=_srHistory.filter(function(x){return x!==q;});
  _srHistory.unshift(q);
  _srHistory=_srHistory.slice(0,10);
  try{localStorage.setItem('kt_searchHistory',JSON.stringify(_srHistory));}catch(e){}
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
    d.innerHTML='<span class="h-icon">🕐</span><span class="h-text">'+h(q)+'</span><button class="h-del" onclick="removeHistoryItem(this,\''+h(q)+'\')">✕</button>';
    d.querySelector('.h-text').onclick=function(){var si=document.getElementById('mainSearch');if(si)si.value=q;execSearch(q);};
    hl.appendChild(d);
  });
}

function removeHistoryItem(btn,q){
  _srHistory=_srHistory.filter(function(x){return x!==q;});
  try{localStorage.setItem('kt_searchHistory',JSON.stringify(_srHistory));}catch(e){}
  var p=btn.closest('.history-item');if(p)p.remove();
  if(!_srHistory.length){var hs=document.getElementById('historySection');if(hs)hs.style.display='none';}
}

function clearHistory(){
  _srHistory=[];
  try{localStorage.removeItem('kt_searchHistory');}catch(e){}
  var hl=document.getElementById('historyList');if(hl)hl.innerHTML='';
  var hs=document.getElementById('historySection');if(hs)hs.style.display='none';
}
