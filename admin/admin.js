// ── admin.js — KEYTUBE Admin Panel ──────────────────────────
var API='https://script.google.com/macros/s/AKfycbxbYUKZYwYRssm80AnP8kDj-8_ymsaFczKmecbchEntyhhr5-zqAIDYov-Nt7Ko0pDOMA/exec';
var TOKEN='';

function h(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function cap(s){return s?String(s).charAt(0).toUpperCase()+String(s).slice(1):'';}
function fmtDate(d){var dt=new Date(d);return isNaN(dt)?d||'':dt.toLocaleDateString();}
function toast(msg,type){var t=document.getElementById('toast');t.textContent=msg;t.className='show'+(type?' '+type:'');clearTimeout(t._t);t._t=setTimeout(function(){t.className='';},3000);}
var pW=0,pT;
function pStart(){pW=0;var e=document.getElementById('pbar');e.className='';e.style.width='0%';clearInterval(pT);pT=setInterval(function(){pW=Math.min(pW+Math.random()*8,88);e.style.width=pW+'%';},120);}
function pDone(){clearInterval(pT);var e=document.getElementById('pbar');e.style.width='100%';setTimeout(function(){e.className='done';setTimeout(function(){e.style.width='0%';e.className='';},500);},280);}

function api(action,data,cb){
  pStart();
  fetch(API,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(Object.assign({},data||{},{action:action})),redirect:'follow'})
  .then(function(r){return r.json();}).then(function(res){pDone();if(cb)cb(res);})
  .catch(function(e){pDone();toast('Connection error','terr');console.error(e);});
}

window.onload=function(){
  var saved=sessionStorage.getItem('kt_a');
  if(saved){TOKEN=saved;openPanel();}
};

function doAdminLogin(){
  var pw=document.getElementById('adPw').value;
  var er=document.getElementById('adErr');
  var btn=document.getElementById('loginBtn');
  if(!pw){er.textContent='Enter your password';return;}
  er.textContent='';btn.innerHTML='Checking…';btn.disabled=true;
  api('adminLogin',{password:pw},function(r){
    btn.innerHTML='→ Enter Admin Panel';btn.disabled=false;
    if(r.ok){TOKEN=r.token;sessionStorage.setItem('kt_a',TOKEN);openPanel();toast('Admin access granted ✓','tok');}
    else{er.textContent=r.msg||'Wrong password';document.getElementById('adPw').value='';document.getElementById('adPw').focus();}
  });
}

function openPanel(){
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('admPanel').classList.add('open');
  try{var u=JSON.parse(sessionStorage.getItem('kt_u')||'{}');if(u.gmail)document.getElementById('abarUser').textContent=u.name||u.gmail;}catch(e){}
  aTab('dash');
}

function doLogout(){
  if(!confirm('Log out of admin panel?'))return;
  TOKEN='';sessionStorage.removeItem('kt_a');
  document.getElementById('admPanel').classList.remove('open');
  document.getElementById('loginScreen').style.display='grid';
  document.getElementById('adPw').value='';document.getElementById('adErr').textContent='';
  toast('Logged out');
}

function aTab(tab){
  document.querySelectorAll('.atb').forEach(function(b){b.classList.remove('act');});
  var el=document.getElementById('tab-'+tab);if(el)el.classList.add('act');
  document.getElementById('aBody').innerHTML='<div class="spin"></div>';
  ({dash:aDash,movies:aMovies,users:aUsers,comments:aComments,notif:aNotif,pages:aPages,traffic:aTraffic,settings:aSettings})[tab]();
}

