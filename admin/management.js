// ── adminpaymentmanagement.js ────────────────────────────────
var API='https://script.google.com/macros/s/AKfycbxbYUKZYwYRssm80AnP8kDj-8_ymsaFczKmecbchEntyhhr5-zqAIDYov-Nt7Ko0pDOMA/exec';
var TOKEN='';
var _allChannels=[];
var _channelFilter='all';

// ── HELPERS ──────────────────────────────────────────────────
function h(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function fmtMoney(n){return'$'+(parseFloat(n||0)).toFixed(2);}
function fmtNum(n){n=parseInt(n||0);if(n>=1000000)return(n/1000000).toFixed(1)+'M';if(n>=1000)return(n/1000).toFixed(1)+'K';return String(n);}
function fmtDate(d){var dt=new Date(d);return isNaN(dt)?d||'':dt.toLocaleDateString();}

function toast(msg,type){
  var t=document.getElementById('toast');
  t.textContent=msg;t.className='show'+(type?' '+type:'');
  clearTimeout(t._t);t._t=setTimeout(function(){t.className='';},3200);
}

var pW=0,pT;
function pStart(){pW=0;var e=document.getElementById('pbar');e.className='';e.style.width='0%';clearInterval(pT);pT=setInterval(function(){pW=Math.min(pW+Math.random()*8,88);e.style.width=pW+'%';},120);}
function pDone(){clearInterval(pT);var e=document.getElementById('pbar');e.style.width='100%';setTimeout(function(){e.className='done';setTimeout(function(){e.style.width='0%';e.className='';},500);},280);}

function api(action,data,cb){
  pStart();
  fetch(API,{method:'POST',headers:{'Content-Type':'text/plain'},
    body:JSON.stringify(Object.assign({},data||{},{action:action})),redirect:'follow'})
  .then(function(r){return r.json();})
  .then(function(res){pDone();if(cb)cb(res);})
  .catch(function(e){pDone();toast('Connection error','terr');console.error(e);});
}

// ── INIT ─────────────────────────────────────────────────────
window.onload=function(){
  TOKEN=sessionStorage.getItem('kt_a')||'';
  if(!TOKEN){
    toast('Not logged in as admin','terr');
    setTimeout(function(){window.location.href='admin.html';},1500);
    return;
  }
  loadRates();
  loadOverview();
  loadChannels();
  loadEarningsLog();
};

// ── LOAD RATES ───────────────────────────────────────────────
function loadRates(){
  api('getEarningRates',{},function(r){
    if(!r.ok){toast(r.msg||'Error loading rates','terr');return;}
    var rt=r.rates;
    document.getElementById('rateView').value    = rt.rate_per_view;
    document.getElementById('rateLike').value    = rt.rate_per_like;
    document.getElementById('rateComment').value = rt.rate_per_comment;
    document.getElementById('rateFollower').value= rt.rate_per_follower;
    document.getElementById('thresholdInput').value = rt.monetize_threshold;
    document.getElementById('minPayoutInput').value = rt.min_payout;
    document.getElementById('currencyInput').value  = rt.payout_currency||'USD';
    document.getElementById('threshLabel').textContent = fmtNum(rt.monetize_threshold)+'+';
    updatePreviews(rt);
  });
  // Live previews on input change
  ['rateView','rateLike','rateComment','rateFollower'].forEach(function(id){
    document.getElementById(id).addEventListener('input',function(){
      updatePreviews(getCurrentRates());
    });
  });
}

function getCurrentRates(){
  return {
    rate_per_view:     parseFloat(document.getElementById('rateView').value)||0,
    rate_per_like:     parseFloat(document.getElementById('rateLike').value)||0,
    rate_per_comment:  parseFloat(document.getElementById('rateComment').value)||0,
    rate_per_follower: parseFloat(document.getElementById('rateFollower').value)||0
  };
}

function updatePreviews(rt){
  var p=function(rate){return fmtMoney(1000*rate);};
  document.getElementById('previewView').textContent    = '1,000 views = '    +p(rt.rate_per_view);
  document.getElementById('previewLike').textContent    = '1,000 likes = '    +p(rt.rate_per_like);
  document.getElementById('previewComment').textContent = '1,000 comments = ' +p(rt.rate_per_comment);
  document.getElementById('previewFollower').textContent= '1,000 followers = ' +p(rt.rate_per_follower);
}

// ── SAVE RATES ───────────────────────────────────────────────
function saveRates(){
  var data={
    token:TOKEN,
    rate_per_view:     document.getElementById('rateView').value,
    rate_per_like:     document.getElementById('rateLike').value,
    rate_per_comment:  document.getElementById('rateComment').value,
    rate_per_follower: document.getElementById('rateFollower').value,
    monetize_threshold:document.getElementById('thresholdInput').value,
    min_payout:        document.getElementById('minPayoutInput').value,
    payout_currency:   document.getElementById('currencyInput').value
  };
  api('updateEarningRates',data,function(r){
    if(r.ok){
      toast('Rates saved! ✓','tok');
      document.getElementById('threshLabel').textContent=fmtNum(data.monetize_threshold)+'+';
    } else toast(r.msg||'Error saving','terr');
  });
}

// ── OVERVIEW STATS ───────────────────────────────────────────
function loadOverview(){
  api('getPaymentOverview',{token:TOKEN},function(r){
    if(!r.ok){toast(r.msg,'terr');return;}
    var o=r.overview;
    document.getElementById('statPaid').textContent     = fmtMoney(o.totalPaid);
    document.getElementById('statPending').textContent  = fmtMoney(o.totalPending);
    document.getElementById('statWithdrawn').textContent= fmtMoney(o.totalWithdrawn);
    document.getElementById('statMono').textContent     = o.monetizedChannels+' / '+o.totalChannels;
    document.getElementById('statViewRev').textContent  = fmtMoney(o.byType.view_revenue||0);
    document.getElementById('statLikeRev').textContent  = fmtMoney(o.byType.like_revenue||0);
    document.getElementById('statCmtRev').textContent   = fmtMoney(o.byType.comment_revenue||0);
    document.getElementById('statFolRev').textContent   = fmtMoney(o.byType.follower_bonus||0);
  });
}

// ── PROCESS ALL EARNINGS ─────────────────────────────────────
function processAll(){
  var btn=document.getElementById('processAllBtn');
  btn.disabled=true;
  btn.innerHTML='<span class="spin"></span> Processing…';
  api('processAllEarnings',{token:TOKEN},function(r){
    btn.disabled=false;
    btn.innerHTML='⚡ Process All Monetized Channels';
    if(r.ok){
      toast('Processed! '+fmtMoney(r.grandTotal)+' credited ✓','tok');
      var pr=document.getElementById('processResult');
      pr.classList.add('show');
      document.getElementById('prChannels').textContent = r.results?r.results.length:0;
      document.getElementById('prTotal').textContent    = fmtMoney(r.grandTotal||0);
      document.getElementById('prStatus').textContent   = r.msg||'Done';
      loadOverview();
      loadEarningsLog();
      loadChannels();
    } else toast(r.msg||'Error','terr');
  });
}

// ── CHANNELS TABLE ───────────────────────────────────────────
function loadChannels(){
  // Get channels via getStats which returns channel count
  // We need getUsers + getFollowers to build the table
  api('getUsers',{token:TOKEN},function(ur){
    api('getAllEarnings',{token:TOKEN},function(er){
      api('getEarningRates',{},function(rr){
        var threshold=rr.ok?rr.rates.monetize_threshold:1000;
        // Build earnings map per gmail
        var earnMap={};
        if(er.ok)(er.earnings||[]).forEach(function(e){
          if(e.type!=='withdrawal'){
            if(!earnMap[e.gmail])earnMap[e.gmail]=0;
            earnMap[e.gmail]+=parseFloat(e.amount||0);
          }
        });
        // We'll load channel data from getMyChannel for each user
        // But to avoid too many calls, we use a simpler approach:
        // getMovies returns uploaderGmail - use that to identify creators
        api('getMovies',{isLoggedIn:true,category:'all',type:'all'},function(mr){
          var creatorSet={};
          if(mr.ok)(mr.movies||[]).forEach(function(m){if(m.uploaderGmail)creatorSet[m.uploaderGmail]=true;});

          // Now fetch channels
          fetchAllChannels(threshold,earnMap);
        });
      });
    });
  });
}

function fetchAllChannels(threshold,earnMap){
  // Use getUsers + getFollowers approach via stats
  api('getStats',{token:TOKEN},function(sr){
    // Load channel list via a creative approach — search all channels
    api('searchChannels',{query:' '},function(r){
      // This won't work well, so we use a dedicated channel listing
      // Fall back to getting channels from earnings data
      api('getAllEarnings',{token:TOKEN},function(er){
        var gmails={};
        if(er.ok)(er.earnings||[]).forEach(function(e){gmails[e.gmail]=true;});

        _allChannels=Object.keys(gmails).map(function(gmail){
          var earned=0;
          if(er.ok)(er.earnings||[]).filter(function(e){return e.gmail===gmail&&e.type!=='withdrawal';}).forEach(function(e){earned+=parseFloat(e.amount||0);});
          return {gmail:gmail,earned:Math.round(earned*100)/100};
        });
        renderChannelsTable(threshold);
      });
    });
  });
}

function renderChannelsTable(threshold){
  var tbody=document.getElementById('channelsTable');
  var empty=document.getElementById('channelsEmpty');
  var sub=document.getElementById('channelSubTitle');
  tbody.innerHTML='';

  var list=_allChannels;
  if(_channelFilter==='monetized') list=list.filter(function(c){return (c.followerCount||0)>=threshold;});
  if(_channelFilter==='pending')   list=list.filter(function(c){return (c.followerCount||0)<threshold;});

  if(sub)sub.textContent='('+list.length+')';

  if(!list.length){empty.style.display='block';return;}
  empty.style.display='none';

  list.forEach(function(ch){
    var isMono=(ch.followerCount||0)>=threshold;
    var init=(ch.name||ch.gmail||'?')[0].toUpperCase();
    var colors=['#e53935','#d81b60','#8e24aa','#1e88e5','#00897b','#43a047','#f4511e'];
    var seed=(ch.gmail||'').split('').reduce(function(a,c){return a*31+c.charCodeAt(0);},0);
    var color=colors[Math.abs(seed)%colors.length];

    var avHTML=ch.avatar
      ?'<div class="ch-av"><img src="'+h(ch.avatar)+'" onerror="this.parentNode.textContent=\''+init+'\'"></div>'
      :'<div class="ch-av" style="background:'+color+'">'+init+'</div>';

    var tr=document.createElement('tr');
    tr.innerHTML=
      '<td>'+
        '<div class="ch-name-cell">'+
          avHTML+
          '<div>'+
            '<div class="ch-name">'+h(ch.name||ch.gmail)+'</div>'+
            '<div class="ch-handle">'+h(ch.handle||ch.gmail)+'</div>'+
          '</div>'+
        '</div>'+
      '</td>'+
      '<td>'+fmtNum(ch.followerCount||0)+'</td>'+
      '<td><span class="'+(isMono?'badge-mono':'badge-lock')+'">'+(isMono?'✅ Monetized':'🔒 Locked')+'</span></td>'+
      '<td><span class="earn-amt">'+fmtMoney(ch.earned||0)+'</span></td>'+
      '<td>'+
        (isMono
          ?'<button class="pm-btn pm-btn-gold" style="font-size:.72rem;padding:4px 10px" onclick="processOne(\''+h(ch.gmail)+'\',this)">⚡ Calculate</button>'
          :'<span style="font-size:.73rem;color:var(--t3)">Needs '+fmtNum(threshold)+' followers</span>'
        )+
      '</td>';
    tbody.appendChild(tr);
  });
}

function filterChannels(filter,btn){
  _channelFilter=filter;
  document.querySelectorAll('.pm-btn-out').forEach(function(b){b.style.background='var(--w)';b.style.color='var(--txt)';});
  if(btn){btn.style.background='var(--txt)';btn.style.color='var(--w)';}
  api('getEarningRates',{},function(r){
    renderChannelsTable(r.ok?r.rates.monetize_threshold:1000);
  });
}

// Process earnings for a single channel
function processOne(gmail,btn){
  btn.disabled=true;btn.textContent='Processing…';
  api('calculateUserEarnings',{token:TOKEN,gmail:gmail},function(r){
    btn.disabled=false;
    if(r.ok){
      btn.textContent='✅ Done';
      btn.style.background='var(--green)';
      toast('Earnings calculated: '+fmtMoney(r.total||0),'tok');
      loadOverview();
      loadEarningsLog();
      setTimeout(function(){btn.textContent='⚡ Calculate';btn.style.background='var(--gold)';},3000);
    } else {
      btn.textContent='⚡ Calculate';
      toast(r.msg||'Error','terr');
    }
  });
}

// ── EARNINGS LOG ─────────────────────────────────────────────
function loadEarningsLog(){
  api('getAllEarnings',{token:TOKEN},function(r){
    var log=document.getElementById('earningsLog');
    var empty=document.getElementById('earningsLogEmpty');
    var cnt=document.getElementById('logCount');
    if(!r.ok||!r.earnings.length){
      log.innerHTML='';empty.style.display='block';
      if(cnt)cnt.textContent='';return;
    }
    empty.style.display='none';
    if(cnt)cnt.textContent='('+r.earnings.length+')';
    log.innerHTML='';
    var typeInfo={
      view_revenue:    {icon:'👁', cls:'view',     label:'View Revenue'},
      like_revenue:    {icon:'❤️', cls:'like',     label:'Like Revenue'},
      comment_revenue: {icon:'💬', cls:'comment',  label:'Comment Revenue'},
      follower_bonus:  {icon:'👥', cls:'follower', label:'Follower Bonus'},
      withdrawal:      {icon:'💸', cls:'withdrawal',label:'Withdrawal'}
    };
    r.earnings.slice(0,100).forEach(function(e){
      var info=typeInfo[e.type]||{icon:'💰',cls:'view',label:e.type};
      var isDebit=e.type==='withdrawal';
      var d=document.createElement('div');
      d.className='earn-log-item';
      d.innerHTML=
        '<div class="eli-icon '+info.cls+'">'+info.icon+'</div>'+
        '<div class="eli-info">'+
          '<div class="eli-gmail">'+h(e.gmail)+'</div>'+
          '<div class="eli-desc">'+info.label+(e.description?' — '+h(e.description):'')+'</div>'+
          '<div class="eli-date">'+fmtDate(e.date)+'</div>'+
        '</div>'+
        '<div class="eli-amt'+(isDebit?' debit':'')+'">'+
          (isDebit?'-':'+')+'$'+Math.abs(parseFloat(e.amount||0)).toFixed(4)+
        '</div>';
      log.appendChild(d);
    });
  });
}