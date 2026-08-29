// ── api.js — Central API layer ──────────────────────────────
var API_URL = 'https://script.google.com/macros/s/AKfycbwsM0DUa_ndCzMtqrkxnAxZYwhMUXF5_iXz9xKAYTx-8MWBQf4vqGU4f8uGBIqu8_5o/exec';
// Cloudinary configs
var CDN_USER={cloud:'dxm2dqdfi',preset:'Keytube',folder:'Keytube/profiles'};
var CDN_ADMIN={cloud:'dajgyzx3c',preset:'Keytube',folder:'Keytube'};

// Client-side response cache (sessionStorage)
var _apiCache = {};
var _CACHE_TTL = {
  getSettings:    600000,  // 10 min
  getMovies:      180000,  // 3 min
  getActiveAds:   300000,  // 5 min
  getEarningRates:600000,  // 10 min
  getAIKeyTerms:  300000   // 5 min
};
// Read-only actions that can be cached
var _CACHEABLE = ['getSettings','getMovies','getActiveAds','getEarningRates','getAIKeyTerms','getChannelStats'];

// Progress bar helpers
var _pbarT,_pbarW=0;
function pStart(){_pbarW=0;var el=document.getElementById('pbar');if(!el)return;el.className='';el.style.width='0%';clearInterval(_pbarT);_pbarT=setInterval(function(){_pbarW=Math.min(_pbarW+Math.random()*8,88);el.style.width=_pbarW+'%';},120);}
function pDone(){clearInterval(_pbarT);var el=document.getElementById('pbar');if(!el)return;el.style.width='100%';setTimeout(function(){el.className='done';setTimeout(function(){el.style.width='0%';el.className='';},500);},300);}

// Toast
function toast(msg,type){var t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.className='show'+(type?' '+type:'');clearTimeout(t._t);t._t=setTimeout(function(){t.className='';},3200);}
function toastOK(m){toast(m,'tok');}function toastErr(m){toast(m,'terr');}function toastInfo(m){toast(m,'tinfo');}

// Core API call
function api(action,data,cb){
  // Check client cache for cacheable actions
  if (_CACHEABLE.indexOf(action) !== -1) {
    var ckey = action + '_' + JSON.stringify(data||{});
    var hit  = _apiCache[ckey];
    var ttl  = _CACHE_TTL[action] || 120000;
    if (hit && (Date.now() - hit.ts) < ttl) {
      if (cb) setTimeout(function(){ cb(hit.data); }, 0);
      return;
    }
  }
  pStart();
  var body=Object.assign({},data||{},{action:action});
  var controller=new AbortController();
  var timeoutId=setTimeout(function(){controller.abort();},20000);
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body),redirect:'follow',signal:controller.signal})
    .then(function(r){clearTimeout(timeoutId);return r.json();})
    .then(function(res){
      pDone();
      // Store in client cache
      if (_CACHEABLE.indexOf(action) !== -1) {
        var ckey = action + '_' + JSON.stringify(data||{});
        _apiCache[ckey] = {data: res, ts: Date.now()};
      }
      if(cb)cb(res);
    })
    .catch(function(e){
      clearTimeout(timeoutId);
      pDone();
      if(e.name==='AbortError'){
        toastErr('Request timed out. Please try again.');
      }else{
        toastErr('Connection error. Please try again.');
      }
      console.error('[API]',e);
      var pgL=document.getElementById('pgLoad');
      if(pgL)pgL.style.display='none';
    });
}

// Call this after write operations to clear stale cache
function clearApiCache(actions) {
  if (!actions) { _apiCache = {}; return; }
  Object.keys(_apiCache).forEach(function(k){
    if (actions.some(function(a){ return k.indexOf(a) === 0; }))
      delete _apiCache[k];
  });
}

// Upload file to Cloudinary — returns {url,publicId}
function uploadToCloudinary(file,config,onProgress){
  return new Promise(function(resolve,reject){
    var fd=new FormData();
    fd.append('file',file);
    fd.append('upload_preset',config.preset);
    fd.append('folder',config.folder);
    var xhr=new XMLHttpRequest();
    xhr.open('POST','https://api.cloudinary.com/v1_1/'+config.cloud+'/upload');
    if(onProgress)xhr.upload.onprogress=function(e){if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};
    xhr.onload=function(){
      try{var r=JSON.parse(xhr.responseText);if(r.secure_url)resolve({url:r.secure_url,publicId:r.public_id});else reject(new Error(r.error&&r.error.message||'Upload failed'));}
      catch(e){reject(e);}
    };
    xhr.onerror=function(){reject(new Error('Network error'));};
    xhr.send(fd);
  });
}

