/* AGASOBANUYE SEARCH API
   KEYTUBE integration helper
*/

var AGASOBANUYE_API =
"https://script.google.com/macros/s/AKfycbw7ZJti1bq2RcsKwie-yZNsFQofVXEDIVoJtJBEoVjxb-twhEhEbL2PtT1cQFsUub_W/exec";

var AgasobanuSearch = (function () {

  function request(params) {
    var url = AGASOBANUYE_API + "?" + new URLSearchParams(params).toString();

    return fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("AGASOBANUYE HTTP " + response.status);
        }
        return response.json();
      })
      .then(function (result) {
        if (!result || typeof result !== "object") {
          throw new Error("Invalid API response");
        }
        if (result.success === false) {
          throw new Error(result.message || "API request failed");
        }
        return result;
      });
  }

  function stripHtml(text) {
    return String(text || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeMovie(movie) {
    movie = movie || {};
    return {
      source: "agasobanuye",
      id: movie.id || "",
      title: movie.title || "",
      slug: movie.slug || "",
      description: stripHtml(movie.description),
      poster: movie.poster || movie.imgUrl || "",
      category: movie.category || "",
      type: movie.type || "",
      year: movie.year || "",
      trailerUrl: movie.trailerUrl || "",
      linksCount: Number(movie.linksCount) || 0
    };
  }

  function normalizePart(part, index) {
    part = part || {};
    return {
      id: part.id || "",
      name: part.name || part.title || ("Part " + String.fromCharCode(65 + index)),
      embedUrl: part.embedUrl || part.embed_url || "",
      directUrl: part.directUrl || part.direct_url || part.downloadUrl || part.download_url || ""
    };
  }

  function findList(o, depth) {
    if (Array.isArray(o)) return o;
    if (!o || typeof o !== "object" || depth > 3) return null;
    var keys = ["movies", "content", "results", "items", "data", "list", "rows"];
    for (var i = 0; i < keys.length; i++) {
      if (o[keys[i]] !== undefined) {
        var f = findList(o[keys[i]], depth + 1);
        if (f) return f;
      }
    }
    return null;
  }

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
      var movies = findList(result, 0) || [];
      return movies.map(normalizeMovie);
    });
  }

  function getMovie(slug) {
    if (!slug) {
      return Promise.reject(new Error("Movie slug is required"));
    }
    return request({
      action: "movie",
      slug: slug
    }).then(function (result) {
      var movie = result.movie || result.data || {};
      var movieParts = Array.isArray(movie.parts) ? movie.parts : [];
      var responseParts = Array.isArray(result.parts) ? result.parts : [];
      var rawParts = movieParts.length ? movieParts : responseParts;

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

  return {
    search: search,
    getMovie: getMovie
  };

})();
