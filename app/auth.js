
// ── auth.js — Auth, session, nav UI ────────────────────────
var _S={user:null,adminToken:null,settings:{},pages:{}};

// Session
function getUser(){if(!_S.user){try{var u=sessionStorage.getItem('kt_u');if(u)_S.user=JSON.parse(u);}catch(e){}}return _S.user;}
function getAdminToken(){if(!_S.adminToken)_S.adminToken=sessionStorage.getItem('kt_a')||null;return _S.adminToken;}
function setUser(u){_S.user=u;sessionStorage.setItem('kt_u',JSON.stringify(u));}
function setAdminToken(t){_S.adminToken=t;sessionStorage.setItem('kt_a',t);}
function clearSession(){_S.user=null;_S.adminToken=null;sessionStorage.removeItem('kt_u');sessionStorage.removeItem('kt_a');}

// Login required
function showLoginReq(){var el=document.getElementById('loginReq');if(el)el.classList.add('show');var f=document.querySelector('.lr-fill');if(f){f.style.width='0%';void f.offsetWidth;f.style.animation='none';void f.offsetWidth;f.style.animation='';}}
function hideLoginReq(){var el=document.getElementById('loginReq');if(el)el.classList.remove('show');}
function requireLogin(cb){var u=getUser();if(!u){showLoginReq();return false;}if(cb)cb(u);return true;}

// Nav UI
function updateNavUI(){
  var u=getUser(),adm=getAdminToken();
  var siBtn=document.getElementById('siBtn');
  var uChip=document.getElementById('uChip');
  var avEl=document.getElementById('avEl');
  var admNavBtn=document.getElementById('admNavBtn');
  var admDropI=document.getElementById('admDropI');
  var notifBtn=document.getElementById('notifBtn');
  if(siBtn)siBtn.style.display=u?'none':'';
  var suBtn=document.getElementById('suBtn');if(suBtn)suBtn.style.display=u?'none':'';
  if(uChip)uChip.style.display=u?'':'none';
  if(avEl&&u){
    var init=(u.name||u.gmail||'U')[0].toUpperCase();
    if(u.avatar){avEl.innerHTML='<img src="'+h(u.avatar)+'" alt="'+init+'" onerror="this.parentNode.innerHTML=\''+init+'\'">';} else avEl.textContent=init;
  }
  if(admNavBtn)admNavBtn.style.display=adm?'':'none';
  if(admDropI)admDropI.style.display=adm?'':'none';
  if(notifBtn)notifBtn.style.display=u?'':'none';
}

// Dropdown
function toggleDrop(){var d=document.getElementById('udrop');if(d)d.classList.toggle('open');}
function cd(){var d=document.getElementById('udrop');if(d)d.classList.remove('open');}
document.addEventListener('click',function(e){
  var uc=document.getElementById('uChip'),ud=document.getElementById('udrop');
  var nb=document.getElementById('notifBtn'),np=document.getElementById('notifPanel');
  if(uc&&ud&&!uc.contains(e.target)&&!ud.contains(e.target))ud.classList.remove('open');
  if(nb&&np&&!nb.contains(e.target)&&!np.contains(e.target))np.classList.remove('open');
});

// Logout
function doLogout(){
  clearSession();
  if(window._pingTimer)clearInterval(window._pingTimer);
  window.location.href=window.location.pathname.includes('/pages/')?'../index.html':'index.html';
}

// Ping online
function startPing(){
  var u=getUser();if(!u)return;
  pingNow();
  window._pingTimer=setInterval(pingNow,30000);
}
function pingNow(){var u=getUser();if(u)api('pingOnline',{gmail:u.gmail,country:u.country||''},null);}

// Login action
function doLogin(){
  var em=document.getElementById('liE')||document.getElementById('email');
  var pw=document.getElementById('liP')||document.getElementById('password');
  var er=document.getElementById('liErr')||document.getElementById('loginErr');
  if(!em||!pw)return;
  if(!em.value.trim()||!pw.value){if(er)er.textContent='Fill all fields';return;}
  var btn=document.getElementById('loginBtn');if(btn){btn.disabled=true;btn.textContent='Signing in…';}
  if(er)er.textContent='';
  api('login',{gmail:em.value.trim(),password:pw.value},function(r){
    if(btn){btn.disabled=false;btn.textContent='Sign In →';}
    if(r.ok){
      setUser(r.user);
      var redir=getParam('redirect')||'../index.html';
      window.location.href=redir;
    } else {if(er)er.textContent=r.msg;}
  });
}

