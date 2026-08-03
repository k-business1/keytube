var _activeCat='all',_activeType='all',_advOpen=false,_adminClickCount=0,_adminClickTimer=null;

window.onload=function(){
  document.getElementById('fyear').textContent=new Date().getFullYear();
  var u=getUser();updateNavUI();
  // Apply saved theme
  try{var th=localStorage.getItem('kt_theme');if(th==='dark')document.body.classList.add('dark');}catch(e){}
  api('getSettings',{},function(r){
    if(r.ok){applyHomeSettings(r.settings);}
    loadHomeMovies();
    if(u){loadNotifications();startPing();}
    api('logTraffic',{user:u?u.gmail:'guest',action:'visit',country:u?u.country:'',details:navigator.language});
  });
  var tab=getParam('tab');if(tab==='downloads')showDownloads();else if(tab==='mylist')showMyList();
};

function applyHomeSettings(s){
  var sn=s['site_name']||'KEYTUBE';
  document.title=sn+' — Stream & Download Movies Worldwide';
  var snEl=document.getElementById('snEl');if(snEl)snEl.textContent=sn;
  var fb=document.getElementById('footBrand');if(fb)fb.textContent=sn;
  var ldn=document.getElementById('ld-site-name');if(ldn)ldn.textContent=sn;
  if(s['favicon_url']){var lk=document.getElementById('favicon')||document.createElement('link');lk.id='favicon';lk.rel='icon';lk.href=s['favicon_url'];document.head.appendChild(lk);}
  if(s['background_url']){document.body.style.backgroundImage='url('+s['background_url']+')';document.body.style.backgroundSize='cover';document.body.style.backgroundAttachment='fixed';}
  if(s['ads_top'])document.getElementById('adTop').innerHTML=s['ads_top'];
  if(s['ads_middle'])document.getElementById('adMid').innerHTML=s['ads_middle'];
  if(s['ads_bottom'])document.getElementById('adBot').innerHTML=s['ads_bottom'];
  if(s['app_download_url']&&s['app_download_url'].trim()){var ab=document.getElementById('appBanner');if(ab)ab.style.display='flex';var adb=document.getElementById('appDlBtn');if(adb)adb.dataset.url=s['app_download_url'];}
}

function downloadApp(){var url=document.getElementById('appDlBtn').dataset.url||'';if(url)window.open(url,'_blank');}

function loadHomeMovies(cat,type,year,minRating,country){
  var u=getUser();
  api('getMovies',{isLoggedIn:!!u,category:cat||_activeCat,type:type||_activeType,year:year||'',minRating:minRating||'',country:country||''},function(r){
    document.getElementById('pgLoad').style.display='none';
    if(!r.ok){toastErr(r.msg);return;}
    var movies=r.movies||[];_movies=movies;
    // Hero
    var feat=movies.filter(function(m){return m.featured;});
    if(!feat.length)feat=movies.slice(0,Math.min(5,movies.length));
    _heroMovies=feat;_heroIdx=0;
    if(feat.length){document.getElementById('hero').style.display='block';buildHeroDots();renderHero(0);startHeroTimer();}
    // Trending row
    renderRow('tRow',movies.filter(function(m){return !m.isNew;}).slice(0,20));
    // New releases
    if(u){var nw=movies.filter(function(m){return m.isNew;});var ns=document.getElementById('newSec');if(nw.length){ns.classList.remove('hidden');renderRow('nRow',nw.slice(0,20));}else ns.classList.add('hidden');document.getElementById('guestBanner').style.display='none';}
    else{document.getElementById('newSec').classList.add('hidden');document.getElementById('guestBanner').style.display='block';}
    // Grid
    renderGrid(movies,'mGrid','emptySt',u?'No movies found.':'Sign in to see more.');
  });
}

