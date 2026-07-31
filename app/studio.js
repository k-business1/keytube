/* ════════════════════════════════════════════════════════════════
   KEYTUBE — Creator Studio Module (app/studio.js)
   ════════════════════════════════════════════════════════════════ */

/**
 * Fetch channel profile for the currently logged-in user
 * @returns {Promise<Object>}
 */
async function getMyChannelDetails() {
  const user = getSessionUser();
  if (!user) {
    return { ok: false, msg: "Not authenticated" };
  }

  return await apiFetch({
    action: "getMyChannel",
    gmail: user.gmail
  });
}

/**
 * Create or update creator channel profile
 * @param {Object} channelData - Properties: name, handle, avatar, banner, bio, socialLinks
 * @returns {Promise<Object>}
 */
async function saveChannelProfile(channelData) {
  const user = getSessionUser();
  if (!user) {
    showToast("You must be logged in.", "error");
    return { ok: false, msg: "Not authenticated" };
  }

  // Check if channel already exists to trigger create or update action
  const existing = await getMyChannelDetails();
  const action = (existing.ok && existing.channel) ? "updateChannel" : "createChannel";

  const res = await apiFetch({
    action: action,
    gmail: user.gmail,
    ...channelData
  });

  if (res.ok) {
    showToast("Channel profile saved successfully!", "success");
  } else {
    showToast(res.msg || "Failed to save channel profile.", "error");
  }

  return res;
}

/**
 * Fetch analytics data for creator dashboard (views, likes, subscriber counts, 30-day trends)
 * @returns {Promise<Object>}
 */
async function fetchStudioAnalytics() {
  const user = getSessionUser();
  if (!user) {
    return { ok: false, msg: "Not authenticated" };
  }

  return await apiFetch({
    action: "getChannelStats",
    gmail: user.gmail
  });
}

/**
 * Fetch creator earnings (paid and pending totals)
 * @returns {Promise<Object>}
 */
async function fetchCreatorEarnings() {
  const user = getSessionUser();
  if (!user) {
    return { ok: false, msg: "Not authenticated" };
  }

  return await apiFetch({
    action: "getEarnings",
    gmail: user.gmail
  });
}
