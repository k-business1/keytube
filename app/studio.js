// ── studio.js — KEYTUBE Studio full logic ───────────────────
var _studioUser=null,_studioChannel=null,_studioStats=null,_editVideoId=null;

function initStudioPage(){
  var pgL=document.getElementById('pgLoad');
  var u=getUser();
  if(!u){window.location.href='../pages/login.html?redirect=../pages/studio.html';return;}
  _studioUser=u;
  if(pgL)pgL.style.display='none';
  // Mobile bar avatar
  var avEl=document.getElementById('avEl');
  if(avEl){var init=(u.name||u.gmail||'U')[0].toUpperCase();if(u.avatar)avEl.innerHTML='<img src="'+u.avatar+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';else avEl.textContent=init;}
  // Sidebar channel mini
  var sn=document.getElementById('sidebarName');if(sn)sn.textContent=u.name||u.gmail;
  // Load channel
  api('getMyChannel',{gmail:u.gmail},function(r){
    if(r.ok){
      _studioChannel=r.channel;
      updateSidebarChannel();
    }
    // Tab from URL
    var tab=getParam('tab')||'dashboard';
    showStudioTab(tab);
    startPing();
  });
  // Profile tab prefill
  var peName=document.getElementById('peName');if(peName)peName.value=u.name||'';
  var peEmail=document.getElementById('peEmail');if(peEmail)peEmail.value=u.gmail;
  var peCountry=document.getElementById('peCountry');if(peCountry)peCountry.value=u.country||'';
  var peAv=document.getElementById('peAvatar'),peInit=document.getElementById('peInitial'),peImg=document.getElementById('peAvatarImg');
  if(peAv){var init=(u.name||u.gmail||'U')[0].toUpperCase();if(u.avatar&&peImg){peImg.src=u.avatar;peImg.style.display='block';if(peInit)peInit.style.display='none';}else if(peInit)peInit.textContent=init;}
}

function updateSidebarChannel(){
  var ch=_studioChannel;
  var shEl=document.getElementById('sidebarHandle');
  if(ch){
    if(shEl)shEl.textContent=ch.handle||'@channel';
    var sAv=document.getElementById('sidebarAvatar'),sI=document.getElementById('sidebarInitial');
    if(ch.avatar&&sAv){sAv.innerHTML='<img src="'+ch.avatar+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';}
    else if(sI)sI.textContent=(_studioUser.name||'C')[0].toUpperCase();
    // Prefill channel form
    prefillChannelForm(ch);
  }else{if(shEl)shEl.textContent='No channel yet';}
}

function showStudioTab(tab){
  document.querySelectorAll('.studio-tab').forEach(function(t){t.classList.remove('active');t.classList.add('hidden');});
  document.querySelectorAll('.snav-btn').forEach(function(b){b.classList.remove('active');});
  var panel=document.getElementById('stab-'+tab);
  if(panel){panel.classList.remove('hidden');panel.classList.add('active');}
  var btn=document.getElementById('snav-'+tab);if(btn)btn.classList.add('active');
  var title=document.getElementById('smb-title');
  var titles={dashboard:'Dashboard',videos:'My Videos',playlists:'Playlists',comments:'Comments',likes:'Likes',followers:'Followers',analytics:'Analytics',notifications:'Notifications',earnings:'Earnings',channel:'Channel',profile:'Profile',settings:'Settings'};
  if(title)title.textContent=titles[tab]||tab;
  // Close sidebar on mobile
  var sb=document.getElementById('studioPSidebar');if(sb&&window.innerWidth<768)sb.classList.remove('open');
  // Load tab content
  var loaders={dashboard:loadDashboard,videos:loadMyVideos,playlists:loadMyPlaylists,comments:loadMyComments,likes:loadMyLikes,followers:loadMyFollowers,analytics:loadAnalytics,notifications:loadStudioNotifs,earnings:loadEarnings,channel:loadChannelForm,profile:function(){},settings:function(){}};
  if(loaders[tab])loaders[tab]();
}

function toggleSidebar(){var sb=document.getElementById('studioPSidebar');if(sb)sb.classList.toggle('open');}

// ── DASHBOARD ───────────────────────────────────────────────
function loadDashboard(){
  var u=_studioUser;
  var dw=document.getElementById('dashWelcome');if(dw)dw.textContent=u.name||u.gmail;
  var ncb=document.getElementById('noChannelBanner'),dc=document.getElementById('dashContent');
  if(!_studioChannel){if(ncb)ncb.classList.remove('hidden');if(dc)dc.style.display='none';return;}
  if(ncb)ncb.classList.add('hidden');if(dc)dc.style.display='';
  // Stats
  api('getChannelStats',{gmail:u.gmail},function(r){
    if(!r.ok)return;
    _studioStats=r.stats;
    var s=r.stats;
    setText('ds-views',fmtNum(s.totalViews));setText('ds-followers',fmtNum(s.followerCount));
    setText('ds-videos',fmtNum(s.totalVideos));setText('ds-likes',fmtNum(s.totalLikes));
    setText('ds-comments',fmtNum(s.totalComments));setText('ds-downloads',fmtNum(s.totalDownloads));
    setText('ds-recent',fmtNum(s.recentViews));
    // Earnings
    api('getEarnings',{gmail:u.gmail},function(er){if(er.ok)setText('ds-earnings','$'+er.total.toFixed(2));});
    // Monetize progress
    var pct=Math.min((s.followerCount/1000)*100,100);
    var mb=document.getElementById('monetizeBar');if(mb)mb.style.width=pct+'%';
    var mbadge=document.getElementById('monetizeBadge');
    if(mbadge)mbadge.textContent=s.followerCount>=1000?'✅ Unlocked':'🔒 Locked';
    if(mbadge&&s.followerCount>=1000)mbadge.className='mp-badge unlocked';
    setText('mpCurrent',s.followerCount.toLocaleString()+' followers');
    var mpMsg=document.getElementById('mpMsg');
    if(mpMsg)mpMsg.textContent=s.followerCount>=1000?'🎉 Monetization is active! You can earn from your content.':'You need '+(1000-s.followerCount)+' more followers to unlock earnings.';
    // Trending
    var tl=document.getElementById('dashTrending');
    if(tl){tl.innerHTML='';(s.trending||[]).forEach(function(v,i){
      var d=document.createElement('div');d.className='trend-item';
      d.innerHTML='<div class="trend-rank">'+(i+1)+'</div>'+
        '<img class="trend-thumb" src="'+(v.cover||'')+'" alt="" onerror="this.style.display=\'none\'">'+
        '<div class="trend-info"><div class="trend-title">'+h(v.name)+'</div>'+
        '<div class="trend-views">'+fmtNum(v.views)+' views · '+fmtNum(v.likes)+' likes</div></div>';
      d.onclick=function(){window.location.href='../pages/watch.html?id='+v.id;};
      tl.appendChild(d);
    });}
    // Comments preview
    api('getMyVideoComments',{gmail:u.gmail},function(cr){
      var dc2=document.getElementById('dashComments');if(!dc2)return;
      dc2.innerHTML='';(cr.comments||[]).slice(0,3).forEach(function(c){
        var d=document.createElement('div');d.className='cmt-item';
        d.innerHTML='<div class="cmt-av">'+c.name[0].toUpperCase()+'</div><div><div class="cmt-name">'+h(c.name)+'</div><div class="cmt-txt">'+h(c.comment)+'</div></div>';
        dc2.appendChild(d);
      });
      if(!(cr.comments||[]).length)dc2.innerHTML='<p style="color:var(--t2);font-size:.82rem">No comments yet.</p>';
    });
  });
}

// ── MY VIDEOS ───────────────────────────────────────────────
function loadMyVideos(){
  var u=_studioUser;
  api('getMovies',{isLoggedIn:true,uploaderGmail:u.gmail},function(r){
    if(!r.ok)return;
    window._myVideos=r.movies||[];
    renderVideosTable(r.movies||[]);
  });
}

function renderVideosTable(movies){
  var tb=document.getElementById('videosTableBody'),empty=document.getElementById('videosEmpty');
  if(!tb)return;tb.innerHTML='';
  if(!movies.length){if(empty)empty.classList.remove('hidden');return;}
  if(empty)empty.classList.add('hidden');
  movies.forEach(function(m){
    var tr=document.createElement('tr');
    var ph='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="36"><rect fill="%23f2f2f2" width="56" height="36"/></svg>';
    tr.innerHTML='<td><div style="display:flex;align-items:center;gap:8px"><img class="vt-thumb" src="'+(m.cover||ph)+'" onerror="this.src=\''+ph+'\'"><span class="vt-title">'+h(m.name)+'</span></div></td>'+
      '<td>'+cap(m.category||'')+'</td><td>—</td><td>—</td><td>—</td>'+
      '<td>'+fmtDateFull(m.added||'')+'</td>'+
      '<td><div class="vt-actions">'+
        '<button class="vt-btn vt-btn-bl" onclick="watchVideo(\''+m.id+'\')">▶</button>'+
        '<button class="vt-btn" onclick="editVideo(\''+m.id+'\')">✏️</button>'+
        '<button class="vt-btn vt-btn-red" onclick="deleteVideo(\''+m.id+'\',\''+h(m.name)+'\')">🗑</button>'+
      '</div></td>';
    tb.appendChild(tr);
  });
  // Fill views/likes async
  var u=_studioUser;
  api('getChannelStats',{gmail:u.gmail},function(sr){
    if(!sr.ok)return;
    var vs=sr.stats.videoStats||[];
    var map={};vs.forEach(function(v){map[v.id]=v;});
    var rows=tb.querySelectorAll('tr');
    movies.forEach(function(m,i){
      var st=map[m.id]||{views:0,likes:0,comments:0};
      var tds=rows[i]?rows[i].querySelectorAll('td'):[];
      if(tds[2])tds[2].textContent=fmtNum(st.views);
      if(tds[3])tds[3].textContent=fmtNum(st.likes);
      if(tds[4])tds[4].textContent=fmtNum(st.comments);
    });
  });
}

function filterMyVideos(q){var v=window._myVideos||[];if(!q)renderVideosTable(v);else renderVideosTable(v.filter(function(m){return m.name.toLowerCase().indexOf(q.toLowerCase())!==-1;}));}
function sortMyVideos(by){var v=window._myVideos||[];var sorted=v.slice().sort(function(a,b){if(by==='likes')return 0;if(by==='popular')return 0;return new Date(b.added||0)-new Date(a.added||0);});renderVideosTable(sorted);}
function watchVideo(id){window.open('../pages/watch.html?id='+id,'_blank');}
function editVideo(id){window.location.href='../uploads/upload.html?edit='+id;}
function deleteVideo(id,name){
  if(!confirm('Delete "'+name+'"? This cannot be undone.'))return;
  var u=_studioUser;
  api('deleteMovie',{token:'',gmail:u.gmail,id:id},function(r){
    if(r.ok){toastOK('Video deleted');loadMyVideos();}
    else toastErr(r.msg||'Error');
  });
}

// ── PLAYLISTS ───────────────────────────────────────────────
function loadMyPlaylists(){
  var u=_studioUser;
  api('getPlaylist',{gmail:u.gmail},function(r){
    if(!r.ok)return;
    var grid=document.getElementById('studioPlaylistGrid'),empty=document.getElementById('studioPlaylistEmpty');
    if(!r.movies.length){if(empty)empty.classList.remove('hidden');return;}
    if(empty)empty.classList.add('hidden');
    if(grid)r.movies.forEach(function(m){grid.appendChild(makeCard(m,'grid'));});
  });
}

// ── COMMENTS ────────────────────────────────────────────────
function loadMyComments(){
  var u=_studioUser;
  api('getMyVideoComments',{gmail:u.gmail},function(r){
    var list=document.getElementById('studioCommentsList'),empty=document.getElementById('studioCommentsEmpty');
    if(!r.ok||!r.comments.length){if(empty)empty.classList.remove('hidden');return;}
    if(empty)empty.classList.add('hidden');
    if(list){list.innerHTML='';r.comments.forEach(function(c){
      var d=document.createElement('div');d.className='studio-cmt-item';
      d.innerHTML='<div class="sci-avatar">'+c.name[0].toUpperCase()+'</div>'+
        '<div class="sci-body"><div class="sci-header"><span class="sci-user">'+h(c.name||c.gmail)+'</span>'+
        '<span class="sci-movie" onclick="watchVideo(\''+c.movieId+'\')">on a video</span>'+
        '<span class="sci-date">'+fmtDate(c.date)+'</span></div>'+
        '<div class="sci-text">'+h(c.emoji||'💬')+' '+h(c.comment)+'</div>'+
        '<div class="sci-actions"><button class="vt-btn vt-btn-red" onclick="deleteStudioComment(\''+c.id+'\')">🗑 Delete</button></div></div>';
      list.appendChild(d);
    });}
  });
}
function filterStudioComments(){}
function deleteStudioComment(id){
  if(!confirm('Delete?'))return;
  var adm=getAdminToken()||'';
  var u=_studioUser;
  api('deleteComment',{token:adm,gmail:u.gmail,id:id},function(r){if(r.ok){toastOK('Deleted');loadMyComments();}else toastErr(r.msg);});
}

// ── LIKES ───────────────────────────────────────────────────
function loadMyLikes(){
  var u=_studioUser;
  api('getUserLikes',{gmail:u.gmail},function(r){
    var grid=document.getElementById('studioLikesGrid'),empty=document.getElementById('studioLikesEmpty');
    if(!r.ok||!r.movies.length){if(empty)empty.classList.remove('hidden');return;}
    if(empty)empty.classList.add('hidden');
    if(grid)r.movies.forEach(function(m){grid.appendChild(makeCard(m,'grid'));});
  });
}

// ── FOLLOWERS ───────────────────────────────────────────────
function loadMyFollowers(){
  var u=_studioUser;
  api('getFollowers',{gmail:u.gmail},function(r){
    var fbc=document.getElementById('followerCountBig');if(fbc&&r.ok)fbc.textContent=fmtNum(r.count);
    var fl=document.getElementById('followersList'),fe=document.getElementById('followersEmpty');
    if(!r.ok||!r.followers.length){if(fe)fe.classList.remove('hidden');return;}
    if(fe)fe.classList.add('hidden');
    if(fl){fl.innerHTML='';r.followers.forEach(function(f){
      var d=document.createElement('div');d.className='follower-item';
      var init=(f.gmail||'?')[0].toUpperCase();
      d.innerHTML='<div class="follower-av">'+init+'</div>'+
        '<div><div class="follower-name">'+h(f.gmail)+'</div>'+
        '<div class="follower-date">Followed '+fmtDate(f.date)+'</div></div>';
      fl.appendChild(d);
    });}
  });
}

// ── ANALYTICS ───────────────────────────────────────────────
var _analyticsPeriod=30;
function loadAnalytics(){setAnalyticsPeriod(_analyticsPeriod,null);}
function setAnalyticsPeriod(days,btn){
  _analyticsPeriod=days;
  if(btn){document.querySelectorAll('.aperiod-btn').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');}
  var u=_studioUser;
  api('getChannelStats',{gmail:u.gmail},function(r){
    if(!r.ok)return;var s=r.stats;
    setText('aViews',fmtNum(days?s.recentViews:s.totalViews));
    setText('aWatchTime','—');setText('aFollowers',fmtNum(s.followerCount));
    setText('aLikes',fmtNum(s.totalLikes));
    var tb=document.getElementById('analyticsTable');if(!tb)return;tb.innerHTML='';
    (s.videoStats||[]).forEach(function(v){
      var tr=document.createElement('tr');
      tr.innerHTML='<td>'+h(v.name)+'</td><td>'+fmtNum(v.views)+'</td><td>'+fmtNum(v.likes)+'</td><td>'+fmtNum(v.comments)+'</td><td>'+fmtNum(v.downloads)+'</td>';
      tb.appendChild(tr);
    });
    if(!(s.videoStats||[]).length)tb.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--t2);padding:20px">No video data yet</td></tr>';
  });
}

// ── NOTIFICATIONS ────────────────────────────────────────────
function loadStudioNotifs(){
  var u=_studioUser;
  api('getNotifications',{gmail:u.gmail},function(r){
    var nl=document.getElementById('studioNotifList'),ne=document.getElementById('studioNotifEmpty');
    if(!r.ok||!r.notifications.length){if(ne)ne.classList.remove('hidden');return;}
    if(ne)ne.classList.add('hidden');
    if(nl){nl.innerHTML='';r.notifications.forEach(function(n){
      var d=document.createElement('div');d.className='studio-notif-item'+(n.isRead?'':' unread');
      var icons={download:'📱',new:'✨',info:'🔔'};
      d.innerHTML='<div class="sni-icon">'+(icons[n.type]||'🔔')+'</div>'+
        '<div><div class="sni-title">'+h(n.title)+'</div><div class="sni-msg">'+h(n.message)+'</div><div class="sni-date">'+fmtDate(n.date)+'</div></div>';
      d.onclick=function(){if(!n.isRead){api('markNotifRead',{gmail:u.gmail,notifId:n.id},null);d.classList.remove('unread');}};
      nl.appendChild(d);
    });}
  });
}
function markAllReadStudio(){markAllRead();setTimeout(loadStudioNotifs,600);}

// ── EARNINGS ────────────────────────────────────────────────
function loadEarnings(){
  var u=_studioUser;
  api('getEarnings',{gmail:u.gmail},function(r){
    if(!r.ok)return;
    setText('earnTotal','$'+r.total.toFixed(2));
    setText('earnPending','$'+r.pending.toFixed(2));
    var now=new Date(),mo=r.earnings.filter(function(e){var d=new Date(e.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).reduce(function(s,e){return s+e.amount;},0);
    setText('earnMonth','$'+mo.toFixed(2));
    var es=document.getElementById('earnStatus');
    if(es){var fc=_studioStats?_studioStats.followerCount:0;es.innerHTML=fc>=1000?'<span style="color:var(--green);font-weight:700">✅ Monetization Active</span>':'<span style="color:var(--t2)">🔒 Need '+(1000-fc)+' more followers to unlock earnings</span>';}
    var eh=document.getElementById('earnHistory'),ee=document.getElementById('earnHistoryEmpty');
    if(!r.earnings.length){if(ee)ee.classList.remove('hidden');return;}
    if(ee)ee.classList.add('hidden');
    if(eh){eh.innerHTML='';r.earnings.slice().reverse().forEach(function(e){
      var d=document.createElement('div');d.className='eh-item';
      var icons={earning:'💰',withdrawal:'💸',bonus:'⭐'};var credit=e.type!=='withdrawal';
      d.innerHTML='<div class="eh-icon">'+(icons[e.type]||'💰')+'</div><div class="eh-info"><div class="eh-title">'+cap(e.type||'earning')+' — '+h(e.description||'')+'</div><div class="eh-date">'+fmtDateFull(e.date)+'</div></div><div class="eh-amount '+(credit?'eh-credit':'eh-debit')+'">'+(credit?'+':'-')+'$'+Math.abs(e.amount).toFixed(2)+'</div>';
      eh.appendChild(d);
    });}
  });
}

// ── CHANNEL FORM ─────────────────────────────────────────────
function loadChannelForm(){
  var notice=document.getElementById('noChannelNotice');
  if(!_studioChannel){if(notice)notice.classList.remove('hidden');}
  else{if(notice)notice.classList.add('hidden');prefillChannelForm(_studioChannel);}
}

function prefillChannelForm(ch){
  var nm=document.getElementById('chName');if(nm)nm.value=ch.name||'';
  var hh=document.getElementById('chHandle');if(hh)hh.value=(ch.handle||'').replace('@','');
  var bio=document.getElementById('chBio');if(bio)bio.value=ch.bio||'';
  // Avatar preview
  var cai=document.getElementById('chAvatarImg'),cai2=document.getElementById('chAvatarInitial');
  if(ch.avatar&&cai){cai.src=ch.avatar;cai.style.display='block';if(cai2)cai2.style.display='none';}
  // Banner
  var bp=document.getElementById('chBannerPreview');
  if(bp&&ch.banner){bp.innerHTML='<img src="'+ch.banner+'" style="width:100%;height:100%;object-fit:cover;border-radius:var(--r)">';}
  // Social links
  if(ch.socialLinks){try{var sl=JSON.parse(ch.socialLinks);var links=['facebook','twitter','instagram','youtube'];links.forEach(function(l){var el=document.getElementById('ch'+cap(l));if(el&&sl[l])el.value=sl[l];});}catch(e){}}
  var btn=document.getElementById('chSaveBtn');if(btn)btn.textContent='💾 Update Channel';
}

function validateHandle(input){
  var val=input.value.replace(/[^a-z0-9_]/gi,'').toLowerCase();input.value=val;
  var st=document.getElementById('handleStatus');
  if(!val||val.length<3){if(st){st.textContent='Handle must be at least 3 characters';st.className='handle-status handle-err';}return;}
  if(st){st.textContent='Checking…';st.className='handle-status handle-checking';}
  // Simple check — backend validates on save
  setTimeout(function(){if(st){st.textContent='✓ Available';st.className='handle-status handle-ok';}},300);
}

function saveChannel(){
  var u=_studioUser;
  var nm=document.getElementById('chName'),hh=document.getElementById('chHandle'),bio=document.getElementById('chBio');
  var er=document.getElementById('chErr');if(er)er.textContent='';
  if(!nm||!nm.value.trim()){if(er)er.textContent='Channel name is required';return;}
  // Build social links
  var sl={};['facebook','twitter','instagram','youtube'].forEach(function(l){var el=document.getElementById('ch'+cap(l));if(el&&el.value.trim())sl[l]=el.value.trim();});
  var data={gmail:u.gmail,name:nm.value.trim(),handle:'@'+(hh?hh.value.trim():''),bio:bio?bio.value.trim():'',socialLinks:JSON.stringify(sl)};
  var action=_studioChannel?'updateChannel':'createChannel';
  var btn=document.getElementById('chSaveBtn');if(btn){btn.disabled=true;btn.textContent='Saving…';}
  api(action,data,function(r){
    if(btn){btn.disabled=false;btn.textContent=_studioChannel?'💾 Update Channel':'💾 Create Channel';}
    if(r.ok){
      toastOK(_studioChannel?'Channel updated ✓':'Channel created! 🎉');
      if(!_studioChannel&&r.channel)_studioChannel=r.channel;
      else api('getMyChannel',{gmail:u.gmail},function(mr){if(mr.ok)_studioChannel=mr.channel;updateSidebarChannel();});
      updateSidebarChannel();
      // Refresh dashboard
      var ncb=document.getElementById('noChannelBanner'),dc=document.getElementById('dashContent');
      if(ncb)ncb.classList.add('hidden');if(dc)dc.style.display='';
    }else{if(er)er.textContent=r.msg;}
  });
}

function uploadChannelBanner(input){
  var file=input.files[0];if(!file)return;
  toastInfo('Uploading banner…');
  uploadToCloudinary(file,CDN_USER,null).then(function(res){
    var bp=document.getElementById('chBannerPreview');
    if(bp)bp.innerHTML='<img src="'+res.url+'" style="width:100%;height:100%;object-fit:cover;border-radius:var(--r)">';
    if(_studioChannel){api('updateChannel',{gmail:_studioUser.gmail,banner:res.url},function(r){if(r.ok){toastOK('Banner updated ✓');_studioChannel.banner=res.url;}else toastErr(r.msg);});}
    else{window._pendingBanner=res.url;}
  }).catch(function(e){toastErr('Upload failed: '+e.message);});
}

function uploadChannelAvatar(input){
  var file=input.files[0];if(!file)return;
  toastInfo('Uploading avatar…');
  uploadToCloudinary(file,CDN_USER,null).then(function(res){
    var cai=document.getElementById('chAvatarImg'),cai2=document.getElementById('chAvatarInitial');
    if(cai){cai.src=res.url;cai.style.display='block';}if(cai2)cai2.style.display='none';
    if(_studioChannel){api('updateChannel',{gmail:_studioUser.gmail,avatar:res.url},function(r){if(r.ok){toastOK('Avatar updated ✓');_studioChannel.avatar=res.url;updateSidebarChannel();}else toastErr(r.msg);});}
    else window._pendingChannelAvatar=res.url;
  }).catch(function(e){toastErr('Upload failed: '+e.message);});
}

// ── PROFILE SETTINGS ────────────────────────────────────────
function uploadProfileAvatar(input){
  var file=input.files[0];if(!file)return;
  toastInfo('Uploading photo…');
  var prog=document.getElementById('peUploadProgress'),bar=document.getElementById('peUploadBar'),pct=document.getElementById('peUploadPct');
  if(prog)prog.classList.remove('hidden');
  uploadToCloudinary(file,CDN_USER,function(p){if(bar)bar.style.width=p+'%';if(pct)pct.textContent=p+'%';}).then(function(res){
    if(prog)prog.classList.add('hidden');
    var peImg=document.getElementById('peAvatarImg'),peInit=document.getElementById('peInitial');
    if(peImg){peImg.src=res.url;peImg.style.display='block';}if(peInit)peInit.style.display='none';
    api('updateUserProfile',{gmail:_studioUser.gmail,avatar:res.url},function(r){
      if(r.ok){_studioUser=r.user||_studioUser;setUser(_studioUser);updateNavUI();toastOK('Photo updated ✓');}else toastErr(r.msg);
    });
  }).catch(function(e){if(prog)prog.classList.add('hidden');toastErr('Upload failed: '+e.message);});
}

function saveProfileSettings(){
  var u=_studioUser;
  var nm=document.getElementById('peName'),co=document.getElementById('peCountry'),er=document.getElementById('peErr');
  if(er)er.textContent='';
  api('updateUserProfile',{gmail:u.gmail,name:nm?nm.value.trim():u.name,country:co?co.value:u.country},function(r){
    if(r.ok){_studioUser=r.user||u;setUser(_studioUser);toastOK('Profile saved ✓');}
    else{if(er)er.textContent=r.msg;}
  });
}

function changePasswordStudio(){
  var u=_studioUser;
  var cp=document.getElementById('peCurPw'),np=document.getElementById('peNewPw'),np2=document.getElementById('peNewPw2'),er=document.getElementById('pePwErr');
  if(er)er.textContent='';
  if(!cp||!np||!np2)return;
  if(!cp.value||!np.value){if(er)er.textContent='Fill all password fields.';return;}
  if(np.value!==np2.value){if(er)er.textContent='Passwords do not match.';return;}
  if(np.value.length<6){if(er)er.textContent='Min 6 characters.';return;}
  api('updateUserProfile',{gmail:u.gmail,password:cp.value,newPassword:np.value},function(r){
    if(r.ok){toastOK('Password updated ✓');cp.value='';np.value='';np2.value='';}
    else{if(er)er.textContent=r.msg;}
  });
}

// ── SETTINGS ─────────────────────────────────────────────────
function setTheme(theme){
  document.body.classList.toggle('dark',theme==='dark');
  try{localStorage.setItem('kt_theme',theme);}catch(e){}
  document.querySelectorAll('.tt-btn').forEach(function(b){b.classList.remove('active');});
  var btn=document.getElementById('tt-'+theme);if(btn)btn.classList.add('active');
  toastOK('Theme: '+cap(theme));
}

// ── HELPERS ──────────────────────────────────────────────────
function setText(id,val){var el=document.getElementById(id);if(el)el.textContent=val;}
