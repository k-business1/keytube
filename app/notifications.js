// ── notifications.js ─────────────────────────────────────────
function loadNotifications(){
  var u=getUser();if(!u)return;
  api('getNotifications',{gmail:u.gmail},function(r){
    if(!r.ok)return;
    var list=r.notifications||[];
    var unread=list.filter(function(n){return !n.isRead;});
    var dot=document.getElementById('notifDot');
    if(dot)dot.className='notif-dot'+(unread.length?' on':'');
    var nl=document.getElementById('notifList');if(!nl)return;
    nl.innerHTML='';
    if(!list.length){nl.innerHTML='<div style="padding:16px;text-align:center;font-size:.8rem;color:var(--t2)">No notifications</div>';return;}
    list.forEach(function(n){
      var d=document.createElement('div');
      d.className='np-item'+(n.isRead?'':' unread');
      var icons={download:'📱',new:'✨',info:'🔔'};
      d.innerHTML='<div class="np-title">'+(icons[n.type]||'🔔')+' '+h(n.title)+'</div>'+
        '<div class="np-msg">'+h(n.message)+'</div>'+
        '<div class="np-date">'+fmtDate(n.date)+'</div>';
      d.onclick=function(){
        if(!n.isRead){
          api('markNotifRead',{gmail:u.gmail,notifId:n.id},null);
          d.classList.remove('unread');
          var remaining=nl.querySelectorAll('.unread').length;
          if(!remaining&&dot)dot.classList.remove('on');
        }
      };
      nl.appendChild(d);
    });
  });
}

function toggleNotif(){
  var np=document.getElementById('notifPanel');if(!np)return;
  np.classList.toggle('open');
  if(np.classList.contains('open'))loadNotifications();
}

function markAllRead(){
  var u=getUser();if(!u)return;
  api('getNotifications',{gmail:u.gmail},function(r){
    (r.notifications||[]).filter(function(n){return !n.isRead;}).forEach(function(n){
      api('markNotifRead',{gmail:u.gmail,notifId:n.id},null);
    });
    setTimeout(loadNotifications,500);
    var dot=document.getElementById('notifDot');if(dot)dot.classList.remove('on');
  });
}
