// ── playlist.js ──────────────────────────────────────────────
var _inPlaylist=false;

function checkPlaylist(movieId){
  var u=getUser();if(!u)return;
  api('getPlaylist',{gmail:u.gmail},function(r){
    if(r.ok){
      _inPlaylist=r.movies.some(function(m){return m.id===movieId;});
      updatePlBtn();
    }
  });
}

function updatePlBtn(){
  var btn=document.getElementById('listBtn'),ab=document.getElementById('actPlaylist');
  if(btn)btn.textContent=_inPlaylist?'✓ In List':'+ My List';
  if(ab){var ic=ab.querySelector('.aic');if(ic)ic.textContent=_inPlaylist?'✅':'📋';}
}

function togglePlaylist(){
  var m=window._currentMovie;if(!m)return;
  if(!requireLogin())return;
  var u=getUser();
  var action=_inPlaylist?'removeFromPlaylist':'addToPlaylist';
  api(action,{gmail:u.gmail,movieId:m.id},function(r){
    if(r.ok){
      _inPlaylist=!_inPlaylist;updatePlBtn();
      toastOK(_inPlaylist?'Added to My List ✓':'Removed from My List');
    }else toastErr(r.msg||'Error');
  });
}

// ── PLAYLIST PAGE ────────────────────────────────────────────
function initPlaylistPage(){
  var pgL=document.getElementById('pgLoad');
  var u=getUser();
  if(!u){if(pgL)pgL.style.display='none';var lr=document.getElementById('loginReq');if(lr)lr.classList.add('show');return;}
  if(pgL)pgL.style.display='none';
  updateNavUI();startPing();
  loadSavedList(u);loadLikedList(u);loadHistoryList();loadDownloadsList();
  showPlTab('saved');
}

function loadSavedList(u){
  api('getPlaylist',{gmail:u.gmail},function(r){
    if(!r.ok)return;
    var list=r.movies||[];
    var ph=document.getElementById('phCount');if(ph)ph.textContent=list.length+' videos';
    var cnt=document.getElementById('plCount');if(cnt)cnt.textContent=list.length+' saved';
    if(list.length){var thumb=document.getElementById('phThumb');if(thumb&&list[0].cover)thumb.innerHTML='<img src="'+list[0].cover+'" style="width:100%;height:100%;object-fit:cover;border-radius:var(--r)">';}
    var sl=document.getElementById('savedList'),se=document.getElementById('savedEmpty');
    if(!list.length){if(se)se.classList.remove('hidden');return;}
    window._savedList=list;
    list.forEach(function(m){if(sl)sl.appendChild(makePlItem(m,'saved'));});
    // Set Play All button
    var pab=document.getElementById('playAllBtn');if(pab&&list.length)pab.onclick=function(){window.location.href='watch.html?id='+list[0].id;};
  });
}

function loadLikedList(u){
  api('getUserLikes',{gmail:u.gmail},function(r){
    if(!r.ok)return;
    var list=r.movies||[];
    var ll=document.getElementById('likedList'),le=document.getElementById('likedEmpty');
    if(!list.length){if(le)le.classList.remove('hidden');return;}
    list.forEach(function(m){if(ll)ll.appendChild(makePlItem(m,'liked'));});
  });
}

function loadHistoryList(){
  try{var h2=JSON.parse(localStorage.getItem('kt_history')||'[]');
  var hl=document.getElementById('historyList'),he=document.getElementById('historyEmpty');
  if(!h2.length){if(he)he.classList.remove('hidden');return;}
  h2.reverse().slice(0,50).forEach(function(item){if(hl){var d=document.createElement('div');d.className='pl-item';d.innerHTML='<div style="font-size:.82rem;font-weight:500">'+h(item.name||'')+'</div><div style="font-size:.72rem;color:var(--t2)">'+fmtDate(item.date||'')+'</div>';d.onclick=function(){window.location.href='watch.html?id='+item.id;};hl.appendChild(d);}});}catch(e){}
}

function loadDownloadsList(){
  if(!('caches' in window))return;
  caches.open('kkkkk').then(function(cache){return cache.keys();}).then(function(keys){
    var dl=document.getElementById('downloadsList'),de=document.getElementById('downloadsEmpty');
    if(!keys.length){if(de)de.classList.remove('hidden');return;}
    keys.forEach(function(req){
      var name=req.url.split('/').pop()||'video';
      var d=document.createElement('div');d.className='pl-item';
      d.innerHTML='<span style="font-size:1.2rem">⬇</span><div class="pl-item-info"><div class="pl-item-title">'+h(decodeURIComponent(name))+'</div><div class="pl-item-meta">Downloaded</div></div>'+
        '<button class="pl-remove-btn" onclick="deleteDownload(this,\''+req.url+'\')">🗑</button>';
      if(dl)dl.appendChild(d);
    });
  }).catch(function(){});
}

function deleteDownload(btn,url){
  caches.open('kkkkk').then(function(c){c.delete(url);}).then(function(){var p=btn.closest('.pl-item');if(p)p.remove();toastOK('Removed');}).catch(function(){});
}

function makePlItem(m,type){
  var d=document.createElement('div');d.className='pl-item';
  var ph='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="52"><rect fill="%23f2f2f2" width="80" height="52"/><text x="40" y="32" text-anchor="middle" fill="%23ccc" font-size="24">🎬</text></svg>';
  d.innerHTML='<img class="pl-item-thumb" src="'+(m.cover||ph)+'" alt="'+h(m.name)+'" onerror="this.src=\''+ph+'\'">'+
    '<div class="pl-item-info"><div class="pl-item-title">'+h(m.name)+'</div>'+
    '<div class="pl-item-meta">⭐ '+(m.rating||'—')+' · '+h(m.year||'')+'</div></div>'+
    '<div class="pl-item-actions"><button class="pl-remove-btn" onclick="removePlItem(this,\''+m.id+'\',\''+type+'\')">✕</button></div>';
  d.querySelector('.pl-item-info').onclick=function(){window.location.href='watch.html?id='+m.id;};
  return d;
}

function removePlItem(btn,id,type){
  var u=getUser();if(!u)return;
  var action=type==='liked'?'unlikeMovie':'removeFromPlaylist';
  api(action,{gmail:u.gmail,movieId:id},function(r){
    if(r.ok){var p=btn.closest('.pl-item');if(p)p.remove();toastOK('Removed');}
    else toastErr(r.msg||'Error');
  });
}

function showPlTab(tab){
  document.querySelectorAll('.pltab').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.pl-panel').forEach(function(p){p.classList.remove('active');});
  var btn=document.getElementById('pltab-'+tab);if(btn)btn.classList.add('active');
  var panel=document.getElementById('plpanel-'+tab);if(panel)panel.classList.add('active');
}

function sortPlaylist(by){
  var list=window._savedList;if(!list)return;
  var sorted=list.slice().sort(function(a,b){
    if(by==='name')return(a.name||'').localeCompare(b.name||'');
    if(by==='rating')return(parseFloat(b.rating)||0)-(parseFloat(a.rating)||0);
    return 0;
  });
  var sl=document.getElementById('savedList');if(sl){sl.innerHTML='';sorted.forEach(function(m){sl.appendChild(makePlItem(m,'saved'));});}
}

function playAll(){var list=window._savedList;if(list&&list.length)window.location.href='watch.html?id='+list[0].id;}
function shufflePlay(){var list=window._savedList;if(list&&list.length){var i=Math.floor(Math.random()*list.length);window.location.href='watch.html?id='+list[i].id;}}