// ── DASHBOARD ──────────────────────────────────────────────
function aDash(){
  api('getStats',{token:TOKEN},function(r){
    if(!r.ok){aErr(r.msg);return;}
    var s=r.stats;
    api('getOnlineUsers',{token:TOKEN},function(lo){
      var lc=lo.ok?lo.count:0,lu=lo.ok?lo.users:[];
      document.getElementById('aBody').innerHTML=
        '<div class="stats-r">'+
        [['👥','Users',s.users],['🎬','Movies',s.movies],['💬','Comments',s.comments],['📈','Visits',s.traffic],['⬇','Downloads',s.downloads||0],['📋','Playlists',s.playlist||0],['📺','Channels',s.channels||0],['👥','Followers',s.followers||0]].map(function(x){return'<div class="sc"><div class="sc-i">'+x[0]+'</div><div class="sc-n">'+x[2]+'</div><div class="sc-l">'+x[1]+'</div></div>';}).join('')+'</div>'+
        '<div class="aform2" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+
        '<span class="live-badge"><span class="live-dot"></span>'+lc+' online now</span>'+
        '<button class="ab2 ab2-bl" onclick="aDash()">🔄 Refresh</button>'+
        '<button class="ab2 ab2-bl" onclick="window.location.href=\'../index.html\'">← Back to Site</button>'+
        '</div>'+
        '<div class="aform2"><h3>Quick Actions</h3><div class="fa-row">'+
        '<button class="ab2 ab2-red" onclick="aTab(\'movies\')">+ Add Movie</button>'+
        '<button class="ab2 ab2-bl" onclick="aTab(\'users\')">Manage Users</button>'+
        '<button class="ab2 ab2-red" onclick="aTab(\'notif\')">Send Notification</button>'+
        '<button class="ab2" onclick="aTab(\'settings\')">Settings</button>'+
        '</div></div>'+
        '<div class="aform2"><h3>🟢 Live Users ('+lc+')</h3>'+
        (lu.length?lu.map(function(u){return'<div class="tf"><span class="tf-u">'+h(u.gmail)+'</span><span class="tf-a">online</span><span style="color:var(--t2);font-size:.71rem">'+h(u.country||'—')+'</span><span class="tf-t">'+fmtDate(u.lastSeen)+'</span></div>';}).join(''):'<p style="font-size:.8rem;color:var(--t2)">No users online right now.</p>')+
        '</div>';
    });
  });
}

// ── MOVIES ────────────────────────────────────────────────
var _editId=null;
var ALL_CATS=['movies','english','french','drama','chinese','indian','cartoon','comedy','song','news','highlight'];
var ALL_TYPES=['movie','series','song','news','other'];

function aMovies(){
  api('getMovies',{isLoggedIn:true,category:'all',type:'all'},function(r){
    if(!r.ok){aErr(r.msg);return;}
    var movies=r.movies||[];
    document.getElementById('aBody').innerHTML='<div class="aform2" id="mfw">'+mFH(null)+'</div>'+
      '<div class="atw"><div class="ath"><h3>🎬 All Content ('+movies.length+') — Newest First</h3></div>'+
      '<div style="overflow-x:auto"><table class="dt"><thead><tr><th>Cover</th><th>Name</th><th>Type</th><th>Category</th><th>Year</th><th>Rating</th><th>Uploader</th><th>Actions</th></tr></thead>'+
      '<tbody>'+movies.slice().reverse().map(function(m){return'<tr>'+
        '<td><img src="'+h(m.cover)+'" style="width:32px;height:44px;object-fit:cover;border-radius:3px;background:var(--bg2)" onerror="this.style.display=\'none\'"></td>'+
        '<td><strong style="font-size:.8rem">'+h(m.name)+'</strong></td>'+
        '<td>'+cap(m.type)+'</td><td>'+cap(m.category)+'</td><td>'+h(m.year)+'</td><td>'+h(m.rating||'—')+'</td>'+
        '<td style="font-size:.69rem;color:var(--t2)">'+h(m.uploaderGmail||'admin')+'</td>'+
        '<td style="display:flex;gap:3px;padding:7px 11px">'+
        '<button class="ab2 ab2-bl" onclick="aEdit(\''+m.id+'\')">✏️</button>'+
        '<button class="ab2 ab2-red" onclick="aDel(\''+m.id+'\',\''+h(m.name)+'\')">🗑</button>'+
        '</td></tr>';}).join('')+
      '</tbody></table></div></div>';
  });
}

