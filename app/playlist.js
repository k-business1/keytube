/* ════════════════════════════════════════════════════════════════
   KEYTUBE — Playlist & Saved Content Module (app/playlist.js)
   ════════════════════════════════════════════════════════════════ */

/**
 * Fetch all saved movies/videos in the current user's playlist
 * @returns {Promise<Object>}
 */
async function getUserPlaylist() {
  const user = getSessionUser();
  if (!user) {
    return { ok: false, msg: "Not authenticated", movies: [] };
  }

  return await apiFetch({
    action: "getPlaylist",
    gmail: user.gmail
  });
}

/**
 * Add a video to the user's saved playlist
 * @param {string} movieId 
 * @returns {Promise<Object>}
 */
async function addToPlaylist(movieId) {
  const user = getSessionUser();
  if (!user) {
    showToast("Please log in to save videos to your playlist.", "error");
    return { ok: false, msg: "Not authenticated" };
  }

  if (!movieId) {
    showToast("Invalid movie ID.", "error");
    return { ok: false };
  }

  const res = await apiFetch({
    action: "addToPlaylist",
    gmail: user.gmail,
    movieId: movieId
  });

  if (res.ok) {
    showToast("Added to your playlist!", "success");
  } else {
    showToast(res.msg || "Failed to add to playlist.", "error");
  }

  return res;
}

/**
 * Remove a video from the user's saved playlist
 * @param {string} movieId 
 * @returns {Promise<Object>}
 */
async function removeFromPlaylist(movieId) {
  const user = getSessionUser();
  if (!user) {
    showToast("Please log in.", "error");
    return { ok: false, msg: "Not authenticated" };
  }

  const res = await apiFetch({
    action: "removeFromPlaylist",
    gmail: user.gmail,
    movieId: movieId
  });

  if (res.ok) {
    showToast("Removed from playlist.", "info");
  } else {
    showToast(res.msg || "Failed to remove from playlist.", "error");
  }

  return res;
}
