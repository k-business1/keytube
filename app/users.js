/* ════════════════════════════════════════════════════════════════
   KEYTUBE — Users & Channels Module (app/users.js)
   ════════════════════════════════════════════════════════════════ */

/**
 * Get public channel details by Gmail address or handle
 * @param {string} targetGmailOrHandle 
 * @returns {Promise<Object>}
 */
async function fetchChannel(targetGmailOrHandle) {
  if (!targetGmailOrHandle) return { ok: false, msg: "Missing identifier" };

  return await apiFetch({
    action: "getChannel",
    gmail: targetGmailOrHandle
  });
}

/**
 * Follow/Subscribe to a creator's channel
 * @param {string} targetChannelGmail 
 * @returns {Promise<Object>}
 */
async function followChannel(targetChannelGmail) {
  const user = getSessionUser();
  if (!user) {
    showToast("Please sign in to subscribe to channels.", "error");
    return { ok: false, msg: "Not authenticated" };
  }

  if (user.gmail === targetChannelGmail) {
    showToast("You cannot subscribe to your own channel.", "error");
    return { ok: false, msg: "Self follow forbidden" };
  }

  const res = await apiFetch({
    action: "followChannel",
    gmail: user.gmail,
    channelGmail: targetChannelGmail
  });

  if (res.ok) {
    showToast("Subscribed to channel!", "success");
  } else {
    showToast(res.msg || "Failed to subscribe.", "error");
  }

  return res;
}

/**
 * Unfollow/Unsubscribe from a creator's channel
 * @param {string} targetChannelGmail 
 * @returns {Promise<Object>}
 */
async function unfollowChannel(targetChannelGmail) {
  const user = getSessionUser();
  if (!user) {
    showToast("Please sign in to manage subscriptions.", "error");
    return { ok: false, msg: "Not authenticated" };
  }

  const res = await apiFetch({
    action: "unfollowChannel",
    gmail: user.gmail,
    channelGmail: targetChannelGmail
  });

  if (res.ok) {
    showToast("Unsubscribed from channel.", "info");
  } else {
    showToast(res.msg || "Failed to unsubscribe.", "error");
  }

  return res;
}

/**
 * Get follower list or total follower count for a channel
 * @param {string} channelGmail 
 * @returns {Promise<Object>}
 */
async function fetchChannelFollowers(channelGmail) {
  const user = getSessionUser();
  return await apiFetch({
    action: "getFollowers",
    channelGmail: channelGmail,
    gmail: user ? user.gmail : ""
  });
}
