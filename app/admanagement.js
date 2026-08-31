// ── admanagement.js ──────────────────────────────────────────
var API='https://script.google.com/macros/s/AKfycbwsM0DUa_ndCzMtqrkxnAxZYwhMUXF5_iXz9xKAYTx-8MWBQf4vqGU4f8uGBIqu8_5o/exec';
var TOKEN='';
var _allAds=[];
var _curTab='pending';
var _typeFilter='all';
var _selPlacement='top';

// ── HELPERS ───────────────────────────────────────────────────
function h(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function cap(s){return s?String(s)[0].toUpperCase()+String(s).slice(1):'';}
function fmtDate(d){var dt=new Date(d);return isNaN(dt)?d||'':dt.toLocaleDateString();}
function fmtNum(n){n=parseInt(n||0);if(n>=1000)return(n/1000).toFixed(1)+'K';return String(n);}
function setText(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}

function toast(msg,type){var t=document.getElementById('toast');t.textContent=msg;t.className='show'+(type?' '+type:'');clearTimeout(t._t);t._t=setTimeout(function(){t.className='';},3200);}
var pW=0,pT;
function pStart(){pW=0;var e=document.getElementById('pbar');e.className='';e.style.width='0%';clearInterval(pT);pT=setInterval(function(){pW=Math.min(pW+Math.random()*8,88);e.style.width=pW+'%';},120);}
function pDone(){clearInterval(pT);var e=document.getElementById('pbar');e.style.width='100%';setTimeout(function(){e.className='done';setTimeout(function(){e.style.width='0%';e.className='';},500);},280);}

function api(action,data,cb){
  pStart();
  fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(Object.assign({},data||{},{action:action})),redirect:'follow'})
  .then(function(r){return r.text().then(function(raw){
    try{return JSON.parse(raw);}catch(e){console.error('Raw:',raw);throw new Error('Invalid JSON from server');}
  });})
  .then(function(res){pDone();if(cb)cb(res);})
  .catch(function(e){pDone();toast(e.message||'Connection error','terr');console.error(e);});
}

// ── INIT ──────────────────────────────────────────────────────
window.onload=function(){
  TOKEN=sessionStorage.getItem('kt_a')||'';
  if(!TOKEN){window.location.href='admin.html';return;}
  loadAds();
};

// ── LOAD ALL ADS ──────────────────────────────────────────────
function loadAds(){
  api('getAdRequests',{token:TOKEN},function(r){
    if(!r.ok){toast(r.msg,'terr');return;}
    _allAds=r.ads||[];
    var c=r.counts||{};
    setText('stPending',c.pending||0);
    setText('stActive',c.active||0);
    setText('stApproved',c.approved||0);
    setText('stTotal',_allAds.length);
    var top=_allAds.filter(function(a){return a.placement==='top'&&(a.status==='active'||a.status==='approved');}).length;
    var mid=_allAds.filter(function(a){return a.placement==='center'&&(a.status==='active'||a.status==='approved');}).length;
    var bot=_allAds.filter(function(a){return a.placement==='bottom'&&(a.status==='active'||a.status==='approved');}).length;
    setText('stTopCount',top);setText('stMidCount',mid);setText('stBotCount',bot);
    var badge=document.getElementById('pendingBadge');
    if(badge){if(c.pending>0){badge.style.display='inline';badge.textContent=c.pending;}else badge.style.display='none';}
    renderAds();
  });
}

// ── TABS & FILTERS ────────────────────────────────────────────
function switchTab(tab){
  _curTab=tab;
  document.querySelectorAll('.adm-tab').forEach(function(b){b.classList.remove('active');});
  var btn=document.getElementById('tab-'+tab);if(btn)btn.classList.add('active');
  renderAds();
}

function filterAds(q){renderAds(q);}

