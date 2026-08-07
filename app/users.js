
// ── users.js — Profile, channel, followers, wallet ─────────

// ── PROFILE PAGE ────────────────────────────────────────────
function initProfilePage(){
  var pgL=document.getElementById('pgLoad');
  var u=getUser();
  if(!u){window.location.href='login.html?redirect=profile.html';return;}
  if(pgL)pgL.style.display='none';
  updateNavUI();startPing();
  // Fill profile
  var pn=document.getElementById('profileName');if(pn)pn.textContent=u.name||u.gmail;
  var pe=document.getElementById('profileEmail');if(pe)pe.textContent=u.gmail;
  var pc=document.getElementById('profileCountry');if(pc)pc.textContent=u.country||'';
  renderProfileAvatar(u);
  // Set name/country in settings
  var sn=document.getElementById('setName');if(sn)sn.value=u.name||'';
  var sc=document.getElementById('setCountry');if(sc)sc.value=u.country||'';
  // Stats
  loadProfileStats(u);
  // Uploads
  api('getMovies',{isLoggedIn:true,uploaderGmail:u.gmail},function(r){
    if(r.ok){var grid=document.getElementById('uploadsGrid'),empty=document.getElementById('uploadsEmpty');if(!r.movies.length){if(empty)empty.classList.remove('hidden');}else{r.movies.forEach(function(m){if(grid)grid.appendChild(makeCard(m,'grid'));});}var ps=document.getElementById('pUploads');if(ps)ps.textContent=fmtNum(r.movies.length);}
  });
  // Liked
  api('getUserLikes',{gmail:u.gmail},function(r){
    if(r.ok){var grid=document.getElementById('likedGrid'),empty=document.getElementById('likedEmpty');if(!r.movies.length){if(empty)empty.classList.remove('hidden');}else{r.movies.forEach(function(m){if(grid)grid.appendChild(makeCard(m,'grid'));});}var ps=document.getElementById('pLikes');if(ps)ps.textContent=fmtNum(r.movies.length);}
  });
  // Playlist
  api('getPlaylist',{gmail:u.gmail},function(r){
    if(r.ok){var grid=document.getElementById('playlistGrid'),empty=document.getElementById('playlistEmpty');if(!r.movies.length){if(empty)empty.classList.remove('hidden');}else{r.movies.forEach(function(m){if(grid)grid.appendChild(makeCard(m,'grid'));});}
  }});
  // Check tab from URL
  var tab=getParam('tab');if(tab)showTab(tab);
}

function loadProfileStats(u){
  api('getFollowers',{gmail:u.gmail},function(r){var el=document.getElementById('pFollowers');if(el&&r.ok)el.textContent=fmtNum(r.count);});
  api('getFollowing',{gmail:u.gmail},function(r){var el=document.getElementById('pFollowing');if(el&&r.ok)el.textContent=fmtNum(r.count);});
}

function renderProfileAvatar(u){
  var av=document.getElementById('profileAvatar'),img=document.getElementById('profileAvatarImg'),init=document.getElementById('profileInitial');
  if(!av)return;
  var i=(u.name||u.gmail||'U')[0].toUpperCase();
  if(u.avatar){if(img){img.src=u.avatar;img.style.display='block';}if(init)init.style.display='none';}
  else{if(init)init.textContent=i;if(img)img.style.display='none';}
}

function showTab(tab){
  document.querySelectorAll('.ptab').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.tab-panel').forEach(function(p){p.classList.add('hidden');p.classList.remove('active');});
  var btn=document.getElementById('ptab-'+tab);if(btn)btn.classList.add('active');
  var panel=document.getElementById('panel-'+tab);if(panel){panel.classList.remove('hidden');panel.classList.add('active');}
}

function uploadAvatar(input){
  var u=getUser();if(!u)return;
  var file=input.files[0];if(!file)return;
  toastInfo('Uploading photo…');
  uploadToCloudinary(file,CDN_USER,null).then(function(res){
    api('updateUserProfile',{gmail:u.gmail,avatar:res.url},function(r){
      if(r.ok){
        u.avatar=res.url;setUser(r.user||u);
        renderProfileAvatar(r.user||u);updateNavUI();
        toastOK('Profile photo updated ✓');
      }else toastErr(r.msg);
    });
  }).catch(function(e){toastErr('Upload failed: '+e.message);});
}

