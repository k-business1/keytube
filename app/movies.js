/* ════════════════════════════════════════════════════════════════
   KEYTUBE — Movies & Video Module (app/movies.js)
   ════════════════════════════════════════════════════════════════ */

/**
 * Fetch list of movies/videos with optional filtering (category, type, etc.)
 * @param {Object} filters - Optional query parameters (category, type, etc.)
 * @returns {Promise<Object>}
 */
async function fetchMovies(filters = {}) {
  const user = getSessionUser();
  const payload = {
    action: "getMovies",
    isLoggedIn: !!user,
    ...filters
  };
  return await apiFetch(payload);
}

/**
 * Fetch single video details by ID
 * @param {string} id - The movie/video ID
 * @returns {Promise<Object>}
 */
async function fetchMovieDetails(id) {
  if (!id) return { ok: false, msg: "Missing video ID" };
  return await apiFetch({ action: "getMovie", id: id });
}

/**
 * Upload/Add a new movie or video
 * @param {Object} movieData - Properties: name, type, category, coverUrl, videoUrl, downloadUrl, description, year, country, isNew, season, episode, featured, language, rating
 * @returns {Promise<Object>}
 */
async function uploadMovie(movieData) {
  const user = getSessionUser();
  if (!user) {
    showToast("You must be logged in to upload content.", "error");
    return { ok: false, msg: "Not authenticated" };
  }

  const res = await apiFetch({
    action: "addMovie",
    uploaderGmail: user.gmail,
    ...movieData
  });

  if (res.ok) {
    showToast("Video uploaded successfully!", "success");
  } else {
    showToast(res.msg || "Failed to upload video.", "error");
  }

  return res;
}

/**
 * Update existing movie metadata
 * @param {string} movieId 
 * @param {Object} updateData 
 * @returns {Promise<Object>}
 */
async function updateMovie(movieId, updateData) {
  const user = getSessionUser();
  if (!user) {
    showToast("You must be logged in.", "error");
    return { ok: false };
  }

  const res = await apiFetch({
    action: "updateMovie",
    id: movieId,
    uploaderGmail: user.gmail,
    ...updateData
  });

  if (res.ok) {
    showToast("Video updated successfully!", "success");
  } else {
    showToast(res.msg || "Failed to update video.", "error");
  }

  return res;
}

/**
 * Delete a movie/video
 * @param {string} movieId 
 * @returns {Promise<Object>}
 */
async function deleteMovie(movieId) {
  const user = getSessionUser();
  if (!user) {
    showToast("You must be logged in.", "error");
    return { ok: false };
  }

  if (!confirm("Are you sure you want to delete this video?")) {
    return { ok: false, msg: "Cancelled" };
  }

  const res = await apiFetch({
    action: "deleteMovie",
    id: movieId,
    uploaderGmail: user.gmail
  });

  if (res.ok) {
    showToast("Video deleted.", "success");
  } else {
    showToast(res.msg || "Failed to delete video.", "error");
  }

  return res;
}

/**
 * Toggle like or unlike on a video
 * @param {string} movieId 
 * @param {boolean} currentlyLiked - Current like state on UI
 * @returns {Promise<Object>}
 */
async function toggleLikeMovie(movieId, currentlyLiked) {
  const user = getSessionUser();
  if (!user) {
    showToast("Please log in to like videos.", "error");
    return { ok: false };
  }

  const action = currentlyLiked ? "unlikeMovie" : "likeMovie";
  const res = await apiFetch({
    action: action,
    gmail: user.gmail,
    movieId: movieId
  });

  if (res.ok) {
    showToast(currentlyLiked ? "Removed like" : "Video liked!", "success");
  }

  return res;
}

/**
 * Fetch total likes count for a specific movie
 * @param {string} movieId 
 * @returns {Promise<Object>}
 */
async function fetchMovieLikes(movieId) {
  const user = getSessionUser();
  return await apiFetch({
    action: "getMovieLikes",
    movieId: movieId,
    gmail: user ? user.gmail : ""
  });
}

/**
 * Log a view event when player starts playing
 * @param {string} movieId 
 * @returns {Promise<Object>}
 */
async function recordView(movieId) {
  const user = getSessionUser();
  return await apiFetch({
    action: "logView",
    movieId: movieId,
    gmail: user ? user.gmail : "guest"
  });
}

/**
 * Get total view stats for a movie
 * @param {string} movieId 
 * @returns {Promise<Object>}
 */
async function fetchMovieViews(movieId) {
  return await apiFetch({
    action: "getMovieViews",
    movieId: movieId
  });
}
