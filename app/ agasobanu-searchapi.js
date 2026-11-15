/* AGASOBANUYE SEARCH API */

var AGASOBANUYE_API = 
"https://script.google.com/macros/s/AKfycbw7ZJti1bq2RcsKwie-yZNsFQofVXEDIVoJtJBEoVjxb-twhEhEbL2PtT1cQFsUub_W/exec";

var AgasobanuSearch = (function () {

  function request(params) {
    var url = AGASOBANUYE_API + "?" +
      new URLSearchParams(params).toString();

    return fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("AGASOBANUYE HTTP " + response.status);
        }
        return response.json();
      })
      .then(function (result) {
        if (!result.success) {
          throw new Error(result.message || "API request failed");
        }
        return result;
      });
  }

  function search(query, size) {
    return request({
      action: "search",
      q: query,
      page: 0,
      size: size || 10
    }).then(function (result) {
      var movies = result.movies || result.data || [];

      return movies.map(function (movie) {
        return {
          source: "agasobanuye",
          id: movie.id,
          title: movie.title || "",
          slug: movie.slug || "",
          description: movie.description || "",
          poster: movie.poster || movie.imgUrl || "",
          category: movie.category || "",
          type: movie.type || "",
          year: movie.year || "",
          linksCount: movie.linksCount || 0
        };
      });
    });
  }

  function getMovie(slug) {
    return request({
      action: "movie",
      slug: slug
    }).then(function (result) {
      var movie = result.movie || result.data || {};

      return {
        source: "agasobanuye",
        id: movie.id,
        title: movie.title || "",
        slug: movie.slug || slug,
        description: movie.description || "",
        poster: movie.poster || movie.imgUrl || "",
        trailerUrl: movie.trailerUrl || "",
        parts: movie.parts || result.parts || []
      };
    });
  }

  return {
    search: search,
    getMovie: getMovie
  };

})();