function saveProfile(){
  var u=getUser();if(!u)return;
  var nm=document.getElementById('setName'),co=document.getElementById('setCountry');
  api('updateUserProfile',{gmail:u.gmail,name:nm?nm.value.trim():'',country:co?co.value:''},function(r){
    if(r.ok){setUser(r.user);toastOK('Profile saved ✓');var pn=document.getElementById('profileName');if(pn)pn.textContent=r.user.name||r.user.gmail;}
    else toastErr(r.msg);
  });
}

function changePassword(){
  var u=getUser();if(!u)return;
  var cp=document.getElementById('curPw'),np=document.getElementById('newPw'),np2=document.getElementById('newPw2'),er=document.getElementById('pwErr');
  if(!cp||!np||!np2)return;
  if(er)er.textContent='';
  if(!cp.value||!np.value){if(er)er.textContent='Fill all password fields.';return;}
  if(np.value!==np2.value){if(er)er.textContent='New passwords do not match.';return;}
  if(np.value.length<6){if(er)er.textContent='Password must be at least 6 characters.';return;}
  api('updateUserProfile',{gmail:u.gmail,password:cp.value,newPassword:np.value},function(r){
    if(r.ok){toastOK('Password updated ✓');cp.value='';np.value='';np2.value='';}
    else{if(er)er.textContent=r.msg;}
  });
}

// ── CHANNEL PAGE ─────────────────────────────────────────────
function initChannelPage(){
  var pgL=document.getElementById('pgLoad');
  var gmail=getParam('gmail'),handle=getParam('handle');
  if(!gmail&&!handle){window.location.href='../index.html';return;}
  var u=getUser();updateNavUI();
  api('getChannel',{gmail:gmail,handle:handle},function(r){
    if(pgL)pgL.style.display='none';
    if(!r.ok){toastErr(r.msg);setTimeout(function(){window.location.href='../index.html';},2000);return;}
    var ch=r.channel;window._currentChannel=ch;
    renderChannelPage(ch,u);
    // Videos
    api('getMovies',{isLoggedIn:!!u,uploaderGmail:ch.gmail},function(mr){
      if(mr.ok){
        var grid=document.getElementById('channelVideosGrid'),empty=document.getElementById('channelVideosEmpty');
        var vc=document.getElementById('channelVideoCount');if(vc)vc.textContent=fmtNum(mr.movies.length)+' videos';
        var avc=document.getElementById('aboutVideos');if(avc)avc.textContent=fmtNum(mr.movies.length);
        if(!mr.movies.length){if(empty)empty.classList.remove('hidden');}
        else{window._channelVideos=mr.movies;mr.movies.forEach(function(m){if(grid)grid.appendChild(makeCard(m,'grid'));});}
      }
    });
    // Views
    api('getChannelStats',{gmail:ch.gmail},function(sr){
      if(sr.ok){var cv=document.getElementById('channelViews');if(cv)cv.textContent=fmtNum(sr.stats.totalViews)+' views';var av=document.getElementById('aboutViews');if(av)av.textContent=fmtNum(sr.stats.totalViews);}
    });
    // Follow status
    api('getFollowers',{channelGmail:ch.gmail,viewerGmail:u?u.gmail:''},function(fr){
      if(fr.ok){
        var fb=document.getElementById('followBtn'),ft=document.getElementById('followBtnText');
        if(fb&&fr.isFollowing){fb.classList.add('following');}
        if(ft)ft.textContent=fr.isFollowing?'✓ Following':'Follow';
        window._isFollowing=fr.isFollowing;
      }
    });
    if(u)startPing();
  });
}

