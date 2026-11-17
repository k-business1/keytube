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

  function pickUrl(part, keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = part[keys[i]];
      if (typeof v === "string" && v.trim()) {
        var m = v.match(/src=["']([^"']+)["']/i); // iframe HTML -> src
        return (m ? m[1] : v).trim();
      }
    }
    return "";
  }

  function normalizePart(part, index) {
    if (typeof part === "string") part = { url: part };
    part = part || {};
    var embed = pickUrl(part, ["embedUrl", "embed_url", "embed", "iframe", "iframeUrl", "iframe_url", "url", "link", "src", "videoUrl", "video_url", "streamUrl", "stream_url", "player"]);
    var direct = pickUrl(part, ["directUrl", "direct_url", "downloadUrl", "download_url", "download", "file", "mp4"]);
    return {
      id: part.id || "",
      name: part.name || part.title || ("Part " + String.fromCharCode(65 + index)),
      embedUrl: embed,
      directUrl: direct
    };
  }

  /* Walk any JSON and collect video links (embed pages or direct files) */
  function deepCollectParts(root) {
    var found = [], seen = {};
    var skipKeys = /^(poster|imgUrl|img|image|cover|thumbnail|trailerUrl|avatar|icon)$/i;
    function isVideoLink(s) {
      return /^https?:\/\//i.test(s) &&
        !/\.(jpe?g|png|gif|webp|svg)(\?.*)?$/i.test(s);
    }
    function add(url, name, isDirect) {
      var m = String(url).match(/src=["']([^"']+)["']/i);
      url = (m ? m[1] : url).trim();
      if (!isVideoLink(url) || seen[url]) return;
      seen[url] = 1;
      found.push({
        id: "",
        name: name || ("Part " + String.fromCharCode(65 + found.length)),
        embedUrl: isDirect ? "" : url,
        directUrl: isDirect ? url : ""
      });
    }
    function walk(o, depth) {
      if (depth > 6 || o == null) return;
      if (Array.isArray(o)) { o.forEach(function (x) { walk(x, depth + 1); }); return; }
      if (typeof o !== "object") return;
      var label = o.name || o.title || "";
      Object.keys(o).forEach(function (k) {
        var v = o[k];
        if (typeof v === "string") {
          if (skipKeys.test(k)) return;
          var direct = /\.(mp4|webm|ogg|mkv|mov)(\?.*)?$/i.test(v);
          if (/^https?:\/\//i.test(v.trim()) || /<iframe/i.test(v)) add(v, label, direct);
        } else {
          walk(v, depth + 1);
        }
      });
    }
    walk(root, 0);
    return found;
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
      console.log("AGASOBANUYE raw movie response:", result); // check this in the console
      var movie = result.movie || result.data || {};
      var candidates = [
        movie.parts, result.parts, movie.links, result.links,
        movie.sources, result.sources, movie.videos, result.videos,
        movie.episodes, result.episodes
      ];
      var rawParts = [];
      for (var i = 0; i < candidates.length; i++) {
        if (Array.isArray(candidates[i]) && candidates[i].length) {
          rawParts = candidates[i];
          break;
        }
      }

      var normalized = normalizeMovie(movie);
      normalized.slug = normalized.slug || slug;
      normalized.parts = rawParts
        .map(normalizePart)
        .filter(function (part) {
          return part.embedUrl || part.directUrl;
        });

      /* Fallback: scan the whole response for any video-looking links */
      if (!normalized.parts.length) {
        normalized.parts = deepCollectParts(result);
        console.log("AGASOBANUYE deep-scan parts:", normalized.parts);
      }
      return normalized;
    });
  }

  return {
    search: search,
    getMovie: getMovie
  };

})();