// Register action
function doRegister(){
  var nm=document.getElementById('regName'),em=document.getElementById('regEmail'),
      pw=document.getElementById('regPassword'),pw2=document.getElementById('regPassword2'),
      co=document.getElementById('regCountry'),tc=document.getElementById('termsCheck');
  var er=document.getElementById('regErr');
  if(!nm||!em||!pw)return;
  if(er)er.textContent='';
  if(!nm.value.trim()||!em.value.trim()||!pw.value){if(er)er.textContent='All required fields must be filled.';return;}
  if(pw2&&pw.value!==pw2.value){if(er)er.textContent='Passwords do not match.';return;}
  if(tc&&!tc.checked){if(er)er.textContent='Please accept the terms to continue.';return;}
  var btn=document.getElementById('regBtn');if(btn){btn.disabled=true;btn.textContent='Creating account…';}
  var avatarUrl=window._regAvatarUrl||'';
  api('register',{name:nm.value.trim(),gmail:em.value.trim(),password:pw.value,country:co?co.value:'',avatar:avatarUrl},function(r){
    if(btn){btn.disabled=false;btn.textContent='Create Account →';}
    if(r.ok){setUser(r.user);window.location.href='../index.html';}
    else{if(er)er.textContent=r.msg;}
  });
}

// Avatar preview on register
window._regAvatarUrl='';
function previewAvatar(input){
  var file=input.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(e){
    var img=document.getElementById('avatarImg');var init=document.getElementById('avatarInitial');
    if(img){img.src=e.target.result;img.style.display='block';}if(init)init.style.display='none';
  };
  reader.readAsDataURL(file);
  // Upload to Cloudinary (user account)
  uploadToCloudinary(file,CDN_USER,null).then(function(res){window._regAvatarUrl=res.url;}).catch(function(){});
}

// Info page init (about/contact/help)
function initInfoPage(page){
  var pgL=document.getElementById('pgLoad');if(pgL)pgL.style.display='none';
  var u=getUser();
  updateNavUI();
  if(page==='about'){
    api('getStats',{token:''},function(r){if(r.ok&&r.stats){var el=document.getElementById('aboutUsers');if(el)el.textContent=fmtNum(r.stats.users);var el2=document.getElementById('aboutMovies');if(el2)el2.textContent=fmtNum(r.stats.movies);}});
  }
  if(page==='contact'){
    window.sendContactMessage=function(){
      var n=document.getElementById('cName'),e=document.getElementById('cEmail'),s=document.getElementById('cSubject'),m=document.getElementById('cMessage'),er=document.getElementById('cErr');
      if(!n||!e||!s||!m)return;
      if(!n.value.trim()||!e.value.trim()||!s.value||!m.value.trim()){if(er)er.textContent='Please fill all required fields.';return;}
      var btn=document.getElementById('cSubmitBtn');if(btn){btn.disabled=true;btn.textContent='Sending…';}
      if(er)er.textContent='';
      // Simulate sending (no backend endpoint for contact form)
      setTimeout(function(){
        if(btn){btn.disabled=false;btn.textContent='📤 Send Message';}
        document.querySelector('.contact-form').style.display='none';
        var succ=document.getElementById('cSuccess');if(succ)succ.classList.remove('hidden');
      },1200);
    };
    window.resetContactForm=function(){
      document.querySelector('.contact-form').style.display='block';
      var succ=document.getElementById('cSuccess');if(succ)succ.classList.add('hidden');
      ['cName','cEmail','cSubject','cMessage'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
    };
  }
  if(u)startPing();
  api('logTraffic',{user:u?u.gmail:'guest',action:'page:'+page,country:u?u.country:'',details:page});
}

// Page init routing
function initPage(page){
  var pgL=document.getElementById('pgLoad');if(pgL)pgL.style.display='none';
  var u=getUser();
  if(page==='login'&&u){window.location.href='../index.html';return;}
  if(page==='register'&&u){window.location.href='../index.html';return;}
  updateNavUI();
}