function mFH(m){
  var lb=function(t){return'<label style="display:block;font-size:.68rem;color:var(--t2);margin-bottom:3px;font-weight:600;text-transform:uppercase;letter-spacing:.3px">'+t+'</label>';};
  return'<h3 style="margin-bottom:13px">'+(m?'✏️ Edit: '+h(m.name):'➕ Add New Content')+'</h3><div class="fgrid">'+
    '<div class="fg">'+lb('Title *')+'<input class="af2" id="mfN" value="'+h(m?m.name:'')+'" placeholder="Title"></div>'+
    '<div class="fg">'+lb('Year')+'<input class="af2" id="mfY" type="number" value="'+(m?h(m.year):new Date().getFullYear())+'"></div>'+
    '<div class="fg">'+lb('Type')+'<select class="af2" id="mfT">'+ALL_TYPES.map(function(t){return'<option value="'+t+'"'+(m&&m.type===t?' selected':'')+'>'+cap(t)+'</option>';}).join('')+'</select></div>'+
    '<div class="fg">'+lb('Category')+'<select class="af2" id="mfC">'+ALL_CATS.map(function(c){return'<option value="'+c+'"'+(m&&m.category===c?' selected':'')+'>'+cap(c)+'</option>';}).join('')+'</select></div>'+
    '<div class="fg full">'+lb('Cover Image URL')+'<input class="af2" id="mfCov" value="'+h(m?m.cover:'')+'" placeholder="https://…/poster.jpg"></div>'+
    '<div class="fg full">'+lb('Video URL (YouTube / Drive / MP4 / Vimeo)')+'<input class="af2" id="mfVid" value="'+h(m?m.videoURL:'')+'" placeholder="https://youtube.com/watch?v=…"></div>'+
    '<div class="fg full">'+lb('Download URL (direct MP4 link)')+'<input class="af2" id="mfDl" value="'+h(m?m.downloadURL:'')+'" placeholder="https://…/video.mp4"></div>'+
    '<div class="fg full">'+lb('Description / Synopsis')+'<textarea class="af2" id="mfDesc" rows="3" placeholder="Synopsis…">'+h(m?m.description:'')+'</textarea></div>'+
    '<div class="fg">'+lb('Country')+'<input class="af2" id="mfCo" value="'+h(m?m.country:'')+'" placeholder="USA"></div>'+
    '<div class="fg">'+lb('Rating (e.g. 8.2)')+'<input class="af2" id="mfRat" value="'+h(m?m.rating:'')+'" placeholder="7.5"></div>'+
    '<div class="fg">'+lb('Season')+'<input class="af2" id="mfSeas" value="'+h(m?m.season:'')+'" placeholder="1"></div>'+
    '<div class="fg">'+lb('Episode')+'<input class="af2" id="mfEp" value="'+h(m?m.episode:'')+'" placeholder="1"></div>'+
    '<div class="fg full" style="display:flex;gap:20px;flex-wrap:wrap">'+
    '<label style="display:flex;gap:6px;align-items:center;cursor:pointer;font-size:.79rem"><input type="checkbox" id="mfNew"'+(m&&m.isNew?' checked':'')+'>  New Release</label>'+
    '<label style="display:flex;gap:6px;align-items:center;cursor:pointer;font-size:.79rem"><input type="checkbox" id="mfFeat"'+(m&&m.featured?' checked':'')+'>  Hero Banner Featured</label>'+
    '</div></div><div class="fa-row">'+
    '<button class="ab2 ab2-red" onclick="aSave()">'+(m?'💾 Update Movie':'➕ Add Movie')+'</button>'+
    (m?'<button class="ab2" onclick="aCancelEdit()">✕ Cancel</button>':'')+
    '</div>';
}

function aEdit(id){api('getMovie',{id:id},function(r){if(!r.ok){toast(r.msg,'terr');return;}_editId=id;document.getElementById('mfw').innerHTML=mFH(r.movie);document.getElementById('mfw').scrollIntoView({behavior:'smooth'});});}
function aCancelEdit(){_editId=null;document.getElementById('mfw').innerHTML=mFH(null);}