function goHome(){_activeCat='all';_activeType='all';clearF();document.querySelectorAll('.cp').forEach(function(b){b.classList.remove('active');});var first=document.querySelector('.cp');if(first)first.classList.add('active');document.getElementById('gTitle').textContent='All Movies';loadHomeMovies();window.scrollTo({top:0,behavior:'smooth'});}
function setCat(cat,btn){_activeCat=cat;document.querySelectorAll('.cp').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');_activeType=cat==='series'?'series':'all';loadHomeMovies(cat,_activeType);document.querySelector('main').scrollIntoView({behavior:'smooth'});}
function setCatName(type){_activeType=type;document.getElementById('gTitle').textContent=type==='series'?'TV Shows':'Movies';loadHomeMovies(_activeCat,type);document.querySelector('main').scrollIntoView({behavior:'smooth'});}
function toggleAdv(){_advOpen=!_advOpen;document.getElementById('advF').classList.toggle('open',_advOpen);document.getElementById('fArrow').textContent=_advOpen?'▲':'▼';}
function applyF(){var yr=document.getElementById('fYear').value,rat=document.getElementById('fRat').value,co=document.getElementById('fCo').value,tp=document.getElementById('fType2').value;loadHomeMovies(_activeCat,tp||_activeType,yr,rat,co);}
function clearF(){document.getElementById('fYear').value='';document.getElementById('fRat').value='';document.getElementById('fCo').value='';document.getElementById('fType2').value='all';loadHomeMovies();}
function sRow(id,dir){var el=document.getElementById(id);if(el)el.scrollBy({left:dir*340,behavior:'smooth'});}

function showDownloads(){
  if(!getUser()){showLoginReq();return;}
  window.location.href='pages/playlist.html?tab=downloads';
}
function showMyList(){
  if(!getUser()){showLoginReq();return;}
  window.location.href='pages/playlist.html?tab=saved';
}

// Search on home
var _srTimer2=null;
function onSearchInput(v){clearTimeout(_srTimer2);if(!v.trim()){cSearch();return;}_srTimer2=setTimeout(function(){doSearch(v.trim());},380);}
function doSBtn(){var v=document.getElementById('si').value.trim();if(v)doSearch(v);else cSearch();}
function doSearch(q){
  var u=getUser();
  api('searchMovies',{query:q,isLoggedIn:!!u},function(r){
    if(!r.ok)return;
    var so=document.getElementById('srOverlay');so.style.display='block';
    document.getElementById('srQ').textContent=q;
    var exact=r.exact||[],sim=r.similar||[];
    document.getElementById('srSub').textContent=exact.length+' exact · '+sim.length+' similar';
    var ex=document.getElementById('srEx');ex.innerHTML='';
    if(exact.length){var g=document.createElement('div');g.className='gw';exact.forEach(function(m){g.appendChild(makeCard(m,'grid'));});ex.appendChild(g);}
    else ex.innerHTML='<div style="background:var(--w);border:1px solid var(--brd);border-radius:var(--r);padding:22px;text-align:center"><strong>No exact match for "'+h(q)+'"</strong><p style="font-size:.8rem;color:var(--t2);margin-top:4px">See similar results below</p></div>';
    var sm=document.getElementById('srSim');sm.innerHTML='';
    if(sim.length){var t=document.createElement('div');t.style.cssText='font-size:.8rem;font-weight:700;color:var(--t2);text-transform:uppercase;margin:14px 0 9px';t.textContent='Similar Results';var g2=document.createElement('div');g2.className='gw';sim.forEach(function(m){g2.appendChild(makeCard(m,'grid'));});sm.appendChild(t);sm.appendChild(g2);}
  });
}
function cSearch(){document.getElementById('srOverlay').style.display='none';document.getElementById('si').value='';}
document.addEventListener('keydown',function(e){if(e.key==='Escape')cSearch();});

// Admin trigger (6 clicks on "2026")
function trackAdminClicks(){
  _adminClickCount++;
  clearTimeout(_adminClickTimer);
  _adminClickTimer=setTimeout(function(){_adminClickCount=0;},2000);
  if(_adminClickCount>=6){_adminClickCount=0;triggerAdminLogin();}
}
function triggerAdminLogin(){window.location.href='admin/admin.html';}
function openAdminPanel(){window.location.href='admin/admin.html';}