function renderChannelPage(ch,u){
  // Banner
  var bi=document.getElementById('channelBannerImg');
  if(bi&&ch.banner){bi.style.backgroundImage='url('+ch.banner+')';bi.style.backgroundSize='cover';bi.style.backgroundPosition='center';}
  // Avatar
  var cav=document.getElementById('channelAvatar'),ci=document.getElementById('channelInitial'),cai=document.getElementById('channelAvatarImg');
  var init=(ch.name||ch.gmail||'?')[0].toUpperCase();
  if(ch.avatar&&cai){cai.src=ch.avatar;cai.style.display='block';if(ci)ci.style.display='none';}
  else if(ci){ci.textContent=init;}
  // Name, handle, bio
  var cn=document.getElementById('channelName');if(cn)cn.textContent=ch.name||ch.gmail;
  var ch2=document.getElementById('channelHeaderName');if(ch2)ch2.textContent=ch.name||'Channel';
  var chh=document.getElementById('channelHandle');if(chh)chh.textContent=ch.handle||'';
  var cf=document.getElementById('channelFollowers');if(cf)cf.textContent=fmtNum(ch.followerCount||0)+' followers';
  var cbio=document.getElementById('channelBio');if(cbio)cbio.textContent=ch.bio||'';
  var ab=document.getElementById('aboutBio');if(ab)ab.textContent=ch.bio||'No bio yet.';
  var af=document.getElementById('aboutFollowers');if(af)af.textContent=fmtNum(ch.followerCount||0);
  var aj=document.getElementById('aboutJoined');if(aj)aj.textContent=fmtDateFull(ch.created||'');
  document.title=(ch.name||'Channel')+' · KEYTUBE';
  // Social links
  if(ch.socialLinks){try{var sl=JSON.parse(ch.socialLinks);var links=['facebook','twitter','instagram','youtube'];var html='';links.forEach(function(l){if(sl[l])html+='<a class="ch-social-link" href="'+h(sl[l])+'" target="_blank" rel="noopener">'+cap(l)+'</a>';});var csl=document.getElementById('channelSocial');if(csl)csl.innerHTML=html;var asl=document.getElementById('aboutSocial');if(asl)asl.innerHTML=html;}catch(e){}}
  // Own channel — show edit button
  if(u&&u.gmail===ch.gmail){var fb=document.getElementById('followBtn');if(fb){fb.textContent='✏️ Edit Channel';fb.onclick=function(){window.location.href='../pages/studio.html';};}}
}

function toggleFollow(){
  var ch=window._currentChannel;if(!ch)return;
  var u=getUser();if(!u){showLoginReq();return;}
  if(u.gmail===ch.gmail){window.location.href='../pages/studio.html';return;}
  var following=window._isFollowing;
  var action=following?'unfollowChannel':'followChannel';
  api(action,{gmail:u.gmail,channelGmail:ch.gmail},function(r){
    if(r.ok){
      window._isFollowing=!following;
      var fb=document.getElementById('followBtn'),ft=document.getElementById('followBtnText');
      if(fb)fb.classList.toggle('following',!following);
      if(ft)ft.textContent=following?'Follow':'✓ Following';
      var cf=document.getElementById('channelFollowers');if(cf&&r.followerCount!==undefined)cf.textContent=fmtNum(r.followerCount)+' followers';
      toastOK(following?'Unfollowed':'Following ✓');
    }else toastErr(r.msg);
  });
}

function showChTab(tab){
  document.querySelectorAll('.chtab').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.ch-panel').forEach(function(p){p.classList.remove('active');});
  var btn=document.getElementById('chtab-'+tab);if(btn)btn.classList.add('active');
  var panel=document.getElementById('chpanel-'+tab);if(panel)panel.classList.add('active');
}

function sortChannelVideos(by){
  var v=window._channelVideos;if(!v)return;
  var sorted=v.slice().sort(function(a,b){
    if(by==='popular')return(parseFloat(b.rating)||0)-(parseFloat(a.rating)||0);
    if(by==='oldest')return new Date(a.added||0)-new Date(b.added||0);
    return new Date(b.added||0)-new Date(a.added||0);
  });
  var grid=document.getElementById('channelVideosGrid');if(grid){grid.innerHTML='';sorted.forEach(function(m){grid.appendChild(makeCard(m,'grid'));});}
}
function shareChannel(){var ch=window._currentChannel;if(navigator.share&&ch){navigator.share({title:ch.name||'KEYTUBE Channel',url:window.location.href}).catch(function(){});}else{navigator.clipboard&&navigator.clipboard.writeText(window.location.href).then(function(){toastOK('Link copied!');});}}