function aSave(){
  var d={token:TOKEN,name:(document.getElementById('mfN').value||'').trim(),year:document.getElementById('mfY').value,type:document.getElementById('mfT').value,category:document.getElementById('mfC').value,cover:(document.getElementById('mfCov').value||'').trim(),videoURL:(document.getElementById('mfVid').value||'').trim(),downloadURL:(document.getElementById('mfDl').value||'').trim(),description:(document.getElementById('mfDesc').value||'').trim(),country:(document.getElementById('mfCo').value||'').trim(),rating:(document.getElementById('mfRat').value||'').trim(),season:(document.getElementById('mfSeas').value||'').trim(),episode:(document.getElementById('mfEp').value||'').trim(),isNew:document.getElementById('mfNew').checked,featured:document.getElementById('mfFeat').checked};
  if(!d.name){toast('Name is required','terr');return;}
  if(_editId)d.id=_editId;
  api(_editId?'updateMovie':'addMovie',d,function(r){if(r.ok){toast(r.msg,'tok');_editId=null;aMovies();}else toast(r.msg,'terr');});
}

function aDel(id,name){if(!confirm('Delete "'+name+'"? This cannot be undone.'))return;api('deleteMovie',{token:TOKEN,id:id},function(r){if(r.ok){toast('Deleted','tok');aMovies();}else toast(r.msg,'terr');});}

// ── USERS ─────────────────────────────────────────────────
function aUsers(){
  api('getUsers',{token:TOKEN},function(r){
    if(!r.ok){aErr(r.msg);return;}
    var users=r.users||[];
    document.getElementById('aBody').innerHTML='<div class="atw"><div class="ath"><h3>👥 Users ('+users.length+')</h3></div>'+
      '<div style="overflow-x:auto"><table class="dt"><thead><tr><th>Name</th><th>Gmail</th><th>Country</th><th>Comments</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>'+
      '<tbody>'+users.map(function(u){var st=u.status||'active';return'<tr>'+
        '<td><strong>'+h(u.name)+'</strong></td>'+
        '<td style="color:var(--blue)">'+h(u.gmail)+'</td>'+
        '<td>'+h(u.country||'—')+'</td>'+
        '<td style="text-align:center">'+u.commentCount+'</td>'+
        '<td><span class="'+(st==='active'?'s-ok':'s-bl')+'">'+cap(st)+'</span></td>'+
        '<td style="font-size:.72rem">'+fmtDate(u.created)+'</td>'+
        '<td style="display:flex;gap:3px;padding:7px 11px">'+
        (st==='active'?'<button class="ab2 ab2-red" onclick="aSetSt(\''+u.id+'\',\'blocked\')">Block</button>':'<button class="ab2" style="color:var(--green);border-color:rgba(43,166,64,.25)" onclick="aSetSt(\''+u.id+'\',\'active\')">Unblock</button>')+
        '<button class="ab2 ab2-red" onclick="aDelU(\''+u.id+'\',\''+h(u.name)+'\')">Delete</button>'+
        '</td></tr>';}).join('')+
      '</tbody></table></div></div>';
  });
}
function aSetSt(id,st){api('setUserStatus',{token:TOKEN,id:id,status:st},function(r){if(r.ok){toast('Status updated','tok');aUsers();}else toast(r.msg,'terr');});}
function aDelU(id,nm){if(!confirm('Delete "'+nm+'"?'))return;api('deleteUser',{token:TOKEN,id:id},function(r){if(r.ok){toast('Deleted','tok');aUsers();}else toast(r.msg,'terr');});}

