// ── notifications.js ─────────────────────────────────────────

function loadNotifications(){
  var u = getUser(); if(!u) return;
  api('getNotifications', {gmail: u.gmail}, function(r){
    if(!r.ok) return;
    var list = r.notifications || [];
    var unread = list.filter(function(n){ return !n.isRead; });
    var dot = document.getElementById('notifDot');
    
    // Check if new unread notifications arrived to trigger a WhatsApp-like alert
    checkAndShowPopup(unread);

    if(dot) dot.className = 'notif-dot' + (unread.length ? ' on' : '');
    var nl = document.getElementById('notifList'); if(!nl) return;
    nl.innerHTML = '';
    if(!list.length){
      nl.innerHTML = '<div style="padding:16px;text-align:center;font-size:.8rem;color:var(--t2)">No notifications</div>';
      return;
    }
    list.forEach(function(n){
      var d = document.createElement('div');
      d.className = 'np-item' + (n.isRead ? '' : ' unread');
      var icons = {download: '📱', new: '✨', info: '🔔'};
      d.innerHTML = '<div class="np-title">' + (icons[n.type] || '🔔') + ' ' + h(n.title) + '</div>' +
        '<div class="np-msg">' + h(n.message) + '</div>' +
        '<div class="np-date">' + fmtDate(n.date) + '</div>';
      d.onclick = function(){
        if(!n.isRead){
          api('markNotifRead', {gmail: u.gmail, notifId: n.id}, null);
          d.classList.remove('unread');
          var remaining = nl.querySelectorAll('.unread').length;
          if(!remaining && dot) dot.classList.remove('on');
        }
      };
      nl.appendChild(d);
    });
  });
}

// Track previous unread count to detect incoming alerts
var previousUnreadCount = -1;

function checkAndShowPopup(unreadList) {
  var currentCount = unreadList.length;
  if (previousUnreadCount !== -1 && currentCount > previousUnreadCount) {
    var latest = unreadList[0];
    if (latest) {
      showWhatsAppStyleToast(latest.title, latest.message);
    }
  }
  previousUnreadCount = currentCount;
}

// WhatsApp-like floating toast notification visible even outside keytube active focus
function showWhatsAppStyleToast(title, message) {
  // Check Browser Native Push Notification first if permitted
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(title, { body: message, icon: '/favicon.ico' });
      return;
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(function (permission) {
        if (permission === "granted") {
          new Notification(title, { body: message, icon: '/favicon.ico' });
          return;
        }
      });
    }
  }

  // Fallback DOM Toast if native notifications aren't enabled
  var existingToast = document.getElementById('waToastNotification');
  if (existingToast) existingToast.remove();

  var toast = document.createElement('div');
  toast.id = 'waToastNotification';
  toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#23272a;color:#fff;padding:12px 16px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:99999;max-width:300px;border-left:4px solid #25d366;font-family:inherit;animation:fadeInOut 4s ease;';
  toast.innerHTML = '<div style="font-weight:bold;font-size:0.9rem;margin-bottom:4px;display:flex;align-items:center;gap:6px;">✨ ' + h(title) + '</div>' +
    '<div style="font-size:0.8rem;color:#b9bbbe;line-height:1.2;">' + h(message) + '</div>';

  document.body.appendChild(toast);
  setTimeout(function(){
    if (toast.parentElement) toast.remove();
  }, 4000);
}

function toggleNotif(){
  var np = document.getElementById('notifPanel'); if(!np) return;
  np.classList.toggle('open');
  if(np.classList.contains('open')) loadNotifications();
}

function markAllRead(){
  var u = getUser(); if(!u) return;
  api('getNotifications', {gmail: u.gmail}, function(r){
    (r.notifications || []).filter(function(n){ return !n.isRead; }).forEach(function(n){
      api('markNotifRead', {gmail: u.gmail, notifId: n.id}, null);
    });
    setTimeout(loadNotifications, 500);
    var dot = document.getElementById('notifDot'); if(dot) dot.classList.remove('on');
    previousUnreadCount = 0;
  });
}

// Background polling every 12 seconds to check for new notifications automatically
setInterval(function(){
  var u = getUser();
  if (u) {
    loadNotifications();
  }
}, 12000);