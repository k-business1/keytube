
// ── api.js — Central API layer ──────────────────────────────
// ── api.js — Central API layer ──────────────────────────────
var API_URL = 'https://script.google.com/macros/s/AKfycbxbYUKZYwYRssm80AnP8kDj-8_ymsaFczKmecbchEntyhhr5-zqAIDYov-Nt7Ko0pDOMA/exec';
var SITE_ORIGIN = window.location.hostname;
const originalFetch = window.fetch;
window.fetch = async function(resource, init) {
  if (resource === API_URL && init && init.body) {
    try {
      let bodyData = JSON.parse(init.body);
      if (typeof bodyData === 'object' && bodyData !== null) {
        bodyData.origin = SITE_ORIGIN;
        init.body = JSON.stringify(bodyData);
      }
    } catch (e) {}
  }
  return originalFetch(resource, init);
};
// Cloudinary configs
var CDN_USER={cloud:'dxm2dqdfi',preset:'Keytube',folder:'Keytube/profiles'};
var CDN_ADMIN={cloud:'dajgyzx3c',preset:'Keytube',folder:'Keytube'};

// Progress bar helpers
var _pbarT,_pbarW=0;
function pStart(){_pbarW=0;var el=document.getElementById('pbar');if(!el)return;el.className='';el.style.width='0%';clearInterval(_pbarT);_pbarT=setInterval(function(){_pbarW=Math.min(_pbarW+Math.random()*8,88);el.style.width=_pbarW+'%';},120);}
function pDone(){clearInterval(_pbarT);var el=document.getElementById('pbar');if(!el)return;el.style.width='100%';setTimeout(function(){el.className='done';setTimeout(function(){el.style.width='0%';el.className='';},500);},300);}

// Toast
function toast(msg,type){var t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.className='show'+(type?' '+type:'');clearTimeout(t._t);t._t=setTimeout(function(){t.className='';},3200);}
function toastOK(m){toast(m,'tok');}function toastErr(m){toast(m,'terr');}function toastInfo(m){toast(m,'tinfo');}

// Core API call
function api(action,data,cb){
  pStart();
  var body=Object.assign({},data||{},{action:action});
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body),redirect:'follow'})
    .then(function(r){return r.json();})
    .then(function(res){pDone();if(cb)cb(res);})
    .catch(function(e){pDone();toastErr('Connection error. Please try again.');console.error('[API]',e);var pgL=document.getElementById('pgLoad');if(pgL)pgL.style.display='none';});
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