// ── COMMENTS ──────────────────────────────────────────────
function aComments(){
  api('getAllComments',{token:TOKEN},function(r){
    if(!r.ok){aErr(r.msg);return;}
    var list=r.comments||[];
    document.getElementById('aBody').innerHTML='<div class="atw"><div class="ath"><h3>💬 All Comments ('+list.length+')</h3></div>'+
      '<div style="overflow-x:auto"><table class="dt"><thead><tr><th>User</th><th>Movie ID</th><th>Comment</th><th>Date</th><th></th></tr></thead>'+
      '<tbody>'+list.map(function(c){
        var init=(c.name||c.gmail||'?')[0].toUpperCase();
        var avatarHTML;
        if(c.avatar&&c.avatar.trim()){
          avatarHTML=
            '<div class="cmt-av cmt-av-img" style="width:28px;height:28px;min-width:28px;min-height:28px;border-radius:50%;overflow:hidden;position:relative;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;margin-right:6px;background:transparent;">'+
              '<img src="'+h(c.avatar)+'" alt="'+init+'" style="width:28px;height:28px;object-fit:cover;border-radius:50%;display:block;" '+
                   'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\'">'+
              '<span class="cmt-av-fallback" style="display:none;position:absolute;top:0;left:0;width:100%;height:100%;background:var(--red,#cc0000);color:#fff;display:grid;place-items:center;font-size:.7rem;font-weight:700;">'+init+'</span>'+
            '</div>';
        }else{
          avatarHTML='<div class="cmt-av" style="width:28px;height:28px;min-width:28px;min-height:28px;border-radius:50%;background:var(--red,#cc0000);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;vertical-align:middle;margin-right:6px;">'+init+'</div>';
        }

        return '<tr>'+
          '<td>'+avatarHTML+'<span style="vertical-align:middle;">'+h(c.name||c.gmail)+'</span></td>'+
          '<td style="font-size:.7rem;color:var(--t2)">'+h(c.movieId)+'</td>'+
          '<td>'+h(c.emoji||'💬')+' '+h((c.comment||'').substring(0,60))+'</td>'+
          '<td style="font-size:.7rem">'+fmtDate(c.date)+'</td>'+
          '<td><button class="ab2 ab2-red" onclick="aDelCmt(\''+c.id+'\')">Delete</button></td>'+
          '</tr>';
      }).join('')+
      '</tbody></table></div></div>';
  });
}
function aDelCmt(id){if(!confirm('Delete comment?'))return;api('deleteComment',{token:TOKEN,id:id},function(r){if(r.ok){toast('Deleted','tok');aComments();}else toast(r.msg,'terr');});}

// ── NOTIFICATIONS ─────────────────────────────────────────
function aNotif(){
  api('getNotifications',{gmail:''},function(r){
    var list=r.notifications||[];
    document.getElementById('aBody').innerHTML=
      '<div class="aform2" style="margin-bottom:16px">'+
      '<h3>📤 Send Notification to All Users</h3>'+
      '<div class="fg" style="margin-bottom:10px"><label style="font-size:.68rem;color:var(--t2);font-weight:600;text-transform:uppercase;display:block;margin-bottom:3px">Title</label><input class="af2" id="ntT" placeholder="e.g. New movies added!"></div>'+
      '<div class="fg" style="margin-bottom:10px"><label style="font-size:.68rem;color:var(--t2);font-weight:600;text-transform:uppercase;display:block;margin-bottom:3px">Message</label><textarea class="af2" id="ntM" rows="3" placeholder="Your message to all users…"></textarea></div>'+
      '<div class="fg" style="margin-bottom:10px"><label style="font-size:.68rem;color:var(--t2);font-weight:600;text-transform:uppercase;display:block;margin-bottom:3px">Type</label>'+
      '<select class="af2" id="ntTy" style="max-width:220px"><option value="info">ℹ️ Info</option><option value="new">✨ New Content</option><option value="download">📱 App Download</option></select></div>'+
      '<div class="fa-row"><button class="ab2 ab2-red" onclick="aSendNotif()">📤 Send to All Users</button></div></div>'+
      '<div class="atw"><div class="ath"><h3>Sent Notifications ('+list.length+')</h3></div>'+
      '<div style="overflow-x:auto"><table class="dt"><thead><tr><th>Title</th><th>Message</th><th>Type</th><th>Date</th><th></th></tr></thead>'+
      '<tbody>'+list.map(function(n){return'<tr>'+
        '<td><strong>'+h(n.title)+'</strong></td>'+
        '<td>'+h((n.message||'').substring(0,55))+'</td>'+
        '<td>'+cap(n.type)+'</td>'+
        '<td style="font-size:.7rem">'+fmtDate(n.date)+'</td>'+
        '<td><button class="ab2 ab2-red" onclick="aDelNotif(\''+n.id+'\')">Delete</button></td>'+
        '</tr>';}).join('')+
      '</tbody></table></div></div>';
  });
}

