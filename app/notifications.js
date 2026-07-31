/* ════════════════════════════════════════════════════════════════
   KEYTUBE — Notifications Module (app/notifications.js)
   ════════════════════════════════════════════════════════════════ */

/**
 * Fetch top notifications for the site / user
 * @returns {Promise<Object>}
 */
async function fetchNotifications() {
  const user = getSessionUser();
  
  return await apiFetch({
    action: "getNotifications",
    gmail: user ? user.gmail : ""
  });
}

/**
 * Mark a notification as read by the current user
 * @param {string} notifId 
 * @returns {Promise<Object>}
 */
async function markNotificationAsRead(notifId) {
  const user = getSessionUser();
  if (!user) return { ok: false, msg: "Not authenticated" };

  if (!notifId) return { ok: false, msg: "Missing notification ID" };

  return await apiFetch({
    action: "markNotifRead",
    notifId: notifId,
    gmail: user.gmail
  });
}