function filterType(type,btn){
  _typeFilter=type;
  document.querySelectorAll('.adm-filter-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  renderAds();
}

// ── RENDER ADS LIST ───────────────────────────────────────────
function renderAds(searchQ){
  var q=(searchQ||document.getElementById('adSearch').value||'').toLowerCase();
  var list=_allAds;
  if(_curTab!=='all')list=list.filter(function(a){return a.status===_curTab;});
  if(_typeFilter!=='all')list=list.filter(function(a){return a.adType===_typeFilter;});
  if(q)list=list.filter(function(a){
    return (a.adTitle||'').toLowerCase().indexOf(q)!==-1||
           (a.businessName||'').toLowerCase().indexOf(q)!==-1||
           (a.email||'').toLowerCase().indexOf(q)!==-1;
  });
  var el=document.getElementById('adsList'),empty=document.getElementById('adsEmpty');
  el.innerHTML='';
  if(!list.length){
    empty.classList.remove('hidden');
    document.getElementById('adsEmptyMsg').textContent='No '+(_curTab==='all'?'':_curTab+' ')+'ad requests found.';
    return;
  }
  empty.classList.add('hidden');
  list.forEach(function(ad){el.appendChild(makeAdCard(ad));});
}

function makeAdCard(ad){
  var d=document.createElement('div');
  d.className='ad-card';
  var typeLabels={banner:'🖼 Banner',video:'🎬 Video',text:'📝 Text',sponsored:'⭐ Sponsored'};
  var typeClass={banner:'type-banner',video:'type-video',text:'type-text',sponsored:'type-sponsored'};
  var stClass={pending:'st-pending',approved:'st-approved',active:'st-active',rejected:'st-rejected',expired:'st-expired'};
  var stLabel={pending:'⏳ Pending',approved:'👍 Approved',active:'✅ Active',rejected:'❌ Rejected',expired:'⌛ Expired'};

  var imgHTML=ad.adImageURL
    ?'<div class="ad-card-img"><img src="'+h(ad.adImageURL)+'" alt="" loading="lazy" onerror="this.parentNode.innerHTML=\'<span style=font-size:1.5rem>🖼</span>\'"></div>'
    :'<div class="ad-card-img"><span>'+(typeLabels[ad.adType]||'📢').split(' ')[0]+'</span></div>';

  var plcBadge=ad.placement?'<span style="background:rgba(6,95,212,.1);color:var(--blue);padding:2px 7px;border-radius:3px;font-size:.67rem;font-weight:700;margin-left:5px">📌 '+cap(ad.placement)+'</span>':'';

  d.innerHTML=
    '<div class="ad-card-hd">'+
      imgHTML+
      '<div class="ad-card-info">'+
        '<div class="ad-card-title">'+h(ad.adTitle||'Untitled Ad')+'</div>'+
        '<div class="ad-card-biz">🏢 '+h(ad.businessName)+' · 📧 '+h(ad.email)+'</div>'+
        '<div class="ad-card-meta">'+
          '<span class="type-badge '+typeClass[ad.adType]+'">'+typeLabels[ad.adType]+'</span>'+
          '<span class="st-badge '+stClass[ad.status]+'">'+stLabel[ad.status]+'</span>'+
          plcBadge+
          (ad.budget?'<span>💰 '+h(ad.budget)+' '+h(ad.currency)+'</span>':'')+
          '<span>📅 '+fmtDate(ad.submittedDate)+'</span>'+
          (ad.viewCount?'<span>👁 '+fmtNum(ad.viewCount)+'</span>':'')+
          (ad.clickCount?'<span>🖱 '+fmtNum(ad.clickCount)+'</span>':'')+
        '</div>'+
        '<div class="ad-card-desc">'+h(ad.adDescription||'')+'</div>'+
        '<div class="ad-card-actions">'+
          (ad.status==='pending'?
            '<button class="acb acb-green" onclick="openApprove(\''+ad.id+'\')">✅ Approve</button>'+
            '<button class="acb acb-red" onclick="openReject(\''+ad.id+'\')">❌ Reject</button>':'')+
          (ad.status==='approved'?
            '<button class="acb acb-blue" onclick="goLive(\''+ad.id+'\')">🟢 Go Live</button>'+
            '<button class="acb acb-red" onclick="openReject(\''+ad.id+'\')">❌ Reject</button>':'')+
          (ad.status==='active'?
            '<button class="acb acb-grey" onclick="pauseAd(\''+ad.id+'\')">⏸ Pause</button>':'')+
          (ad.status==='rejected'?
            '<button class="acb acb-green" onclick="openApprove(\''+ad.id+'\')">↺ Re-approve</button>':'')+
          '<button class="acb acb-gold" onclick="viewDetail(\''+ad.id+'\')">🔍 Details</button>'+
          (ad.adLinkURL?'<a class="acb acb-blue" href="'+h(ad.adLinkURL)+'" target="_blank" rel="noopener">🔗 Visit</a>':'')+
        '</div>'+
      '</div>'+
    '</div>';
  return d;
}

// ── APPROVE ───────────────────────────────────────────────────
function openApprove(id){
  var ad=_allAds.find(function(a){return a.id===id;});if(!ad)return;
  document.getElementById('approveAdId').value=id;
  document.getElementById('approveAdTitle').textContent=ad.adTitle;
  document.getElementById('approveAdBiz').textContent=ad.businessName+' · '+ad.email;
  document.getElementById('approveNote').value='';
  document.getElementById('approvedPrice').value=ad.approvedPrice||ad.budget||'';
  document.getElementById('approveStatus').value='active';
  setPlacement(ad.placement||'top',document.getElementById('plc-'+(ad.placement||'top')));
  document.getElementById('approveModal').classList.add('open');
}

function setPlacement(plc,btn){
  _selPlacement=plc;
  document.querySelectorAll('.plc-btn').forEach(function(b){b.classList.remove('sel');});
  if(btn)btn.classList.add('sel');
}

function confirmApprove(){
  var id=document.getElementById('approveAdId').value;
  var note=document.getElementById('approveNote').value.trim();
  var price=document.getElementById('approvedPrice').value.trim();
  var status=document.getElementById('approveStatus').value;
  api('reviewAdRequest',{token:TOKEN,id:id,status:status,placement:_selPlacement,adminNotes:note,approvedPrice:price},function(r){
    if(r.ok){
      toast('Ad '+status+'! Email sent to advertiser ✓','tok');
      closeModal('approveModal');
      api('getAdRequests',{token:TOKEN},function(r2){
        if(r2.ok){_allAds=r2.ads||[];renderAds();}
        if(status==='active')autoGenerateAds();
      });
    } else toast(r.msg,'terr');
  });
}

// ── REJECT ────────────────────────────────────────────────────
function openReject(id){
  var ad=_allAds.find(function(a){return a.id===id;});if(!ad)return;
  document.getElementById('rejectAdId').value=id;
  document.getElementById('rejectAdTitle').textContent=ad.adTitle;
  document.getElementById('rejectAdBiz').textContent=ad.businessName+' · '+ad.email;
  document.getElementById('rejectReason').value='';
  document.getElementById('rejectModal').classList.add('open');
}

function confirmReject(){
  var id=document.getElementById('rejectAdId').value;
  var reason=document.getElementById('rejectReason').value.trim();
  if(!reason){toast('Enter a reason for rejection','terr');return;}
  api('reviewAdRequest',{token:TOKEN,id:id,status:'rejected',adminNotes:reason},function(r){
    if(r.ok){
      toast('Ad rejected. Advertiser notified ✓','tok');
      closeModal('rejectModal');
      api('getAdRequests',{token:TOKEN},function(r2){if(r2.ok){_allAds=r2.ads||[];renderAds();}});
      autoGenerateAds();
    } else toast(r.msg,'terr');
  });
}

// ── GO LIVE / PAUSE ───────────────────────────────────────────
function goLive(id){
  api('reviewAdRequest',{token:TOKEN,id:id,status:'active'},function(r){
    if(r.ok){
      toast('Ad is now live! ✓','tok');
      api('getAdRequests',{token:TOKEN},function(r2){
        if(r2.ok){_allAds=r2.ads||[];renderAds();}
        autoGenerateAds();
      });
    } else toast(r.msg,'terr');
  });
}

function pauseAd(id){
  if(!confirm('Pause this ad? It will be removed from the site.'))return;
  api('reviewAdRequest',{token:TOKEN,id:id,status:'approved'},function(r){
    if(r.ok){
      toast('Ad paused and removed from site','tok');
      api('getAdRequests',{token:TOKEN},function(r2){
        if(r2.ok){_allAds=r2.ads||[];renderAds();}
        autoGenerateAds();
      });
    } else toast(r.msg,'terr');
  });
}

// ── DETAIL VIEW ───────────────────────────────────────────────
function viewDetail(id){
  var ad=_allAds.find(function(a){return a.id===id;});if(!ad)return;
  var typeLabel={banner:'🖼 Banner',video:'🎬 Video',text:'📝 Text',sponsored:'⭐ Sponsored'};
  var rows=[
    ['Business',ad.businessName],['Contact',ad.contactName],['Email',ad.email],
    ['Phone',ad.phone||'—'],['Website',ad.website||'—'],
    ['Ad Type',typeLabel[ad.adType]||ad.adType],['Title',ad.adTitle],
    ['Category',ad.targetCategory],['Budget',ad.budget+' '+ad.currency],
    ['Placement',ad.placement||'Not set'],['Status',ad.status],
    ['Price',ad.approvedPrice||'Not set'],['Start',ad.startDate||'Open'],
    ['End',ad.endDate||'Open'],['Submitted',fmtDate(ad.submittedDate)],
    ['Views',fmtNum(ad.viewCount)],['Clicks',fmtNum(ad.clickCount)],
    ['Destination',ad.adLinkURL]
  ];
  var html=(ad.adImageURL?'<img class="ad-detail-img" src="'+h(ad.adImageURL)+'" alt="" onerror="this.style.display=\'none\'">':'')+
    rows.map(function(r){return'<div class="ad-info-row"><span class="ad-info-label">'+r[0]+'</span><span class="ad-info-val">'+h(r[1]||'—')+'</span></div>';}).join('');
  if(ad.adDescription)html+='<div style="margin-top:12px;font-size:.82rem;color:var(--t2);line-height:1.5">'+h(ad.adDescription)+'</div>';
  if(ad.adminNotes)html+='<div style="margin-top:10px;background:var(--bg);border-radius:var(--r2px);padding:9px 11px;font-size:.79rem;color:var(--t2)"><strong>Admin notes:</strong> '+h(ad.adminNotes)+'</div>';
  if(ad.message)html+='<div style="margin-top:8px;background:rgba(6,95,212,.05);border-radius:var(--r2px);padding:9px 11px;font-size:.79rem;color:var(--blue)"><strong>Advertiser message:</strong> '+h(ad.message)+'</div>';
  document.getElementById('detailContent').innerHTML=html;
  document.getElementById('detailModal').classList.add('open');
}

// ── GENERATE MODAL ────────────────────────────────────────────
function openGenerate(){
  var active=_allAds.filter(function(a){return a.status==='active';});
  var top=active.filter(function(a){return a.placement==='top';}).length;
  var ctr=active.filter(function(a){return a.placement==='center';}).length;
  var bot=active.filter(function(a){return a.placement==='bottom';}).length;
  setText('genTopCount',top+' ad'+(top!==1?'s':''));
  setText('genCenterCount',ctr+' ad'+(ctr!==1?'s':''));
  setText('genBotCount',bot+' ad'+(bot!==1?'s':''));
  document.getElementById('genPreview').style.display='none';
  document.getElementById('generateModal').classList.add('open');
}

function previewAdsHTML(){
  var interval=parseInt(document.getElementById('slideInterval').value||'5')*1000;
  var active=_allAds.filter(function(a){return a.status==='active';});
  var topHTML=buildSliderHTML(active.filter(function(a){return a.placement==='top';}),   'top',    interval);
  var midHTML=buildSliderHTML(active.filter(function(a){return a.placement==='center';}), 'center', interval);
  var botHTML=buildSliderHTML(active.filter(function(a){return a.placement==='bottom';}), 'bottom', interval);
  var full='<style>'+adsCSS()+'</style>'+topHTML+midHTML+botHTML+'<script>'+adsJS(interval)+'<\/script>';
  var pre=document.getElementById('genPreview');
  pre.style.display='block';
  pre.textContent=full.slice(0,2000)+(full.length>2000?'\n\n… (truncated)':'');
}

// ── GENERATE & SAVE — button version ─────────────────────────
function generateAdsHTML(){
  var btn=document.getElementById('genBtn');
  btn.disabled=true;btn.textContent='Saving…';
  var interval=parseInt(document.getElementById('slideInterval').value||'5')*1000;
  _doGenerate(interval,function(ok){
    btn.disabled=false;btn.textContent='⚡ Generate & Save to Site';
    if(ok){toast('Ads saved to site ✓','tok');closeModal('generateModal');}
  });
}

// ── AUTO-GENERATE — called silently after every status change ─
function autoGenerateAds(){
  _doGenerate(5000,null);
}

function _doGenerate(interval,cb){
  var active=_allAds.filter(function(a){return a.status==='active';});
  var topAds   =active.filter(function(a){return a.placement==='top';});
  var centerAds=active.filter(function(a){return a.placement==='center';});
  var bottomAds=active.filter(function(a){return a.placement==='bottom';});

  // Every slot gets its OWN style+script so it works independently on any page
  var style ='<style>'+adsCSS()+'<\/style>';
  var script='<script>'+adsJS(interval)+'<\/script>';

  var settings={
    ads_top:    topAds.length    ? style+buildSliderHTML(topAds,   'top',    interval)+script : '',
    ads_middle: centerAds.length ? style+buildSliderHTML(centerAds,'center', interval)+script : '',
    ads_bottom: bottomAds.length ? style+buildSliderHTML(bottomAds,'bottom', interval)+script : '',
    ads_generated_date: new Date().toLocaleString()
  };

  api('updateSettings',{token:TOKEN,settings:settings},function(r){
    if(r.ok){
      if(cb)cb(true);
      else toast('Site ads updated ✓','tok');
    } else {
      if(cb)cb(false);
      else toast('Auto-save failed: '+(r.msg||'Error'),'terr');
    }
  });
}

// ── BUILD SLIDER HTML ─────────────────────────────────────────
function buildSliderHTML(ads,placement,interval){
  if(!ads.length)return'';

  function escH(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  var slides=ads.map(function(ad,i){
    // Media: video ad (YouTube or MP4) or image or placeholder
    var mediaHTML='';
    if(ad.adType==='video'&&ad.adVideoURL){
      var yt=ad.adVideoURL.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
      if(yt){
        mediaHTML='<iframe src="https://www.youtube.com/embed/'+yt[1]+'?autoplay=0&mute=1&controls=1&rel=0&playsinline=1" '+
          'style="width:180px;height:100px;border:none;border-radius:4px;flex-shrink:0" allowfullscreen allow="autoplay;encrypted-media"></iframe>';
      } else {
        mediaHTML='<video style="width:180px;height:100px;border-radius:4px;flex-shrink:0;object-fit:cover;background:#000" '+
          'controls muted playsinline preload="metadata"><source src="'+escH(ad.adVideoURL)+'"></video>';
      }
    } else if(ad.adImageURL){
      mediaHTML='<img src="'+escH(ad.adImageURL)+'" alt="'+escH(ad.adTitle)+'" loading="lazy" '+
        'style="max-height:90px;max-width:200px;border-radius:4px;flex-shrink:0;object-fit:cover" '+
        'onerror="this.style.display=\'none\'">';
    } else {
      mediaHTML='<div class="ks-no-img">📢</div>';
    }

    return '<div class="ks-slide'+(i===0?' active':'')+'" data-href="'+escH(ad.adLinkURL)+'">'+
      '<div class="ks-slide-inner" onclick="if(event.target.tagName!==\'IFRAME\'&&event.target.tagName!==\'VIDEO\')adClick(this.parentNode)">'+
        mediaHTML+
        '<div class="ks-slide-text">'+
          '<div class="ks-slide-title">'+escH(ad.adTitle)+'</div>'+
          (ad.adDescription?'<div class="ks-slide-desc">'+escH(ad.adDescription.slice(0,120))+'</div>':'')+
          '<div class="ks-slide-cta">Learn More →</div>'+
        '</div>'+
      '</div>'+
      '<div class="ks-ad-badge">Sponsored · '+escH(ad.businessName)+'</div>'+
    '</div>';
  }).join('');

  var dots=ads.length>1
    ?'<div class="ks-dots">'+ads.map(function(_,i){
        return'<div class="ks-dot'+(i===0?' active':'')+'" onclick="goDot(\''+placement+'\','+i+')"></div>';
      }).join('')+'</div>'
    :'';

  var nav=ads.length>1
    ?'<button class="ks-prev" onclick="slidePrev(\''+placement+'\')" aria-label="Previous">&#8249;</button>'+
      '<button class="ks-next" onclick="slideNext(\''+placement+'\')" aria-label="Next">&#8250;</button>'
    :'';

  return '<div class="ks-slider" id="slider-'+placement+'" data-current="0" '+
    'onmouseenter="pauseSlider(\''+placement+'\')" '+
    'onmouseleave="resumeSlider(\''+placement+'\','+interval+')">'+
    '<div class="ks-track">'+slides+'</div>'+nav+dots+
  '</div>';
}

// ── ADS CSS ───────────────────────────────────────────────────
function adsCSS(){
  return '.ks-slider{position:relative;overflow:hidden;background:#f9f9f9;min-height:80px;border-radius:4px}'+
  '.ks-track{display:block}'+
  '.ks-slide{display:none;position:relative}'+
  '.ks-slide.active{display:block}'+
  '.ks-slide-inner{display:flex;align-items:center;gap:14px;padding:12px 16px;min-height:80px;cursor:pointer}'+
  '.ks-slide-inner img{max-height:90px;max-width:200px;border-radius:4px;flex-shrink:0;object-fit:cover}'+
  '.ks-no-img{width:80px;height:60px;background:#e5e5e5;border-radius:4px;flex-shrink:0;display:grid;place-items:center;font-size:1.5rem}'+
  '.ks-slide-text{flex:1;min-width:0}'+
  '.ks-slide-title{font-size:.9rem;font-weight:700;color:#0f0f0f;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
  '.ks-slide-desc{font-size:.78rem;color:#606060;line-height:1.5;margin-bottom:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}'+
  '.ks-slide-cta{display:inline-block;padding:5px 14px;background:#ff0000;color:#fff;border-radius:20px;font-size:.75rem;font-weight:700}'+
  '.ks-slide:hover .ks-slide-cta{opacity:.85}'+
  '.ks-ad-badge{position:absolute;top:5px;right:8px;font-size:.61rem;color:#aaa;background:rgba(255,255,255,.92);padding:1px 6px;border-radius:3px;border:1px solid #e5e5e5;pointer-events:none}'+
  '.ks-prev,.ks-next{position:absolute;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.9);border:1px solid #e5e5e5;cursor:pointer;font-size:1.1rem;display:grid;place-items:center;z-index:10;line-height:1}'+
  '.ks-prev{left:5px}.ks-next{right:5px}'+
  '.ks-prev:hover,.ks-next:hover{background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.12)}'+
  '.ks-dots{position:absolute;bottom:5px;left:50%;transform:translateX(-50%);display:flex;gap:4px;z-index:5}'+
  '.ks-dot{width:6px;height:6px;border-radius:50%;background:#ddd;cursor:pointer;transition:background .2s}'+
  '.ks-dot.active{background:#ff0000}'+
  '@media(max-width:480px){.ks-slide-inner{padding:8px 10px;min-height:60px;gap:9px}'+
  '.ks-slide-inner img{max-width:90px;max-height:60px}.ks-slide-title{font-size:.8rem}.ks-slide-desc{display:none}}';
}

// ── ADS JS ────────────────────────────────────────────────────
function adsJS(interval){
  return'if(!window._ksSl)window._ksSl={};'+
  '(function(){'+
    'function init(){'+
      'document.querySelectorAll(".ks-slider").forEach(function(sl){'+
        'var p=sl.id.replace("slider-","");'+
        'if(sl.querySelectorAll(".ks-slide").length>1)resume(p,'+interval+');'+
      '});'+
    '}'+
    'function pause(p){clearInterval(window._ksSl[p]);}'+
    'function resume(p,ms){'+
      'clearInterval(window._ksSl[p]);'+
      'window._ksSl[p]=setInterval(function(){go(p,1);},ms||'+interval+');'+
    '}'+
    'function go(p,dir){'+
      'var sl=document.getElementById("slider-"+p);if(!sl)return;'+
      'var slides=sl.querySelectorAll(".ks-slide"),dots=sl.querySelectorAll(".ks-dot"),n=slides.length;if(!n)return;'+
      'var cur=parseInt(sl.dataset.current)||0;'+
      'slides[cur].classList.remove("active");if(dots[cur])dots[cur].classList.remove("active");'+
      'cur=(cur+dir+n)%n;'+
      'slides[cur].classList.add("active");if(dots[cur])dots[cur].classList.add("active");'+
      'sl.dataset.current=cur;'+
    '}'+
    'window.pauseSlider=pause;'+
    'window.resumeSlider=resume;'+
    'window.slideNext=function(p){go(p,1);};'+
    'window.slidePrev=function(p){go(p,-1);};'+
    'window.goDot=function(p,idx){'+
      'var sl=document.getElementById("slider-"+p);if(!sl)return;'+
      'var slides=sl.querySelectorAll(".ks-slide"),dots=sl.querySelectorAll(".ks-dot");'+
      'var cur=parseInt(sl.dataset.current)||0;'+
      'slides[cur].classList.remove("active");if(dots[cur])dots[cur].classList.remove("active");'+
      'slides[idx].classList.add("active");if(dots[idx])dots[idx].classList.add("active");'+
      'sl.dataset.current=idx;'+
    '};'+
    'window.adClick=function(slide){'+
      'var url=slide.dataset.href;if(url&&url.indexOf("http")===0)window.open(url,"_blank","noopener");'+
    '};'+
    'if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",init);}else{init();}'+
  '})();';
}

// ── MODAL HELPERS ─────────────────────────────────────────────
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.addEventListener('click',function(e){
  ['approveModal','rejectModal','detailModal','generateModal'].forEach(function(id){
    var m=document.getElementById(id);if(m&&e.target===m)closeModal(id);
  });
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape')['approveModal','rejectModal','detailModal','generateModal'].forEach(closeModal);
});