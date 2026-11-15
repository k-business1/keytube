
/* AGASOBANUYE SEARCH API
   KEYTUBE integration helper
*/

var AGASOBANUYE_API =
"https://script.google.com/macros/s/AKfycbw7ZJti1bq2RcsKwie-yZNsFQofVXEDIVoJtJBEoVjxb-twhEhEbL2PtT1cQFsUub_W/exec";

var AgasobanuSearch = (function () {

  /* -------------------------
     API REQUEST
  ------------------------- */

  function request(params) {
    var url = AGASOBANUYE_API + "?" +
      new URLSearchParams(params).toString();

    return fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error(
            "AGASOBANUYE HTTP " + response.status
          );
        }

        return response.json();
      })
      .then(function (result) {
        if (!result || typeof result !== "object") {
          throw new Error("Invalid API response");
        }

        if (result.success === false) {
          throw new Error(
            result.message || "API request failed"
          );
        }

        return result;
      });
  }

  /* -------------------------
     NORMALIZE MOVIE
  ------------------------- */

  function normalizeMovie(movie) {
    movie = movie || {};

    return {
      source: "agasobanuye",
      id: movie.id || "",
      title: movie.title || "",
      slug: movie.slug || "",
      description: movie.description || "",
      poster: movie.poster || movie.imgUrl || "",
      category: movie.category || "",
      type: movie.type || "",
      year: movie.year || "",
      trailerUrl: movie.trailerUrl || "",
      linksCount: Number(movie.linksCount) || 0
    };
  }

  /* -------------------------
     NORMALIZE PART LINKS
  ------------------------- */

  function normalizePart(part, index) {
    part = part || {};

    return {
      id: part.id || "",
      name: part.name ||
            part.title ||
            ("Part " + String.fromCharCode(65 + index)),

      embedUrl:
        part.embedUrl ||
        part.embed_url ||
        "",

      directUrl:
        part.directUrl ||
        part.direct_url ||
        part.downloadUrl ||
        part.download_url ||
        ""
    };
  }

  /* -------------------------
     SEARCH MOVIES
  ------------------------- */

  function search(query, size) {
    if (!query || !String(query).trim()) {
      return Promise.resolve([]);
    }

    return request({
      action: "search",
      q: String(query).trim(),
      page: 0,
      size: size || 10
    }).then(function (result) {

      var movies = Array.isArray(result.movies)
        ? result.movies
        : Array.isArray(result.data)
          ? result.data
          : [];

      return movies.map(normalizeMovie);
    });
  }

  /* -------------------------
     GET MOVIE DETAILS
  ------------------------- */

  function getMovie(slug) {
    if (!slug) {
      return Promise.reject(
        new Error("Movie slug is required")
      );
    }

    return request({
      action: "movie",
      slug: slug
    }).then(function (result) {

      var movie = result.movie || result.data || {};

      var movieParts = Array.isArray(movie.parts)
        ? movie.parts
        : [];

      var responseParts = Array.isArray(result.parts)
        ? result.parts
        : [];

      // Prefer movie.parts when it contains data.
      // Otherwise use the separate result.parts array.
      var rawParts = movieParts.length
        ? movieParts
        : responseParts;

      var normalized = normalizeMovie(movie);

      normalized.slug = normalized.slug || slug;

      normalized.parts = rawParts
        .map(normalizePart)
        .filter(function (part) {
          return part.embedUrl || part.directUrl;
        });

      return normalized;
    });
  }

  /* -------------------------
     PUBLIC API
  ------------------------- */

  return {
    search: search,
    getMovie: getMovie
  };

})();