function aSendNotif(){
  var t=(document.getElementById('ntT').value||'').trim();
  var m=(document.getElementById('ntM').value||'').trim();
  var ty=document.getElementById('ntTy').value;
  if(!t||!m){toast('Fill title and message','terr');return;}
  api('addNotification',{token:TOKEN,title:t,message:m,type:ty},function(r){
    if(r.ok){toast('Notification sent to all users! 🔔','tok');aNotif();}else toast(r.msg,'terr');
  });
}

function aDelNotif(id){if(!confirm('Delete notification?'))return;api('deleteNotification',{token:TOKEN,id:id},function(r){if(r.ok){toast('Deleted','tok');aNotif();}else toast(r.msg,'terr');});}

// ── PAGES ─────────────────────────────────────────────────
function aPages(){
  api('getPages',{},function(r){
    var pages=r.pages||{};
    document.getElementById('aBody').innerHTML='<div class="aform2">'+
      '<h3 style="margin-bottom:16px">📄 Edit Site Pages</h3>'+
      ['contact','about','follow'].map(function(key){
        var pg=pages[key]||{title:cap(key)+' Us',content:''};
        return'<div style="margin-bottom:22px;padding-bottom:20px;border-bottom:1px solid var(--brd)">'+
          '<p style="font-size:.8rem;font-weight:700;margin-bottom:10px;color:var(--red)">📌 '+cap(key)+' Page</p>'+
          '<div class="fg" style="margin-bottom:9px"><label style="font-size:.68rem;color:var(--t2);font-weight:600;text-transform:uppercase;display:block;margin-bottom:3px">Page Title</label><input class="af2" id="pt-'+key+'" value="'+h(pg.title||'')+'"></div>'+
          '<div class="fg" style="margin-bottom:9px"><label style="font-size:.68rem;color:var(--t2);font-weight:600;text-transform:uppercase;display:block;margin-bottom:3px">Content</label><textarea class="af2" id="pc-'+key+'" rows="4" placeholder="Page content…">'+h(pg.content||'')+'</textarea></div>'+
          '<button class="ab2 ab2-red" onclick="aSavePage(\''+key+'\')">💾 Save '+cap(key)+' Page</button>'+
          '</div>';}).join('')+
      '</div>';
  });
}

function aSavePage(key){
  var tit=(document.getElementById('pt-'+key).value||'').trim();
  var con=(document.getElementById('pc-'+key).value||'').trim();
  api('savePage',{token:TOKEN,key:key,title:tit,content:con},function(r){
    if(r.ok)toast(r.msg,'tok');else toast(r.msg,'terr');
  });
}

// ── TRAFFIC ───────────────────────────────────────────────
function aTraffic(){
  api('getTraffic',{token:TOKEN},function(r){
    if(!r.ok){aErr(r.msg);return;}
    var list=r.traffic||[];
    var items=list.map(function(t){return'<div class="tf">'+
      '<span class="tf-t">'+fmtDate(t.timestamp)+'</span>'+
      '<span class="tf-u">'+h(t.user)+'</span>'+
      '<span class="tf-a">'+h(t.action)+'</span>'+
      '<span style="color:var(--t2);font-size:.71rem">'+h(t.country||'—')+'</span>'+
      '<span style="color:var(--t3);font-size:.69rem">'+h(t.details||'')+'</span>'+
      '</div>';}).join('');
    document.getElementById('aBody').innerHTML='<div class="atw"><div class="ath"><h3>📈 Traffic Log ('+list.length+' entries)</h3></div>'+
      '<div style="padding:0 14px 14px">'+
      (items||'<p style="padding:16px;color:var(--t2)">No traffic data yet.</p>')+
      '</div></div>';
  });
}