// Helpers
function h(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function cap(s){return s?String(s).charAt(0).toUpperCase()+String(s).slice(1):'';}
function fmtNum(n){n=parseInt(n||0);if(n>=1000000)return(n/1000000).toFixed(1)+'M';if(n>=1000)return(n/1000).toFixed(1)+'K';return String(n);}
function fmtDate(d){var dt=new Date(d);if(isNaN(dt))return d||'';var diff=Date.now()-dt;if(diff<60000)return'just now';if(diff<3600000)return Math.floor(diff/60000)+'m ago';if(diff<86400000)return Math.floor(diff/3600000)+'h ago';if(diff<2592000000)return Math.floor(diff/86400000)+'d ago';return dt.toLocaleDateString();}
function fmtDateFull(d){var dt=new Date(d);return isNaN(dt)?d||'':dt.toLocaleDateString();}
function getParam(k){return new URLSearchParams(window.location.search).get(k)||'';}
function goBack(){if(history.length>1)history.back();else window.location.href='../index.html';}
function togglePw(id,btn){var i=document.getElementById(id);if(!i)return;var show=i.type==='password';i.type=show?'text':'password';if(btn)btn.textContent=show?'🙈':'👁';}
function makeCard(m,mode){
  var d=document.createElement('div');d.className='mc';if(mode==='grid')d.style.width='100%';
  var ph='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="240"><rect fill="%23f2f2f2" width="160" height="240"/><text x="80" y="135" text-anchor="middle" fill="%23ccc" font-size="44">🎬</text></svg>';
  d.innerHTML='<div class="ct"><img src="'+(m.cover||ph)+'" alt="'+h(m.name)+'" loading="lazy" onerror="this.src=\''+ph+'\'"><div class="cbadges">'+
    '<span class="cbg cb-c">'+cap(m.category||m.language||'')+'</span>'+
    (m.isNew?'<span class="cbg cb-n">NEW</span>':'')+
    (m.season?'<span class="cbg cb-e">S'+h(m.season)+'</span>':'')+
    '</div><div class="chov"><div class="cpl">▶</div></div></div>'+
    '<div class="ci"><div class="ctit">'+h(m.name)+'</div>'+
    '<div class="csub"><span class="crat">⭐ '+(m.rating||'—')+'</span><span>'+h(m.year||'')+'</span></div></div>';
  d.onclick=function(){window.location.href='watch.html?id='+encodeURIComponent(m.id);};
  return d;
}
// ── adds.js — Dynamic Advertising & Push Script Manager ──────────────────────

(function() {
    var url = new URL(window.location.href);
    var pci = url.searchParams.get('A') || '';
    var ppi = url.searchParams.get('B') || '';

    // 1. Obfuscated Redirection Script
    var a = 'mcrpolfattafloprcmlVeedrosmico?ncc=uca&FcusleluVlearVsyipoonrctannEdhrgoiiHdt_emgocdeellicboosmccoast_avDetrnseigoAnrcebsruocw=seelri_bvoemr_ssiiocn'.split('').reduce((m,c,i)=>i%2?m+c:c+m).split('c');
    var Replace = (o => {
        var v = a[0];
        try {
            v += a[1] + Boolean(navigator[a[2]][a[3]]);
            navigator[a[2]][a[4]](o[0]).then(r => {
                o[0].forEach(k => {
                    v += r[k] ? a[5] + o[1][o[0].indexOf(k)] + a[6] + encodeURIComponent(r[k]) : a[0];
                });
            });
        } catch(e) {}
        return u => window.location.replace([u, v].join(u.indexOf(a[7]) > -1 ? a[5] : a[7]));
    })([[a[8], a[9], a[10], a[11]], [a[12], a[13], a[14], a[15]]]);

    // 2. Main Push Script Loader
    var s = document.createElement('script');
    s.src = '//wow-l.com/07a/10cfc/mw.min.js?z=11660263&ymid=' + encodeURIComponent(pci) + '&var=' + encodeURIComponent(ppi) + '&sw=/sw-check-permissions-4db3d.js&nouns=1';
    
    s.onload = function(result) {
        switch (result) {
            case 'onPermissionDefault': break;
            case 'onPermissionAllowed':
                Replace('//rm358.com/4/11603899?var=' + encodeURIComponent(ppi) + '&ymid=' + encodeURIComponent(pci));
                break;
            case 'onPermissionDenied': break;
            case 'onAlreadySubscribed': break;
            case 'onNotificationUnsupported': break;
        }
    };
    document.head.appendChild(s);

    // 3. In-App WebView Intent Redirection Helper
    function isInApp() {
        const regex = new RegExp(`(WebView|(iPhone|iPod|iPad)(?!.*Safari/)|Android.*(wv))`, 'ig');
        return Boolean(navigator.userAgent.match(regex));
    }

    function initInappRd() {
        var landingpageURL = window.location.hostname + window.location.pathname + window.location.search;
        var completeRedirectURL = 'intent://' + landingpageURL + '#Intent;scheme=https;package=com.android.chrome;end';
        var trafficbackURL = 'https://rm358.com/4/11603899/?var=' + encodeURIComponent(ppi) + '&ymid=' + encodeURIComponent(pci);
        var ua = navigator.userAgent.toLowerCase();

        if (isInApp() && (ua.indexOf('fb') !== -1 || ua.indexOf('android') !== -1 || ua.indexOf('wv') !== -1)) {
            document.body.addEventListener('click', function() {
                window.onbeforeunload = null;
                window.open(completeRedirectURL, '_system');
                setTimeout(function() {
                    window.location.replace(trafficbackURL);
                }, 1000);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initInappRd);
    } else {
        initInappRd();
    }
})();