// ── WALLET PAGE ───────────────────────────────────────────────
function initWalletPage(){
  var pgL=document.getElementById('pgLoad');
  var u=getUser();
  if(!u){if(pgL)pgL.style.display='none';var lr=document.getElementById('loginReq');if(lr)lr.classList.add('show');return;}
  if(pgL)pgL.style.display='none';
  updateNavUI();startPing();
  // Earnings
  api('getEarnings',{gmail:u.gmail},function(r){
    if(r.ok){
      var wb=document.getElementById('walletBalance');if(wb)wb.textContent=r.total.toFixed(2);
      var wp=document.getElementById('walletPending');if(wp)wp.textContent='$'+r.pending.toFixed(2)+' pending';
      var wr=document.getElementById('wTotalEarned');if(wr)wr.textContent='$'+r.total.toFixed(2);
      var ww=document.getElementById('wTotalWithdrawn');if(ww){var wd=r.earnings.filter(function(e){return e.type==='withdrawal';}).reduce(function(s,e){return s+e.amount;},0);ww.textContent='$'+wd.toFixed(2);}
      var wm=document.getElementById('wThisMonth');if(wm){var now=new Date(),mo=r.earnings.filter(function(e){var d=new Date(e.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()&&e.status==='paid';}).reduce(function(s,e){return s+e.amount;},0);wm.textContent='$'+mo.toFixed(2);}
      // Transactions
      var tl=document.getElementById('transactionsList'),te=document.getElementById('txEmpty');
      if(!r.earnings.length){if(te)te.classList.remove('hidden');}
      else if(tl){r.earnings.slice().reverse().forEach(function(e){tl.appendChild(makeTxItem(e));});}
    }
  });
  // Monetize status
  api('getFollowers',{gmail:u.gmail},function(fr){
    if(!fr.ok)return;
    var count=fr.count;var threshold=1000;
    var pct=Math.min(count/threshold*100,100);
    var mc=document.getElementById('mscBar');if(mc)mc.style.width=pct+'%';
    var mt=document.getElementById('mscTitle');if(mt)mt.textContent=count>=threshold?'✅ Monetization Unlocked!':'🔒 Monetization Locked';
    var md=document.getElementById('mscDesc');if(md)md.textContent=count>=threshold?'Your channel is monetized. Earnings will appear here.':'Reach '+threshold.toLocaleString()+' followers to start earning. ('+count.toLocaleString()+'/'+threshold.toLocaleString()+')';
    var mi=document.getElementById('mscIcon');if(mi)mi.textContent=count>=threshold?'💰':'🔒';
    var mcu=document.getElementById('mscCurrent');if(mcu)mcu.textContent=count.toLocaleString()+' followers';
  });
}

function makeTxItem(e){
  var d=document.createElement('div');d.className='tx-item';
  var icons={earning:'💰',withdrawal:'💸',bonus:'⭐',refund:'↩️'};
  var icon=icons[e.type]||'💰';var credit=e.type!=='withdrawal';
  d.innerHTML='<div class="tx-icon">'+icon+'</div><div class="tx-info"><div class="tx-title">'+cap(e.type||'earning')+'<span style="font-size:.7rem;color:var(--t2);margin-left:6px">'+(e.description||'')+'</span></div><div class="tx-date">'+fmtDate(e.date)+'</div></div><div class="tx-amount '+(credit?'tx-credit':'tx-debit')+'">'+(credit?'+':'-')+'$'+Math.abs(e.amount).toFixed(2)+'</div>';
  return d;
}

function showWalletTab(tab){
  document.querySelectorAll('.wtab').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.wallet-tab-panel').forEach(function(p){p.classList.remove('active');});
  var btn=document.getElementById('wtab-'+tab);if(btn)btn.classList.add('active');
  var panel=document.getElementById('wpanel-'+tab);if(panel)panel.classList.add('active');
}

function showWithdraw(){
  var wm=document.getElementById('withdrawModal');if(wm)wm.classList.remove('hidden');
}
function closeWithdraw(){var wm=document.getElementById('withdrawModal');if(wm)wm.classList.add('hidden');}
function showAddMoney(){toastInfo('Contact support to add funds to your wallet.');}
function filterTransactions(v){var tl=document.getElementById('transactionsList');if(!tl)return;}
function savePayoutSettings(){toastOK('Payout settings saved ✓');}
function submitWithdrawal(){
  var amt=document.getElementById('wdAmount'),meth=document.getElementById('wdMethod'),er=document.getElementById('wdErr');
  if(!amt||!meth)return;
  if(!amt.value||parseFloat(amt.value)<5){if(er)er.textContent='Minimum withdrawal is $5.00';return;}
  if(!meth.value){if(er)er.textContent='Select a payment method';return;}
  toastOK('Withdrawal request submitted ✓');closeWithdraw();
}