// ── SETTINGS ──────────────────────────────────────────────
function aSettings(){
  api('getSettings',{},function(r){
    var s=r.settings||{};
    document.getElementById('aBody').innerHTML='<div class="aform2"><h3 style="margin-bottom:16px">⚙️ Site Settings</h3>'+
      '<div class="fgrid">'+
      '<div class="fg"><label style="font-size:.68rem;color:var(--t2);font-weight:600;text-transform:uppercase;display:block;margin-bottom:3px">Site Name</label><input class="af2" id="ss-n" value="'+h(s['site_name']||'KEYTUBE')+'"></div>'+
      '<div class="fg"><label style="font-size:.68rem;color:var(--t2);font-weight:600;text-transform:uppercase;display:block;margin-bottom:3px">New Admin Password (blank=keep)</label><input class="af2" type="password" id="ss-p" placeholder="Leave blank to keep"></div>'+
      '<div class="fg"><label style="font-size:.68rem;color:var(--t2);font-weight:600;text-transform:uppercase;display:block;margin-bottom:3px">Monetization Threshold (followers)</label><input class="af2" id="ss-mt" value="'+h(s['monetize_threshold']||'1000')+'"></div>'+
      '<div class="fg full"><label style="font-size:.68rem;color:var(--t2);font-weight:600;text-transform:uppercase;display:block;margin-bottom:3px">Favicon URL</label><input class="af2" id="ss-fav" value="'+h(s['favicon_url']||'')+'" placeholder="https://…/icon.png"></div>'+
      '<div class="fg full"><label style="font-size:.68rem;color:var(--t2);font-weight:600;text-transform:uppercase;display:block;margin-bottom:3px">Background Image URL</label><input class="af2" id="ss-bg" value="'+h(s['background_url']||'')+'" placeholder="https://…/bg.jpg"></div>'+
      '<div class="fg full"><label style="font-size:.68rem;color:var(--t2);font-weight:600;text-transform:uppercase;display:block;margin-bottom:3px">📱 Mobile App Download URL</label><input class="af2" id="ss-app" value="'+h(s['app_download_url']||'')+'" placeholder="https://…/keytube.apk"></div>'+
      '<div class="fg full"><label style="font-size:.68rem;color:var(--t2);font-weight:600;text-transform:uppercase;display:block;margin-bottom:3px">Ads Top (HTML/script)</label><textarea class="af2" id="ss-at" rows="3">'+h(s['ads_top']||'')+'</textarea></div>'+
      '<div class="fg full"><label style="font-size:.68rem;color:var(--t2);font-weight:600;text-transform:uppercase;display:block;margin-bottom:3px">Ads Middle</label><textarea class="af2" id="ss-am" rows="3">'+h(s['ads_middle']||'')+'</textarea></div>'+
      '<div class="fg full"><label style="font-size:.68rem;color:var(--t2);font-weight:600;text-transform:uppercase;display:block;margin-bottom:3px">Ads Bottom</label><textarea class="af2" id="ss-ab" rows="3">'+h(s['ads_bottom']||'')+'</textarea></div>'+
      '</div><div class="fa-row" style="margin-top:13px"><button class="ab2 ab2-red" onclick="aSaveSettings()">💾 Save All Settings</button></div></div>';
  });
}

function aSaveSettings(){
  var sett={'site_name':(document.getElementById('ss-n').value||'').trim(),'favicon_url':(document.getElementById('ss-fav').value||'').trim(),'background_url':(document.getElementById('ss-bg').value||'').trim(),'app_download_url':(document.getElementById('ss-app').value||'').trim(),'ads_top':document.getElementById('ss-at').value,'ads_middle':document.getElementById('ss-am').value,'ads_bottom':document.getElementById('ss-ab').value,'monetize_threshold':(document.getElementById('ss-mt').value||'1000').trim()};
  var np=document.getElementById('ss-p').value;if(np)sett['admin_password']=np;
  api('updateSettings',{token:TOKEN,settings:sett},function(r){if(r.ok)toast(r.msg||'Settings saved!','tok');else toast(r.msg||'Error','terr');});
}

function aErr(msg){document.getElementById('aBody').innerHTML='<div class="aerr" style="padding:18px;color:var(--red);font-size:.84rem">❌ '+h(msg)+'</div>';}
