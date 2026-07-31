/* ════════════════════════════════════════════════════════════════
   KEYTUBE — Comments Module (app/comments.js)
   ════════════════════════════════════════════════════════════════ */

/**
 * Get public comments for a specific movie/video
 * @param {string} movieId 
 * @returns {Promise<Object>}
 */
async function getMovieComments(movieId) {
  if (!movieId) return { ok: false, comments: [] };

  return await apiFetch({
    action: "getComments",
    movieId: movieId
  });
}

/**
 * Post a new comment on a video
 * @param {string} movieId 
 * @param {string} commentText 
 * @param {string} emoji - Optional reaction emoji
 * @returns {Promise<Object>}
 */
async function postComment(movieId, commentText, emoji = "💬") {
  const user = getSessionUser();
  if (!user) {
    showToast("Please log in to leave a comment.", "error");
    return { ok: false, msg: "Not authenticated" };
  }

  if (!commentText || !commentText.trim()) {
    showToast("Comment cannot be empty.", "error");
    return { ok: false, msg: "Empty comment" };
  }

  const res = await apiFetch({
    action: "addComment",
    gmail: user.gmail,
    name: user.name || user.gmail.split("@")[0],
    movieId: movieId,
    comment: commentText.trim(),
    emoji: emoji
  });

  if (res.ok) {
    showToast("Comment posted!", "success");
  } else {
    showToast(res.msg || "Failed to post comment.", "error");
  }

  return res;
}

/**
 * Delete a comment (Soft-delete status in database)
 * @param {string} commentId 
 * @returns {Promise<Object>}
 */
async function deleteUserComment(commentId) {
  const user = getSessionUser();
  if (!user) {
    showToast("Please log in.", "error");
    return { ok: false };
  }

  const res = await apiFetch({
    action: "deleteComment",
    id: commentId,
    gmail: user.gmail
  });

  if (res.ok) {
    showToast("Comment deleted.", "info");
  } else {
    showToast(res.msg || "Failed to delete comment.", "error");
  }

  return res;
}

/**
 * Get all comments posted across videos uploaded by the logged-in creator
 * @returns {Promise<Object>}
 */
async function getMyVideoComments() {
  const user = getSessionUser();
  if (!user) return { ok: false, comments: [] };

  return await apiFetch({
    action: "getMyVideoComments",
    gmail: user.gmail
  });
}
