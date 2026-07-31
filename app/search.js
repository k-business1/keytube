/* ════════════════════════════════════════════════════════════════
   KEYTUBE — Search Module (app/search.js)
   ════════════════════════════════════════════════════════════════ */

/**
 * Execute search query against backend movie database
 * @param {string} query - Keyword or phrase to search
 * @returns {Promise<Object>} - Returns { ok: true, exact: [...], similar: [...] }
 */
async function executeSearch(query) {
  if (!query || !query.trim()) {
    return { ok: true, exact: [], similar: [] };
  }

  const user = getSessionUser();

  const res = await apiFetch({
    action: "searchMovies",
    query: query.trim(),
    isLoggedIn: !!user
  });

  if (!res.ok) {
    showToast(res.msg || "Error executing search.", "error");
  }

  return res;
}
