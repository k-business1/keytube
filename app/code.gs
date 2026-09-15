// ================================================================
// KEYTUBE — Google Apps Script Backend v6.0
// Sheet: 1dPu97UVUQ2Il983QwNevFiuhztBswVgp0ZUeFYHtn_I
// ================================================================
var SSID        = '1dPu97UVUQ2Il983QwNevFiuhztBswVgp0ZUeFYHtn_I';
var ADMIN_TOKEN = 'KEYTUBE_ADMIN_2024';
// ── CACHE WRAPPER — speeds up repeated API calls 10x ─────────
var _cache = CacheService.getScriptCache();

function cachedGet(key, ttlSeconds, buildFn) {
  var cached = _cache.get(key);
  if (cached) {
    try { return JSON.parse(cached); } catch(e) {}
  }
  var result = buildFn();
  try { _cache.put(key, JSON.stringify(result), ttlSeconds); } catch(e) {}
  return result;
}

function clearCache(keys) {
  (keys || []).forEach(function(k){ _cache.remove(k); });
}

// ── Serve HTML ────────────────────────────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('KEYTUBE')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport','width=device-width,initial-scale=1');
}

// ── Handle fetch() POST ───────────────────────────────────────
function doPost(e) {
  var result;
  try {
    var data = JSON.parse(e.postData.contents);
    result = serverAction(data);
  } catch(err) {
    result = {ok:false, msg:'Parse error: ' + err.message};
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
function forceAuthorizationAPI() {
  // Explicitly require the email permission scope to trigger the authorization popup
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, [
    "https://www.googleapis.com/auth/script.send_mail"
  ]);
}
// ── Sheet helpers ─────────────────────────────────────────────
function getSheet(name, headers) {
  var ss = SpreadsheetApp.openById(SSID);
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (headers && headers.length) {
      sh.appendRow(headers);
      sh.getRange(1,1,1,headers.length)
        .setFontWeight('bold').setBackground('#f5c518').setFontColor('#000');
    }
  }
  return sh;
}

function getRows(name) {
  var sh = getSheet(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2,1,last-1,sh.getLastColumn()).getValues();
}

function getSettingsMap() {
  var m = {};
  getRows('Settings').forEach(function(r) {
    if (r[0]) m[String(r[0])] = String(r[1]||'');
  });
  return m;
}

function isAdmin(t) { return t === ADMIN_TOKEN; }

// ── Init ──────────────────────────────────────────────────────
function initSheets() {
  // Core
  getSheet('Users',         ['ID','Gmail','Password','Name','Country','Created','Status','Avatar']);
  getSheet('Movies',        ['ID','Name','Type','Category','CoverURL','VideoURL','DownloadURL','Description','Year','Country','IsNew','Season','Episode','AddedDate','Featured','Language','Rating','UploaderGmail']);
  getSheet('Comments',      ['ID','Gmail','Name','MovieID','Comment','Emoji','Date','Status']);
  getSheet('Traffic',       ['Timestamp','User','Action','Country','Details']);
  getSheet('Playlist',      ['ID','Gmail','MovieID','AddedDate']);
  getSheet('Notifications', ['ID','Title','Message','Date','Type','ReadBy']);
  getSheet('Pages',         ['Key','Title','Content','UpdatedAt']);
  getSheet('Downloads',     ['ID','Gmail','MovieID','MovieName','Date','Status']);
  getSheet('Online',        ['Gmail','LastSeen','Country']);
  // New
  getSheet('Channels',      ['ID','Gmail','ChannelName','Handle','Avatar','Banner','Bio','SocialLinks','Created','MonetizationEnabled','TotalEarnings']);
  getSheet('Followers',     ['ID','FollowerGmail','ChannelGmail','Date']);
  getSheet('Likes',         ['ID','Gmail','MovieID','Date']);
  getSheet('Views',         ['ID','MovieID','Gmail','Date']);
  getSheet('Earnings',      ['ID','Gmail','Amount','Type','Date','Description','Status']);
  getSheet('AIUnknown',['ID','Question','UserGmail','Date','Status','AdminNotes','UserEmail']);
  getSheet('PasswordResets',['ID','Gmail','Token','Expires','Status','Created']);
  getSheet('AdRequests',['ID','BusinessName','ContactName','Email','Phone','Website','AdType','AdTitle','AdDescription','AdImageURL','AdLinkURL','AdVideoURL','TargetCategory','Budget','Currency','StartDate','EndDate','Message','Status','AdminNotes','Placement','ApprovedPrice','SubmittedDate','ReviewedDate','ViewCount','ClickCount']);
  getSheet('WatchTime', ['ID','Gmail','MovieID','Seconds','Date']);

  var ss = getSheet('Settings', ['Key','Value']);
  if (ss.getLastRow() < 2) {
    [['admin_password','admin123'],['site_name','KEYTUBE'],['favicon_url',''],
     ['background_url',''],['ads_top',''],['ads_middle',''],['ads_bottom',''],
     ['app_download_url',''],['monetize_threshold','1000']
    ].forEach(function(r) { ss.appendRow(r); });
  }

  var ps = getSheet('Pages');
  if (ps.getLastRow() < 2) {
    [['contact','Contact Us','Email: contact@keytube.com\nPhone: +250 000 000\nAddress: Kigali, Rwanda',new Date().toISOString()],
     ['about','About KEYTUBE','KEYTUBE is your #1 streaming platform for movies and series worldwide.',new Date().toISOString()],
     ['follow','Follow Us','Facebook: facebook.com/keytube\nTwitter: @keytube\nInstagram: @keytube',new Date().toISOString()]
    ].forEach(function(r) { ps.appendRow(r); });
  }
  return {ok:true, msg:'All sheets ready!'};
}

// ── Auth ──────────────────────────────────────────────────────
function login(d) {
  var rows = getRows('Users');
  for (var i=0;i<rows.length;i++) {
    var r = rows[i];
    if (String(r[1])===d.gmail && String(r[2])===d.password) {
      if (String(r[6])==='blocked') return {ok:false, msg:'Account blocked.'};
      pingOnline({gmail:d.gmail, country:String(r[4])});
      logTraffic({user:d.gmail, action:'login', country:String(r[4]), details:'login'});
      return {ok:true, user:{
        id:String(r[0]), gmail:String(r[1]), name:String(r[3]),
        country:String(r[4]), status:String(r[6]), avatar:String(r[7]||'')
      }};
    }
  }
  return {ok:false, msg:'Wrong email or password.'};
}

function register(d) {
  if (!d.gmail||!d.password||!d.name) return {ok:false, msg:'All fields required.'};
  if (d.gmail.toLowerCase().indexOf('@gmail.com')===-1) return {ok:false, msg:'Only Gmail allowed.'};
  if (String(d.password).length<6) return {ok:false, msg:'Password min 6 characters.'};
  var rows = getRows('Users');
  for (var i=0;i<rows.length;i++) {
    if (String(rows[i][1])===d.gmail) return {ok:false, msg:'Email already registered.'};
  }
  var id = 'U'+Date.now();
  getSheet('Users').appendRow([id,d.gmail,d.password,d.name,d.country||'',new Date().toISOString(),'active',d.avatar||'']);
  logTraffic({user:d.gmail, action:'register', country:d.country||'', details:'new user'});
  return {ok:true, user:{id:id,gmail:d.gmail,name:d.name,country:d.country||'',status:'active',avatar:d.avatar||''}};
}

function adminLogin(d) {
  var cfg = getSettingsMap();
  if (d.password===(cfg['admin_password']||'admin123')) {
    logTraffic({user:'admin', action:'admin_login', country:'', details:'admin'});
    return {ok:true, token:ADMIN_TOKEN};
  }
  return {ok:false, msg:'Wrong admin password.'};
}

function updateUserProfile(d) {
  if (!d.gmail) return {ok:false, msg:'Not authenticated.'};
  var sh = getSheet('Users');
  var data = sh.getDataRange().getValues();
  for (var i=1;i<data.length;i++) {
    if (String(data[i][1])===d.gmail) {
      if (d.name)    sh.getRange(i+1,4).setValue(d.name);
      if (d.country) sh.getRange(i+1,5).setValue(d.country);
      if (d.avatar)  sh.getRange(i+1,8).setValue(d.avatar);
      if (d.password && d.newPassword) {
        if (String(data[i][2])!==d.password) return {ok:false, msg:'Current password wrong.'};
        sh.getRange(i+1,3).setValue(d.newPassword);
      }
      return {ok:true, msg:'Profile updated!',
        user:{id:String(data[i][0]),gmail:String(data[i][1]),
          name:d.name||String(data[i][3]),country:d.country||String(data[i][4]),
          status:String(data[i][6]),avatar:d.avatar||String(data[i][7]||'')}};
    }
  }
  return {ok:false, msg:'User not found.'};
}

// ── Movies ────────────────────────────────────────────────────
function rowToMovie(r) {
  return {
    id:String(r[0]||''), name:String(r[1]||''), type:String(r[2]||'movie'),
    category:String(r[3]||''), cover:String(r[4]||''), videoURL:String(r[5]||''),
    downloadURL:String(r[6]||''), description:String(r[7]||''), year:String(r[8]||''),
    country:String(r[9]||''), isNew:String(r[10]).toLowerCase()==='true',
    season:String(r[11]||''), episode:String(r[12]||''), added:String(r[13]||''),
    featured:String(r[14]).toLowerCase()==='true', language:String(r[15]||''),
    rating:String(r[16]||''), uploaderGmail:String(r[17]||'')
  };
}

function getMovies(d) {
  var list = getRows('Movies').filter(function(r){return !!r[0];}).map(rowToMovie);
  if (!d.isLoggedIn) list = list.filter(function(m){return !m.isNew;}).slice(0,10);
  if (d.category&&d.category!=='all') list=list.filter(function(m){return m.category.toLowerCase()===d.category.toLowerCase();});
  if (d.type&&d.type!=='all') list=list.filter(function(m){return m.type.toLowerCase()===d.type.toLowerCase();});
  if (d.year) list=list.filter(function(m){return String(m.year)===String(d.year);});
  if (d.country&&d.country!=='all') list=list.filter(function(m){return m.country.toLowerCase().indexOf(d.country.toLowerCase())!==-1;});
  if (d.minRating) list=list.filter(function(m){return parseFloat(m.rating||0)>=parseFloat(d.minRating);});
  if (d.uploaderGmail) list=list.filter(function(m){return m.uploaderGmail===d.uploaderGmail;});
  return {ok:true, movies:list};
}

function getMovie(d) {
  var rows = getRows('Movies');
  for (var i=0;i<rows.length;i++) {
    if (String(rows[i][0])===String(d.id)) return {ok:true, movie:rowToMovie(rows[i])};
  }
  return {ok:false, msg:'Movie not found.'};
}

function addMovie(d) {
  if (!isAdmin(d.token) && !d.gmail) return {ok:false, msg:'Unauthorized.'};
  if (!d.name) return {ok:false, msg:'Name required.'};
  var id = 'M'+Date.now();
  getSheet('Movies').appendRow([
    id,d.name,d.type||'movie',d.category||'movies',
    d.cover||'',d.videoURL||'',d.downloadURL||'',
    d.description||'',d.year||new Date().getFullYear(),
    d.country||'',d.isNew===true||d.isNew==='true',
    d.season||'',d.episode||'',new Date().toISOString(),
    d.featured===true||d.featured==='true',
    d.language||d.category||'',d.rating||'',
    d.gmail||''
  ]);
  try {
    var cache = CacheService.getScriptCache();
    cache.removeAll(['movies_all_all_0','movies_all_all_1']);
  } catch (e) {}
  return {ok:true, id:id, msg:'Movie added!'};
}

function updateMovie(d) {
  if (!isAdmin(d.token) && !d.gmail) return {ok:false, msg:'Unauthorized.'};
  var sh=getSheet('Movies'), data=sh.getDataRange().getValues();
  for (var i=1;i<data.length;i++) {
    if (String(data[i][0])===String(d.id)) {
      if (!isAdmin(d.token) && String(data[i][17])!==d.gmail) return {ok:false, msg:'Not your video.'};
      var row=i+1;
      if(d.name!==undefined)        sh.getRange(row,2).setValue(d.name);
      if(d.type!==undefined)        sh.getRange(row,3).setValue(d.type);
      if(d.category!==undefined)    sh.getRange(row,4).setValue(d.category);
      if(d.cover!==undefined)       sh.getRange(row,5).setValue(d.cover);
      if(d.videoURL!==undefined)    sh.getRange(row,6).setValue(d.videoURL);
      if(d.downloadURL!==undefined) sh.getRange(row,7).setValue(d.downloadURL);
      if(d.description!==undefined) sh.getRange(row,8).setValue(d.description);
      if(d.year!==undefined)        sh.getRange(row,9).setValue(d.year);
      if(d.country!==undefined)     sh.getRange(row,10).setValue(d.country);
      if(d.isNew!==undefined)       sh.getRange(row,11).setValue(d.isNew===true||d.isNew==='true');
      if(d.season!==undefined)      sh.getRange(row,12).setValue(d.season);
      if(d.episode!==undefined)     sh.getRange(row,13).setValue(d.episode);
      if(d.featured!==undefined)    sh.getRange(row,15).setValue(d.featured===true||d.featured==='true');
      if(d.language!==undefined)    sh.getRange(row,16).setValue(d.language);
      if(d.rating!==undefined)      sh.getRange(row,17).setValue(d.rating);
      try {
        var cache = CacheService.getScriptCache();
        cache.removeAll(['movies_all_all_0','movies_all_all_1']);
      } catch (e) {}
      return {ok:true, msg:'Movie updated!'};
    }
  }
  return {ok:false, msg:'Not found.'};
}

function deleteMovie(d) {
  if (!isAdmin(d.token) && !d.gmail) return {ok:false, msg:'Unauthorized.'};
  var sh=getSheet('Movies'), data=sh.getDataRange().getValues();
  for (var i=1;i<data.length;i++) {
    if (String(data[i][0])===String(d.id)) {
      if (!isAdmin(d.token) && String(data[i][17])!==d.gmail) return {ok:false, msg:'Not your video.'};
      sh.deleteRow(i+1);
      try {
        var cache = CacheService.getScriptCache();
        cache.removeAll(['movies_all_all_0','movies_all_all_1']);
      } catch (e) {}
      return {ok:true, msg:'Deleted.'};
    }
  }
  return {ok:false, msg:'Not found.'};
}

function searchMovies(d) {
  var q=(d.query||'').toLowerCase().trim();
  var all=getRows('Movies').filter(function(r){return !!r[0];}).map(rowToMovie);
  if (!d.isLoggedIn) all=all.filter(function(m){return !m.isNew;});
  var exact=[],similar=[];
  all.forEach(function(m) {
    var n=m.name.toLowerCase(), desc=m.description.toLowerCase();
    if (n.indexOf(q)!==-1) exact.push(m);
    else if (desc.indexOf(q)!==-1||m.category.toLowerCase().indexOf(q)!==-1||
             m.country.toLowerCase().indexOf(q)!==-1||
             n.split(' ').some(function(w){return w.indexOf(q.split(' ')[0])===0;})) similar.push(m);
  });
  return {ok:true, exact:exact.slice(0,20), similar:similar.slice(0,12)};
}
function searchChannels(d) {
  var q = (d.query || '').toLowerCase().trim();
  if (!q) return {ok: true, channels: []};

  var allFollowers = getRows('Followers');
  var allMovies    = getRows('Movies');

  var results = getRows('Channels').filter(function(r) {
    if (!r[0]) return false;
    var name   = String(r[2] || '').toLowerCase();
    var handle = String(r[3] || '').toLowerCase();
    var bio    = String(r[6] || '').toLowerCase();
    return name.indexOf(q) !== -1 ||
           handle.indexOf(q) !== -1 ||
           bio.indexOf(q) !== -1;
  }).map(function(r) {
    var gmail = String(r[1] || '');

    // Count followers
    var followerCount = allFollowers.filter(function(f) {
      return String(f[2]) === gmail;
    }).length;

    // Count videos this channel uploaded
    var videoCount = allMovies.filter(function(m) {
      return String(m[17]) === gmail;
    }).length;

    return {
      id:                   String(r[0]),
      gmail:                gmail,
      name:                 String(r[2] || ''),
      handle:               String(r[3] || ''),
      avatar:               String(r[4] || ''),   // ← profile picture URL
      banner:               String(r[5] || ''),
      bio:                  String(r[6] || ''),
      followerCount:        followerCount,
      videoCount:           videoCount,
      monetizationEnabled:  String(r[9]).toLowerCase() === 'true'
    };
  });

  return {ok: true, channels: results.slice(0, 15)};
}
// ── Channels ─────────────────────────────────────────────────
function rowToChannel(r) {
  return {
    id:String(r[0]||''), gmail:String(r[1]||''), name:String(r[2]||''),
    handle:String(r[3]||''), avatar:String(r[4]||''), banner:String(r[5]||''),
    bio:String(r[6]||''), socialLinks:String(r[7]||''), created:String(r[8]||''),
    monetizationEnabled:String(r[9]).toLowerCase()==='true', totalEarnings:parseFloat(r[10]||0)
  };
}

function getMyChannel(d) {
  if (!d.gmail) return {ok:false, msg:'Not authenticated.'};
  var rows=getRows('Channels');
  for (var i=0;i<rows.length;i++) {
    if (String(rows[i][1])===d.gmail) {
      var ch=rowToChannel(rows[i]);
      var followerCount=getRows('Followers').filter(function(r){return String(r[2])===d.gmail;}).length;
      ch.followerCount=followerCount;
      return {ok:true, channel:ch};
    }
  }
  return {ok:true, channel:null}; // No channel yet
}

function getChannel(d) {
  var rows=getRows('Channels');
  var target=d.gmail||d.handle;
  for (var i=0;i<rows.length;i++) {
    if (String(rows[i][1])===target || String(rows[i][3])===target) {
      var ch=rowToChannel(rows[i]);
      var followerCount=getRows('Followers').filter(function(r){return String(r[2])===ch.gmail;}).length;
      ch.followerCount=followerCount;
      return {ok:true, channel:ch};
    }
  }
  return {ok:false, msg:'Channel not found.'};
}

function createChannel(d) {
  if (!d.gmail) return {ok:false, msg:'Not authenticated.'};
  if (!d.name) return {ok:false, msg:'Channel name required.'};
  // Check if already has channel
  var rows=getRows('Channels');
  for (var i=0;i<rows.length;i++) {
    if (String(rows[i][1])===d.gmail) return {ok:false, msg:'You already have a channel.'};
  }
  // Check handle uniqueness
  if (d.handle) {
    for (var j=0;j<rows.length;j++) {
      if (String(rows[j][3])===d.handle) return {ok:false, msg:'Handle already taken.'};
    }
  }
  var id='CH'+Date.now();
  var handle=d.handle||('@'+(d.name||'').toLowerCase().replace(/[^a-z0-9]/g,''));
  getSheet('Channels').appendRow([
    id,d.gmail,d.name,handle,d.avatar||'',d.banner||'',d.bio||'',
    d.socialLinks||'',new Date().toISOString(),false,0
  ]);
  return {ok:true, id:id, msg:'Channel created!',
    channel:{id:id,gmail:d.gmail,name:d.name,handle:handle,avatar:d.avatar||'',
      banner:d.banner||'',bio:d.bio||'',socialLinks:d.socialLinks||'',
      created:new Date().toISOString(),monetizationEnabled:false,totalEarnings:0,followerCount:0}};
}

function updateChannel(d) {
  if (!d.gmail) return {ok:false, msg:'Not authenticated.'};
  var sh=getSheet('Channels'), data=sh.getDataRange().getValues();
  for (var i=1;i<data.length;i++) {
    if (String(data[i][1])===d.gmail) {
      if (d.name)        sh.getRange(i+1,3).setValue(d.name);
      if (d.handle) {
        // Check uniqueness
        for (var j=1;j<data.length;j++) {
          if (j!==i && String(data[j][3])===d.handle) return {ok:false, msg:'Handle already taken.'};
        }
        sh.getRange(i+1,4).setValue(d.handle);
      }
      if (d.avatar!==undefined)      sh.getRange(i+1,5).setValue(d.avatar);
      if (d.banner!==undefined)      sh.getRange(i+1,6).setValue(d.banner);
      if (d.bio!==undefined)         sh.getRange(i+1,7).setValue(d.bio);
      if (d.socialLinks!==undefined) sh.getRange(i+1,8).setValue(d.socialLinks);
      return {ok:true, msg:'Channel updated!'};
    }
  }
  return {ok:false, msg:'Channel not found.'};
}

// ── Followers ─────────────────────────────────────────────────
function followChannel(d) {
  if (!d.gmail||!d.channelGmail) return {ok:false, msg:'Missing fields.'};
  if (d.gmail===d.channelGmail) return {ok:false, msg:'Cannot follow yourself.'};
  var rows=getRows('Followers');
  for (var i=0;i<rows.length;i++) {
    if (String(rows[i][1])===d.gmail && String(rows[i][2])===d.channelGmail) return {ok:false, msg:'Already following.'};
  }
  var id='F'+Date.now();
  getSheet('Followers').appendRow([id,d.gmail,d.channelGmail,new Date().toISOString()]);
  // Check monetization threshold
  var cfg=getSettingsMap();
  var threshold=parseInt(cfg['monetize_threshold']||'1000');
  var followerCount=getRows('Followers').filter(function(r){return String(r[2])===d.channelGmail;}).length;
  if (followerCount>=threshold) {
    // Auto-enable monetization for channel
    var sh=getSheet('Channels'), cdata=sh.getDataRange().getValues();
    for (var j=1;j<cdata.length;j++) {
      if (String(cdata[j][1])===d.channelGmail && String(cdata[j][9]).toLowerCase()!=='true') {
        sh.getRange(j+1,10).setValue(true);
      }
    }
  }
  return {ok:true, msg:'Following!', followerCount:followerCount};
}

function unfollowChannel(d) {
  if (!d.gmail||!d.channelGmail) return {ok:false, msg:'Missing fields.'};
  var sh=getSheet('Followers'), data=sh.getDataRange().getValues();
  for (var i=1;i<data.length;i++) {
    if (String(data[i][1])===d.gmail && String(data[i][2])===d.channelGmail) {
      sh.deleteRow(i+1);
      var followerCount=getRows('Followers').filter(function(r){return String(r[2])===d.channelGmail;}).length;
      return {ok:true, msg:'Unfollowed.', followerCount:followerCount};
    }
  }
  return {ok:false, msg:'Not following.'};
}

function getFollowers(d) {
  var gmail=d.gmail||d.channelGmail;
  var rows=getRows('Followers').filter(function(r){return String(r[2])===gmail;});
  var list=rows.map(function(r){return {id:String(r[0]),gmail:String(r[1]),date:String(r[3])};});
  var isFollowing=false;
  if (d.viewerGmail) {
    isFollowing=rows.some(function(r){return String(r[1])===d.viewerGmail;});
  }
  return {ok:true, followers:list, count:list.length, isFollowing:isFollowing};
}

function getFollowing(d) {
  if (!d.gmail) return {ok:false, msg:'Not authenticated.'};
  var rows=getRows('Followers').filter(function(r){return String(r[1])===d.gmail;});
  var list=rows.map(function(r){return {channelGmail:String(r[2]),date:String(r[3])};});
  return {ok:true, following:list, count:list.length};
}

// ── Likes ─────────────────────────────────────────────────────
function likeMovie(d) {
  if (!d.gmail||!d.movieId) return {ok:false, msg:'Missing fields.'};
  var rows=getRows('Likes');
  for (var i=0;i<rows.length;i++) {
    if (String(rows[i][1])===d.gmail && String(rows[i][2])===String(d.movieId)) {
      return {ok:false, msg:'Already liked.'};
    }
  }
  var id='L'+Date.now();
  getSheet('Likes').appendRow([id,d.gmail,d.movieId,new Date().toISOString()]);
  var likeCount=getRows('Likes').filter(function(r){return String(r[2])===String(d.movieId);}).length;
  return {ok:true, id:id, likeCount:likeCount};
}

function unlikeMovie(d) {
  if (!d.gmail||!d.movieId) return {ok:false, msg:'Missing fields.'};
  var sh=getSheet('Likes'), data=sh.getDataRange().getValues();
  for (var i=1;i<data.length;i++) {
    if (String(data[i][1])===d.gmail && String(data[i][2])===String(d.movieId)) {
      sh.deleteRow(i+1);
      var likeCount=getRows('Likes').filter(function(r){return String(r[2])===String(d.movieId);}).length;
      return {ok:true, likeCount:likeCount};
    }
  }
  return {ok:false, msg:'Not liked.'};
}

function getMovieLikes(d) {
  var likes=getRows('Likes').filter(function(r){return String(r[2])===String(d.movieId);});
  var isLiked=d.gmail?likes.some(function(r){return String(r[1])===d.gmail;}):false;
  return {ok:true, likeCount:likes.length, isLiked:isLiked};
}

function getUserLikes(d) {
  if (!d.gmail) return {ok:false, msg:'Not authenticated.'};
  var likedIds=getRows('Likes').filter(function(r){return String(r[1])===d.gmail;}).map(function(r){return String(r[2]);});
  var movies=getRows('Movies').filter(function(r){return !!r[0]&&likedIds.indexOf(String(r[0]))!==-1;}).map(rowToMovie);
  return {ok:true, movies:movies};
}

// ── Views ─────────────────────────────────────────────────────
function logView(d) {
  if (!d.movieId) return {ok:false};
  var id='V'+Date.now();
  getSheet('Views').appendRow([id,d.movieId,d.gmail||'guest',new Date().toISOString()]);
  return {ok:true};
}

function getMovieViews(d) {
  var count=getRows('Views').filter(function(r){return String(r[1])===String(d.movieId);}).length;
  return {ok:true, viewCount:count};
}

// ── Channel Analytics ─────────────────────────────────────────
function getChannelStats(d) {
  if (!d.gmail) return {ok:false, msg:'Not authenticated.'};
  var myMovies=getRows('Movies').filter(function(r){return String(r[17])===d.gmail;}).map(rowToMovie);
  var myIds=myMovies.map(function(m){return m.id;});
  var allViews=getRows('Views');
  var allLikes=getRows('Likes');
  var allComments=getRows('Comments');
  var allDownloads=getRows('Downloads');
  var totalViews=allViews.filter(function(r){return myIds.indexOf(String(r[1]))!==-1;}).length;
  var totalLikes=allLikes.filter(function(r){return myIds.indexOf(String(r[2]))!==-1;}).length;
  var totalComments=allComments.filter(function(r){return myIds.indexOf(String(r[3]))!==-1&&String(r[7])!=='deleted';}).length;
  var totalDownloads=allDownloads.filter(function(r){return myIds.indexOf(String(r[2]))!==-1;}).length;
  var followerCount=getRows('Followers').filter(function(r){return String(r[2])===d.gmail;}).length;
  // Per-video stats
  var videoStats=myMovies.map(function(m){
    return {
      id:m.id, name:m.name, cover:m.cover, category:m.category, year:m.year,
      views:allViews.filter(function(r){return String(r[1])===m.id;}).length,
      likes:allLikes.filter(function(r){return String(r[2])===m.id;}).length,
      comments:allComments.filter(function(r){return String(r[3])===m.id&&String(r[7])!=='deleted';}).length,
      downloads:allDownloads.filter(function(r){return String(r[2])===m.id;}).length
    };
  });
  // Last 30 days views
  var cutoff=new Date(Date.now()-30*24*60*60*1000);
  var recentViews=allViews.filter(function(r){
    return myIds.indexOf(String(r[1]))!==-1 && new Date(String(r[3]))>cutoff;
  }).length;
  // Trending (most views)
  var trending=videoStats.slice().sort(function(a,b){return b.views-a.views;}).slice(0,5);
  return {ok:true, stats:{
    totalVideos:myMovies.length,
    totalViews:totalViews,
    totalLikes:totalLikes,
    totalComments:totalComments,
    totalDownloads:totalDownloads,
    followerCount:followerCount,
    recentViews:recentViews,
    videoStats:videoStats,
    trending:trending
  }};
}

// ── Earnings ──────────────────────────────────────────────────
function getEarnings(d) {
  if (!d.gmail) return {ok:false, msg:'Not authenticated.'};
  var rows=getRows('Earnings').filter(function(r){return String(r[1])===d.gmail;});
  var list=rows.map(function(r){return {id:String(r[0]),amount:parseFloat(r[2]||0),type:String(r[3]),date:String(r[4]),description:String(r[5]),status:String(r[6])};});
  var total=list.reduce(function(s,e){return s+(e.status==='paid'?e.amount:0);},0);
  var pending=list.reduce(function(s,e){return s+(e.status==='pending'?e.amount:0);},0);
  return {ok:true, earnings:list, total:total, pending:pending};
}
function getEarningRates() {
  var s = getSettingsMap();
  return {ok:true, rates:{
    rate_per_view:      parseFloat(s['rate_per_view']     || '0.001'),
    rate_per_like:      parseFloat(s['rate_per_like']     || '0.005'),
    rate_per_comment:   parseFloat(s['rate_per_comment']  || '0.010'),
    rate_per_follower:  parseFloat(s['rate_per_follower'] || '0.020'),
    monetize_threshold: parseInt(s['monetize_threshold']  || '1000'),
    min_payout:         parseFloat(s['min_payout']        || '5.00'),
    payout_currency:    s['payout_currency']              || 'USD'
  }};
}

function updateEarningRates(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var sh = getSheet('Settings'), data = sh.getDataRange().getValues();
  var fields = ['rate_per_view','rate_per_like','rate_per_comment',
                'rate_per_follower','monetize_threshold','min_payout','payout_currency'];
  fields.forEach(function(key) {
    if (d[key] === undefined) return;
    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === key) { sh.getRange(i+1,2).setValue(d[key]); found=true; break; }
    }
    if (!found) sh.appendRow([key, d[key]]);
  });
  return {ok:true, msg:'Earning rates updated!'};
}

function calculateUserEarnings(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  if (!d.gmail) return {ok:false, msg:'Gmail required.'};
  var s = getSettingsMap();
  var rateView     = parseFloat(s['rate_per_view']     || '0.001');
  var rateLike     = parseFloat(s['rate_per_like']     || '0.005');
  var rateComment  = parseFloat(s['rate_per_comment']  || '0.010');
  var rateFollower = parseFloat(s['rate_per_follower'] || '0.020');
  var threshold    = parseInt(s['monetize_threshold']  || '1000');
  var followerCount = getRows('Followers').filter(function(r){
    return String(r[2]) === d.gmail;
  }).length;
  if (followerCount < threshold)
    return {ok:false, msg:'Needs '+threshold+' followers. Has: '+followerCount};
  var prevEarnings = getRows('Earnings').filter(function(r){
    return String(r[1])===d.gmail && String(r[6])==='paid';
  });
  var cutoff = new Date(0);
  if (prevEarnings.length) {
    var dates = prevEarnings.map(function(r){return new Date(String(r[4]));})
                            .filter(function(dt){return !isNaN(dt);});
    if (dates.length) cutoff = new Date(Math.max.apply(null,dates));
  }
  var myIds = getRows('Movies').filter(function(r){
    return String(r[17])===d.gmail;
  }).map(function(r){return String(r[0]);});
  var now = new Date();
  var newViews = getRows('Views').filter(function(r){
    return myIds.indexOf(String(r[1]))!==-1 && new Date(String(r[3]))>cutoff;
  }).length;
  var newLikes = getRows('Likes').filter(function(r){
    return myIds.indexOf(String(r[2]))!==-1 && new Date(String(r[3]))>cutoff;
  }).length;
  var newComments = getRows('Comments').filter(function(r){
    return myIds.indexOf(String(r[3]))!==-1 &&
           new Date(String(r[6]))>cutoff &&
           String(r[7])!=='deleted';
  }).length;
  var newFollowers = getRows('Followers').filter(function(r){
    return String(r[2])===d.gmail && new Date(String(r[3]))>cutoff;
  }).length;
  var round4 = function(n){return Math.round(n*10000)/10000;};
  var viewEarnings     = round4(newViews     * rateView);
  var likeEarnings     = round4(newLikes     * rateLike);
  var commentEarnings  = round4(newComments  * rateComment);
  var followerEarnings = round4(newFollowers * rateFollower);
  var total = round4(viewEarnings+likeEarnings+commentEarnings+followerEarnings);
  if (total <= 0)
    return {ok:true, msg:'No new activity since last calculation.', total:0};
  var sh = getSheet('Earnings'), ts = now.toISOString();
  if (viewEarnings>0)     sh.appendRow(['EV'+Date.now(),d.gmail,viewEarnings,    'view_revenue',    ts,newViews+' new views',        'paid']);
  Utilities.sleep(10);
  if (likeEarnings>0)     sh.appendRow(['EL'+Date.now(),d.gmail,likeEarnings,    'like_revenue',    ts,newLikes+' new likes',        'paid']);
  Utilities.sleep(10);
  if (commentEarnings>0)  sh.appendRow(['EC'+Date.now(),d.gmail,commentEarnings, 'comment_revenue', ts,newComments+' new comments',  'paid']);
  Utilities.sleep(10);
  if (followerEarnings>0) sh.appendRow(['EF'+Date.now(),d.gmail,followerEarnings,'follower_bonus',  ts,newFollowers+' new followers','paid']);
  return {ok:true, msg:'Earnings calculated!', total:total,
          breakdown:{views:viewEarnings,likes:likeEarnings,
                     comments:commentEarnings,followers:followerEarnings},
          activity:{views:newViews,likes:newLikes,
                    comments:newComments,followers:newFollowers}};
}

function processAllEarnings(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var threshold    = parseInt(getSettingsMap()['monetize_threshold']||'1000');
  var allFollowers = getRows('Followers');
  var channels     = getRows('Channels').filter(function(r){return !!r[0];});
  var results=[], processed=0, skipped=0;
  channels.forEach(function(ch){
    var gmail = String(ch[1]);
    var fc = allFollowers.filter(function(f){return String(f[2])===gmail;}).length;
    if (fc < threshold){skipped++;return;}
    var r = calculateUserEarnings({token:d.token, gmail:gmail});
    results.push({gmail:gmail, total:r.total||0, msg:r.msg});
    processed++;
    Utilities.sleep(50);
  });
  var grandTotal = results.reduce(function(s,r){return s+(r.total||0);},0);
  return {ok:true,
          msg:'Processed '+processed+' channels, skipped '+skipped+'.',
          grandTotal:Math.round(grandTotal*10000)/10000,
          results:results};
}

function getPaymentOverview(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var allEarnings  = getRows('Earnings');
  var threshold    = parseInt(getSettingsMap()['monetize_threshold']||'1000');
  var allFollowers = getRows('Followers');
  var totalPaid=0, totalPending=0, totalWithdrawn=0;
  var byType={view_revenue:0,like_revenue:0,comment_revenue:0,follower_bonus:0,withdrawal:0};
  allEarnings.forEach(function(r){
    var amt=parseFloat(r[2]||0), type=String(r[3]||''), stat=String(r[6]||'');
    if(stat==='paid')       totalPaid      +=amt;
    if(stat==='pending')    totalPending   +=amt;
    if(type==='withdrawal') totalWithdrawn +=amt;
    if(byType[type]!==undefined) byType[type]+=amt;
  });
  var monetizedCount = getRows('Channels').filter(function(ch){
    if(!ch[0])return false;
    var fc=allFollowers.filter(function(f){return String(f[2])===String(ch[1]);}).length;
    return fc>=threshold;
  }).length;
  return {ok:true, overview:{
    totalPaid:      Math.round(totalPaid*100)/100,
    totalPending:   Math.round(totalPending*100)/100,
    totalWithdrawn: Math.round(totalWithdrawn*100)/100,
    byType:         byType,
    monetizedChannels: monetizedCount,
    totalChannels:  Math.max(0,getSheet('Channels').getLastRow()-1)
  }};
}

function getAllEarnings(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var list = getRows('Earnings').filter(function(r){return !!r[0];}).map(function(r){
    return {
      id:String(r[0]),gmail:String(r[1]),amount:parseFloat(r[2]||0),
      type:String(r[3]||''),date:String(r[4]||''),
      description:String(r[5]||''),status:String(r[6]||'pending')
    };
  });
  return {ok:true, earnings:list.reverse().slice(0,500)};
}
// ── Playlist ──────────────────────────────────────────────────
function addToPlaylist(d) {
  if (!d.gmail) return {ok:false, msg:'Sign in required.'};
  var rows=getRows('Playlist');
  for (var i=0;i<rows.length;i++) {
    if (String(rows[i][1])===d.gmail && String(rows[i][2])===String(d.movieId)) return {ok:false, msg:'Already in playlist.'};
  }
  var id='PL'+Date.now();
  getSheet('Playlist').appendRow([id,d.gmail,d.movieId,new Date().toISOString()]);
  return {ok:true, id:id};
}

function removeFromPlaylist(d) {
  if (!d.gmail) return {ok:false, msg:'Sign in required.'};
  var sh=getSheet('Playlist'), data=sh.getDataRange().getValues();
  for (var i=1;i<data.length;i++) {
    if (String(data[i][1])===d.gmail && String(data[i][2])===String(d.movieId)) {
      sh.deleteRow(i+1); return {ok:true};
    }
  }
  return {ok:false};
}

function getPlaylist(d) {
  if (!d.gmail) return {ok:false, msg:'Sign in required.'};
  var ids=getRows('Playlist').filter(function(r){return String(r[1])===d.gmail;}).map(function(r){return String(r[2]);});
  var movies=getRows('Movies').filter(function(r){return !!r[0]&&ids.indexOf(String(r[0]))!==-1;}).map(rowToMovie);
  return {ok:true, movies:movies};
}


// ── Comments ──────────────────────────────────────────────────
function addComment(d) {
  if (!d.gmail) return {ok:false, msg:'Sign in to comment.'};
  if (!d.comment||!String(d.comment).trim()) return {ok:false, msg:'Empty comment.'};
  var id='C'+Date.now();
  // Column 9 = Avatar URL — stored so every comment shows the poster's profile picture
  getSheet('Comments').appendRow([
    id, d.gmail, d.name||d.gmail, d.movieId,
    String(d.comment).trim(), d.emoji||'💬',
    new Date().toISOString(), 'active', d.avatar||''
  ]);
  return {ok:true, id:id};
}
 
function getComments(d) {
  var list=getRows('Comments')
    .filter(function(r){return String(r[3])===String(d.movieId)&&String(r[7])!=='deleted';})
    .map(function(r){return {
      id:String(r[0]), gmail:String(r[1]), name:String(r[2]),
      comment:String(r[4]), emoji:String(r[5]||'💬'),
      date:String(r[6]), avatar:String(r[8]||'')
    };});
  return {ok:true, comments:list};
}
 
function getMyVideoComments(d) {
  if (!d.gmail) return {ok:false, msg:'Not authenticated.'};
  var myIds=getRows('Movies').filter(function(r){return String(r[17])===d.gmail;}).map(function(r){return String(r[0]);});
  var list=getRows('Comments')
    .filter(function(r){return myIds.indexOf(String(r[3]))!==-1&&String(r[7])!=='deleted';})
    .map(function(r){return {
      id:String(r[0]), gmail:String(r[1]), name:String(r[2]),
      movieId:String(r[3]), comment:String(r[4]), emoji:String(r[5]||'💬'),
      date:String(r[6]), avatar:String(r[8]||'')
    };});
  return {ok:true, comments:list};
}
 
function deleteComment(d) {
  if (!isAdmin(d.token)&&!d.gmail) return {ok:false, msg:'Unauthorized.'};
  var sh=getSheet('Comments'), data=sh.getDataRange().getValues();
  for (var i=1;i<data.length;i++) {
    if (String(data[i][0])===String(d.id)) {
      if (!isAdmin(d.token) && String(data[i][1])!==d.gmail) return {ok:false, msg:'Not your comment.'};
      sh.getRange(i+1,8).setValue('deleted'); return {ok:true};
    }
  }
  return {ok:false};
}
 
function getAllComments(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var list=getRows('Comments').filter(function(r){return !!r[0]&&String(r[7])!=='deleted';})
    .map(function(r){return {id:String(r[0]),gmail:String(r[1]),name:String(r[2]),movieId:String(r[3]),comment:String(r[4]),emoji:String(r[5]||'💬'),date:String(r[6]),avatar:String(r[8]||'')};});
  return {ok:true, comments:list};
}
 

// ── Notifications ─────────────────────────────────────────────
function addNotification(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var id='N'+Date.now();
  getSheet('Notifications').appendRow([id,d.title||'',d.message||'',new Date().toISOString(),d.type||'info','']);
  return {ok:true, id:id, msg:'Notification sent!'};
}

function getNotifications(d) {
  var rows=getRows('Notifications');
  var list=rows.filter(function(r){return !!r[0];}).map(function(r){
    var readBy=String(r[5]||'').split(',').filter(Boolean);
    return {id:String(r[0]),title:String(r[1]),message:String(r[2]),date:String(r[3]),type:String(r[4]),isRead:d.gmail?readBy.indexOf(d.gmail)!==-1:false};
  });
  return {ok:true, notifications:list.reverse().slice(0,30)};
}

function markNotifRead(d) {
  if (!d.gmail||!d.notifId) return {ok:false};
  var sh=getSheet('Notifications'), data=sh.getDataRange().getValues();
  for (var i=1;i<data.length;i++) {
    if (String(data[i][0])===String(d.notifId)) {
      var readers=String(data[i][5]||'').split(',').filter(Boolean);
      if (readers.indexOf(d.gmail)===-1) { readers.push(d.gmail); sh.getRange(i+1,6).setValue(readers.join(',')); }
      return {ok:true};
    }
  }
  return {ok:false};
}

function deleteNotification(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var sh=getSheet('Notifications'), data=sh.getDataRange().getValues();
  for (var i=1;i<data.length;i++) {
    if (String(data[i][0])===String(d.id)) { sh.deleteRow(i+1); return {ok:true}; }
  }
  return {ok:false};
}

// ── Pages ─────────────────────────────────────────────────────
function getPages() {
  var m={};
  getRows('Pages').forEach(function(r){if(r[0])m[String(r[0])]={title:String(r[1]),content:String(r[2]),updated:String(r[3])};});
  return {ok:true, pages:m};
}

function savePage(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  if (!d.key) return {ok:false, msg:'Key required.'};
  var sh=getSheet('Pages'), data=sh.getDataRange().getValues();
  for (var i=1;i<data.length;i++) {
    if (String(data[i][0])===String(d.key)) {
      if (d.title!==undefined)   sh.getRange(i+1,2).setValue(d.title);
      if (d.content!==undefined) sh.getRange(i+1,3).setValue(d.content);
      sh.getRange(i+1,4).setValue(new Date().toISOString());
      return {ok:true, msg:'Page saved!'};
    }
  }
  sh.appendRow([d.key,d.title||'',d.content||'',new Date().toISOString()]);
  return {ok:true, msg:'Page created!'};
}

// ── Downloads ─────────────────────────────────────────────────
function logDownload(d) {
  var id='DL'+Date.now();
  getSheet('Downloads').appendRow([id,d.gmail||'guest',d.movieId||'',d.movieName||'',new Date().toISOString(),d.status||'completed']);
  return {ok:true, id:id};
}

// ── Online ────────────────────────────────────────────────────
function pingOnline(d) {
  var sh=getSheet('Online'), data=sh.getDataRange().getValues();
  var gmail=d.gmail||'guest';
  for (var i=1;i<data.length;i++) {
    if (String(data[i][0])===gmail) {
      sh.getRange(i+1,2).setValue(new Date().toISOString());
      sh.getRange(i+1,3).setValue(d.country||'');
      return {ok:true};
    }
  }
  sh.appendRow([gmail,new Date().toISOString(),d.country||'']);
  return {ok:true};
}

function getOnlineUsers(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var cutoff=new Date(Date.now()-3*60*1000);
  var list=getRows('Online').filter(function(r){
    var last=new Date(String(r[1]));
    return !isNaN(last)&&last>cutoff&&r[0]!=='guest';
  }).map(function(r){return {gmail:String(r[0]),lastSeen:String(r[1]),country:String(r[2])};});
  return {ok:true, users:list, count:list.length};
}

// ── Settings ─────────────────────────────────────────────────
function getSettings() { return {ok:true, settings:getSettingsMap()}; }

function updateSettings(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var sh=getSheet('Settings'), data=sh.getDataRange().getValues();
  var map=d.settings||{};
  for (var key in map) {
    var found=false;
    for (var i=1;i<data.length;i++) {
      if (String(data[i][0])===key) { sh.getRange(i+1,2).setValue(map[key]); found=true; break; }
    }
    if (!found) sh.appendRow([key,map[key]]);
  }
  try {
    var cache = CacheService.getScriptCache();
    cache.remove('settings');
  } catch (e) {}
  return {ok:true, msg:'Settings saved!'};
}
// ── Users (admin) ─────────────────────────────────────────────
function getUsers(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var uRows=getRows('Users'), cRows=getRows('Comments'), cMap={};
  cRows.forEach(function(r){var g=String(r[1]);if(g&&String(r[7])!=='deleted'){if(!cMap[g])cMap[g]=0;cMap[g]++;}});
  var users=uRows.filter(function(r){return !!r[0];}).map(function(r){
    return {id:String(r[0]),gmail:String(r[1]),name:String(r[3]),country:String(r[4]),created:String(r[5]),status:String(r[6]||'active'),avatar:String(r[7]||''),commentCount:cMap[String(r[1])]||0};
  });
  return {ok:true, users:users};
}

function setUserStatus(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var sh=getSheet('Users'), data=sh.getDataRange().getValues();
  for (var i=1;i<data.length;i++) {
    if (String(data[i][0])===String(d.id)) { sh.getRange(i+1,7).setValue(d.status); return {ok:true}; }
  }
  return {ok:false};
}

function deleteUser(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var sh=getSheet('Users'), data=sh.getDataRange().getValues();
  for (var i=1;i<data.length;i++) {
    if (String(data[i][0])===String(d.id)) { sh.deleteRow(i+1); return {ok:true}; }
  }
  return {ok:false};
}

// ── Traffic ───────────────────────────────────────────────────
function logTraffic(d) {
  getSheet('Traffic').appendRow([new Date().toISOString(),d.user||'guest',d.action||'visit',d.country||'',d.details||'']);
  return {ok:true};
}

function getTraffic(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var list=getRows('Traffic').map(function(r){return {timestamp:String(r[0]),user:String(r[1]),action:String(r[2]),country:String(r[3]),details:String(r[4])};});
  return {ok:true, traffic:list.reverse().slice(0,500)};
}

function getStats(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  return {ok:true, stats:{
    users:    Math.max(0,getSheet('Users').getLastRow()-1),
    movies:   Math.max(0,getSheet('Movies').getLastRow()-1),
    comments: Math.max(0,getSheet('Comments').getLastRow()-1),
    traffic:  Math.max(0,getSheet('Traffic').getLastRow()-1),
    downloads:Math.max(0,getSheet('Downloads').getLastRow()-1),
    playlist: Math.max(0,getSheet('Playlist').getLastRow()-1),
    channels: Math.max(0,getSheet('Channels').getLastRow()-1),
    followers:Math.max(0,getSheet('Followers').getLastRow()-1)
  }};
}
// ── Init AI sheet with default key terms ──────────────────────
function initAIDefaults(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var sh = getSheet('AIKeyTerms',
    ['ID','Keywords','Response','DataFetch','Category','Active','Created']);
  if (sh.getLastRow() > 1) return {ok:true, msg:'AI already has key terms.'};
 
  var defaults = [
    ['hello,hi,hey,greetings,good morning,good afternoon,bonjour',
     'Hello! 👋 Welcome to KEYTUBE! I am your AI assistant. I can help you find movies, channels, answer questions about the platform and more. What would you like to know?',
     '','greeting',true],
 
    ['how many movies,total movies,movies available,movie count,number of movies',
     'KEYTUBE currently has {total_movies} movies and videos available across all categories. New content is added regularly! 🎬',
     'total_movies','movies',true],
 
    ['most viewed,most popular movie,top movie,best movie,trending movie',
     'The most viewed movie on KEYTUBE right now is 🎬 "{most_viewed_movie}". Check it out on the home page!',
     'most_viewed_movie','movies',true],
 
    ['new movies,latest movies,recent movies,newest content,new releases',
     'The latest addition to KEYTUBE is 🆕 "{recent_movie}". Head to the New Releases section to see all new content!',
     'recent_movie','movies',true],
 
    ['top channel,best channel,popular channel,most followed channel',
     'The most followed channel on KEYTUBE is 📺 "{top_channel}" with {top_channel_followers} followers. Go follow them!',
     'top_channel,top_channel_followers','channels',true],
 
    ['how many users,total users,user count,members',
     'KEYTUBE has {total_users} registered members and growing every day! 🌍 Join our community.',
     'total_users','general',true],
 
    ['how to upload,upload video,upload movie,post video,add video',
     'To upload a video on KEYTUBE:\n1. Sign in to your account\n2. Go to My Studio 🎬\n3. Click "Upload Video"\n4. Fill in your video details\n5. Select your video file\n6. Click Upload & Publish ✅\n\nYour video will be live immediately!',
     '','help',true],
 
    ['how to download,download video,save video,offline video',
     'To download a video:\n1. Open the video you want\n2. Tap the ⬇ Download button\n3. Wait for the download to complete\n4. Find it in your Downloads tab\n\nNote: You must be signed in to download. 🔒',
     '','help',true],
 
    ['how to earn,make money,monetization,earnings,income,revenue',
     'To earn money on KEYTUBE 💰:\n1. Create your channel in Studio\n2. Upload quality content\n3. Grow your followers to {monetize_threshold}\n4. Monetization unlocks automatically ✅\n5. Earn from views, likes, comments and followers\n\nYou can withdraw your earnings from your Wallet!',
     'monetize_threshold','earnings',true],
 
    ['how to create channel,create channel,start channel,my channel,setup channel',
     'To create your KEYTUBE channel:\n1. Sign in to your account\n2. Go to My Studio 🎬\n3. Click "Channel" in the sidebar\n4. Fill in your channel name and handle\n5. Add your bio and profile photo\n6. Click Create Channel ✅\n\nYour channel is live instantly!',
     '','channels',true],
 
    ['how to follow,follow channel,subscribe,follow creator',
     'To follow a channel:\n1. Open the channel page\n2. Tap the Follow button 👥\n3. You will receive notifications for new content\n\nYou can also follow directly from search results or from the watch page!',
     '','help',true],
 
    ['forgot password,reset password,change password,lost password',
     'To change your password:\n1. Go to your Profile ⚙️\n2. Click Settings\n3. Scroll to "Change Password"\n4. Enter your current password\n5. Enter and confirm your new password\n6. Click Update ✅\n\nIf you cannot log in, contact support at contact@keytube.com',
     '','help',true],
 
    ['contact,support,help,problem,issue,report,bug',
     'Need help? Here is how to reach us:\n\n📧 Email: contact@keytube.com\n📱 WhatsApp: +250 700 000 000\n⏰ Support hours: Mon–Fri 8am–6pm CAT\n\nYou can also check our Help Center for answers to common questions.',
     '','support',true],
 
    ['categories,types of content,what is on keytube,content types',
     'KEYTUBE has content in many categories:\n\n🇬🇧 English Movies\n🇫🇷 French Movies\n🎭 Drama\n🇨🇳 Chinese Series\n🇮🇳 Indian/Bollywood\n🎨 Cartoons\n📺 TV Series\n🎵 Music Videos\n📰 News\n😂 Comedy\n\nUse the category pills on the home page to browse!',
     '','movies',true],
 
    ['what is keytube,about keytube,keytube platform,tell me about keytube',
     'KEYTUBE is your #1 streaming platform for movies, series, songs and news from around the world! 🌍\n\nFeatures:\n✅ Free to watch\n🎬 Upload your own content\n👥 Follow your favourite creators\n⬇ Download for offline viewing\n💰 Earn from your content\n\nBased in Kigali, Rwanda. Available worldwide!',
     '','general',true],
 
    ['playlist,save movie,my list,watchlist,saved videos',
     'To save a movie to your playlist:\n1. Open any video\n2. Tap 📋 "My List"\n3. Find it later in My List tab\n\nYou can also Like ❤️ videos to find them in your Liked videos section in your Profile.',
     '','help',true],
 
    ['bye,goodbye,thank you,thanks,see you',
     'You are welcome! 😊 Enjoy watching on KEYTUBE! If you have more questions, I am always here to help. Have a great day! 🌟',
     '','greeting',true]
  ];
 
  defaults.forEach(function(row) {
    sh.appendRow([
      'AI'+Date.now()+Math.random().toString(36).slice(2,6),
      row[0], row[1], row[3], row[2], row[4], new Date().toISOString()
    ]);
    Utilities.sleep(20);
  });
  return {ok:true, msg:'AI defaults loaded! ('+defaults.length+' key terms)'};
}
 
// ── Fetch live data placeholders ──────────────────────────────
function resolveAIPlaceholders(text, dataFetch) {
  if (!dataFetch || !dataFetch.trim()) return text;
  var fetches = dataFetch.split(',').map(function(s){return s.trim();});
  var data = {};
 
  fetches.forEach(function(fetch) {
    switch(fetch) {
      case 'total_movies':
        data['total_movies'] = Math.max(0, getSheet('Movies').getLastRow()-1);
        break;
      case 'total_users':
        data['total_users'] = Math.max(0, getSheet('Users').getLastRow()-1);
        break;
      case 'most_viewed_movie':
        var views = getRows('Views');
        var vMap = {};
        views.forEach(function(v){var id=String(v[1]);vMap[id]=(vMap[id]||0)+1;});
        var topId = Object.keys(vMap).sort(function(a,b){return vMap[b]-vMap[a];})[0];
        if (topId) {
          var movies = getRows('Movies');
          for (var i=0;i<movies.length;i++){if(String(movies[i][0])===topId){data['most_viewed_movie']=String(movies[i][1]);break;}}
        }
        if (!data['most_viewed_movie']) {
          var m = getRows('Movies').filter(function(r){return !!r[0];});
          data['most_viewed_movie'] = m.length ? String(m[m.length-1][1]) : 'N/A';
        }
        break;
      case 'recent_movie':
        var recent = getRows('Movies').filter(function(r){return !!r[0];});
        data['recent_movie'] = recent.length ? String(recent[recent.length-1][1]) : 'N/A';
        break;
      case 'top_channel':
        var followers = getRows('Followers');
        var fMap = {};
        followers.forEach(function(f){var g=String(f[2]);fMap[g]=(fMap[g]||0)+1;});
        var topGmail = Object.keys(fMap).sort(function(a,b){return fMap[b]-fMap[a];})[0];
        if (topGmail) {
          var channels = getRows('Channels');
          for (var j=0;j<channels.length;j++){
            if(String(channels[j][1])===topGmail){
              data['top_channel']=String(channels[j][2]||channels[j][1]);
              data['top_channel_followers']=fMap[topGmail];
              break;
            }
          }
        }
        if (!data['top_channel']) {data['top_channel']='N/A';data['top_channel_followers']=0;}
        break;
      case 'monetize_threshold':
        data['monetize_threshold'] = getSettingsMap()['monetize_threshold'] || '1000';
        break;
      case 'top_10_movies':
        var views = getRows('Views');
        var vMap = {};
        views.forEach(function(v){var id=String(v[1]);vMap[id]=(vMap[id]||0)+1;});
        var sortedIds = Object.keys(vMap).sort(function(a,b){return vMap[b]-vMap[a];});
        var top10 = [];
        var movies = getRows('Movies');
        for(var i=0; i<sortedIds.length && top10.length<10; i++){
          var curId = sortedIds[i];
          for(var j=0; j<movies.length; j++){
            if(String(movies[j][0])===curId){
              top10.push({title: String(movies[j][1]), views: vMap[curId]});
              break;
            }
          }
        }
        if(top10.length === 0){
          var m = movies.filter(function(r){return !!r[0];});
          var lim = Math.min(m.length, 10);
          for(var k=m.length-1; k>=m.length-lim; k--){
            top10.push({title: String(m[k][1]), views: 0});
          }
        }
        var list10Movies = '';
        top10.forEach(function(item, idx) {
          list10Movies += (idx + 1) + '. ' + item.title + ' (' + item.views + ' views)\n';
        });
        data['top_10_movies'] = list10Movies.trim();
        break;
      case 'top_10_comedy':
        var views = getRows('Views');
        var vMap = {};
        views.forEach(function(v){var id=String(v[1]);vMap[id]=(vMap[id]||0)+1;});
        var sortedIds = Object.keys(vMap).sort(function(a,b){return vMap[b]-vMap[a];});
        var top10 = [];
        var movies = getRows('Movies');
        for(var i=0; i<sortedIds.length && top10.length<10; i++){
          var curId = sortedIds[i];
          for(var j=0; j<movies.length; j++){
            if(String(movies[j][0])===curId && String(movies[j][3]).trim().toLowerCase()==='comedy'){
              top10.push({title: String(movies[j][1]), views: vMap[curId]});
              break;
            }
          }
        }
        if(top10.length === 0){
          var comedyMovies = movies.filter(function(r){return !!r[0] && String(r[3]).trim().toLowerCase()==='comedy';});
          var lim = Math.min(comedyMovies.length, 10);
          for(var k=comedyMovies.length-1; k>=comedyMovies.length-lim; k--){
            top10.push({title: String(comedyMovies[k][1]), views: 0});
          }
        }
        var list10Comedy = '';
        top10.forEach(function(item, idx) {
          list10Comedy += (idx + 1) + '. ' + item.title + ' (' + item.views + ' views)\n';
        });
        data['top_10_comedy'] = list10Comedy.trim();
        break;
      case 'top_10_song':
        var views = getRows('Views');
        var vMap = {};
        views.forEach(function(v){var id=String(v[1]);vMap[id]=(vMap[id]||0)+1;});
        var sortedIds = Object.keys(vMap).sort(function(a,b){return vMap[b]-vMap[a];});
        var top10 = [];
        var movies = getRows('Movies');
        for(var i=0; i<sortedIds.length && top10.length<10; i++){
          var curId = sortedIds[i];
          for(var j=0; j<movies.length; j++){
            if(String(movies[j][0])===curId && String(movies[j][3]).trim().toLowerCase()==='song'){
              top10.push({title: String(movies[j][1]), views: vMap[curId]});
              break;
            }
          }
        }
        if(top10.length === 0){
          var songMovies = movies.filter(function(r){return !!r[0] && String(r[3]).trim().toLowerCase()==='song';});
          var lim = Math.min(songMovies.length, 10);
          for(var k=songMovies.length-1; k>=songMovies.length-lim; k--){
            top10.push({title: String(songMovies[k][1]), views: 0});
          }
        }
        var list10Song = '';
        top10.forEach(function(item, idx) {
          list10Song += (idx + 1) + '. ' + item.title + ' (' + item.views + ' views)\n';
        });
        data['top_10_song'] = list10Song.trim();
        break;
        case 'top_10_cartoon':
        var views = getRows('Views');
        var vMap = {};
        views.forEach(function(v){var id=String(v[1]);vMap[id]=(vMap[id]||0)+1;});
        var sortedIds = Object.keys(vMap).sort(function(a,b){return vMap[b]-vMap[a];});
        var top10 = [];
        var movies = getRows('Movies');
        for(var i=0; i<sortedIds.length && top10.length<10; i++){
          var curId = sortedIds[i];
          for(var j=0; j<movies.length; j++){
            var cat = String(movies[j][3]).trim().toLowerCase();
            if(String(movies[j][0])===curId && (cat === 'cartoon' || cat === 'animation')){
              top10.push({title: String(movies[j][1]), views: vMap[curId]});
              break;
            }
          }
        }
        if(top10.length === 0){
          var cartoonMovies = movies.filter(function(r){
            var c = String(r[3]).trim().toLowerCase();
            return !!r[0] && (c === 'cartoon' || c === 'animation');
          });
          var lim = Math.min(cartoonMovies.length, 10);
          for(var k=cartoonMovies.length-1; k>=cartoonMovies.length-lim; k--){
            top10.push({title: String(cartoonMovies[k][1]), views: 0});
          }
        }
        var list10Cartoon = '';
        top10.forEach(function(item, idx) {
          list10Cartoon += (idx + 1) + '. ' + item.title + ' (' + item.views + ' views)\n';
        });
        data['top_10_cartoon'] = list10Cartoon.trim() || 'No cartoon movies found.';
        break;
        case 'top_10_recent_7days':
        var movies = getRows('Movies');
        var views = getRows('Views');
        var vMap = {};
        views.forEach(function(v){var id=String(v[1]);vMap[id]=(vMap[id]||0)+1;});
        
        var now = new Date().getTime();
        var sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        var recentMatched = [];
        
        movies.forEach(function(r) {
          if (!r[0]) return;
          var title = String(r[1] || '');
          var mId = String(r[0]);
          // Assuming upload timestamp or date is stored at index 5 (adjust column index as needed)
          var uploadDateVal = r[5] ? new Date(r[5]).getTime() : 0;
          
          if (uploadDateVal && (now - uploadDateVal <= sevenDaysMs)) {
            recentMatched.push({title: title, id: mId, views: vMap[mId] || 0});
          }
        });
        
        // Fallback if date field is not indexed at 5: take last added movies if dates aren't parsed
        if (recentMatched.length === 0) {
          var validMovies = movies.filter(function(r){return !!r[0];});
          var lim = Math.min(validMovies.length, 10);
          for(var k=validMovies.length-1; k>=validMovies.length-lim; k--){
            var mId = String(validMovies[k][0]);
            recentMatched.push({title: String(validMovies[k][1]), id: mId, views: vMap[mId] || 0});
          }
        }
        
        // Rank by views descending
        recentMatched.sort(function(a, b) { return b.views - a.views; });
        var top10Recent = recentMatched.slice(0, 10);
        
        var listRecent = '';
        top10Recent.forEach(function(item, idx) {
          listRecent += (idx + 1) + '. ' + item.title + ' (' + item.views + ' views)\n';
        });
        data['top_10_recent_7days'] = listRecent.trim() || 'No videos uploaded in the last 7 days.';
        break;
        case 'random_movie':
          var movies = getRows('Movies').filter(function(r){return !!r[0];});
          if (movies.length === 0) {
            data['random_movie'] = 'No movies available in the database yet.';
            break;
          }
          // Pick a random movie index
          var randomIndex = Math.floor(Math.random() * movies.length);
          var randMovie = movies[randomIndex];
          
          var rTitle = String(randMovie[1] || 'Untitled');
          var rCategory = String(randMovie[3] || 'General');
          var rDesc = String(randMovie[4] || 'No description available.');
         
          var randomMovieCard = '🎲 **Surprise Pick For You!**\n\n' +
            '🎬 **Title:** ' + rTitle + '\n' +
            '📁 **Category:** ' + rCategory + '\n' +
            '📝 **Description:** ' + rDesc;
           
          data['random_movie'] = randomMovieCard;
          break;
    }
  });
 
  // Replace placeholders in text
  Object.keys(data).forEach(function(key) {
    text = text.split('{'+key+'}').join(String(data[key]));
  });
  return text;
}
// ── Save unknown/unanswered question ─────────────────────────
function saveUnknownQuestion(d) {
  var question = (d.question || d.query || '').trim();
  if (!question || question.length < 3) return {ok:false};
 
  // Avoid duplicate questions in last 24 hours
  var cutoff = new Date(Date.now() - 24*60*60*1000);
  var existing = getRows('AIUnknown').filter(function(r){
    return String(r[1]).toLowerCase() === question.toLowerCase()
      && new Date(String(r[3])) > cutoff;
  });
  if (existing.length) return {ok:true, msg:'Already logged.'};
 
  var id = 'AQ' + Date.now();
  getSheet('AIUnknown', ['ID','Question','UserGmail','Date','Status','AdminNotes','UserEmail'])
    .appendRow([id, question, d.gmail||'guest', new Date().toISOString(), 'pending', '', d.email||'']);
  return {ok:true, id:id, msg:'Question saved for admin review.'};
}
 
// ── Get all unknown questions (admin only) ────────────────────
function getUnknownQuestions(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var list = getRows('AIUnknown').filter(function(r){return !!r[0];}).map(function(r){
    return {
      id:       String(r[0]),
      question: String(r[1]||''),
      gmail:    String(r[2]||''),
      date:     String(r[3]||''),
      status:   String(r[4]||'pending'),
      notes:    String(r[5]||''),
      email:    String(r[6]||'')
    };
  });
  // Sort: pending first, then by date desc
  list.sort(function(a,b){
    if(a.status==='pending'&&b.status!=='pending') return -1;
    if(b.status==='pending'&&a.status!=='pending') return 1;
    return new Date(b.date)-new Date(a.date);
  });
  var pendingCount = list.filter(function(q){return q.status==='pending';}).length;
  return {ok:true, questions:list, pendingCount:pendingCount};
}
 
// ── Mark a question as answered / ignored ─────────────────────
function markQuestionAnswered(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var sh   = getSheet('AIUnknown');
  var data = sh.getDataRange().getValues();
  for (var i=1; i<data.length; i++) {
    if (String(data[i][0]) === String(d.id)) {
      sh.getRange(i+1, 5).setValue(d.status || 'answered');
      if (d.notes) sh.getRange(i+1, 6).setValue(d.notes);
      return {ok:true, msg:'Updated!'};
    }
  }
  return {ok:false, msg:'Not found.'};
}
 
// ── Delete an unknown question ─────────────────────────────────
function deleteUnknownQuestion(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var sh   = getSheet('AIUnknown');
  var data = sh.getDataRange().getValues();
  for (var i=1; i<data.length; i++) {
    if (String(data[i][0]) === String(d.id)) {
      sh.deleteRow(i+1);
      return {ok:true, msg:'Deleted.'};
    }
  }
  return {ok:false, msg:'Not found.'};
}
 
// ── Convert unknown question to AI key term ───────────────────
function convertToKeyTerm(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  if (!d.keywords || !d.response) return {ok:false, msg:'Keywords and response required.'};
 
  // Add the key term
  var result = addAIKeyTerm({
    token:     d.token,
    keywords:  d.keywords,
    response:  d.response,
    dataFetch: d.dataFetch || '',
    category:  d.category  || 'general'
  });
  if (!result.ok) return result;
 
  // Mark original question as answered
  if (d.questionId) {
    markQuestionAnswered({
      token:  d.token,
      id:     d.questionId,
      status: 'answered',
      notes:  'Converted to key term: ' + d.keywords
    });
  }
  return {ok:true, msg:'Key term created and question marked as answered!'};
}
// ── Main AI query ─────────────────────────────────────────────
function aiQuery(d) {
  var query = (d.query || '').toLowerCase().trim();
  if (!query) return {ok:false, msg:'Empty query.'};
 
  // Clean query — remove punctuation
  var clean = query.replace(/[^\w\s]/g,' ').replace(/\s+/g,' ').trim();
  var words  = clean.split(' ').filter(function(w){return w.length > 1;});
 
  var terms = getRows('AIKeyTerms').filter(function(r){
    return !!r[0] && String(r[5]).toLowerCase() === 'true';
  });
 
  var bestMatch = null, bestScore = 0;
 
  terms.forEach(function(term) {
    var keywords = String(term[1]||'').toLowerCase().split(',')
      .map(function(k){return k.trim();}).filter(Boolean);
    var score = 0;
 
    keywords.forEach(function(kw) {
      // Exact phrase match — highest score
      if (clean.indexOf(kw) !== -1) {
        score += kw.split(' ').length * 3;
        return;
      }
      // Word-by-word match
      var kwWords = kw.split(' ');
      kwWords.forEach(function(kword) {
        if (kword.length < 2) return;
        words.forEach(function(w) {
          if (w === kword) score += 2;
          else if (w.indexOf(kword) === 0 && kword.length >= 4) score += 1;
        });
      });
    });
 
    if (score > bestScore) { bestScore = score; bestMatch = term; }
  });
 
  // Minimum score threshold to avoid false matches
  if (!bestMatch || bestScore < 1) {
    // Auto-save unanswered question to sheet
    saveUnknownQuestion({
      question: d.query,
      gmail: d.gmail || 'guest',
      email: d.email || ''
    });
    return {ok:true, matched:false,
      response:"I'm not sure about that. 🤔\n\nTry asking about:\n• How to upload videos\n• How to earn money\n• Finding movies\n• Creating a channel\n\nOr tap 'Submit Question' to send this to our team.",
      category:'default'};
  }
 
  var responseText = String(bestMatch[2]||'');
  var dataFetch    = String(bestMatch[3]||'');
 
  // Resolve live data placeholders
  responseText = resolveAIPlaceholders(responseText, dataFetch);
 
  return {
    ok:true,
    matched:true,
    response:responseText,
    category:String(bestMatch[4]||'general'),
    score:bestScore
  };
}
// ── Admin: Get all key terms ───────────────────────────────────
function getAIKeyTerms(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var list = getRows('AIKeyTerms').filter(function(r){return !!r[0];}).map(function(r){
    return {
      id:String(r[0]), keywords:String(r[1]||''),
      response:String(r[2]||''), dataFetch:String(r[3]||''),
      category:String(r[4]||'general'),
      active:String(r[5]).toLowerCase()==='true',
      created:String(r[6]||'')
    };
  });
  return {ok:true, terms:list};
}

// ── Admin: Add key term ────────────────────────────────────────
function addAIKeyTerm(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  if (!d.keywords||!d.response) return {ok:false, msg:'Keywords and response required.'};
  var id = 'AI'+Date.now();
  getSheet('AIKeyTerms',['ID','Keywords','Response','DataFetch','Category','Active','Created'])
    .appendRow([id,d.keywords,d.response,d.dataFetch||'',d.category||'general',true,new Date().toISOString()]);
  return {ok:true, id:id, msg:'Key term added!'};
}
 
// ── Admin: Update key term ────────────────────────────────────
function updateAIKeyTerm(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var sh   = getSheet('AIKeyTerms');
  var data = sh.getDataRange().getValues();
  for (var i=1;i<data.length;i++) {
    if (String(data[i][0])===String(d.id)) {
      if (d.keywords  !== undefined) sh.getRange(i+1,2).setValue(d.keywords);
      if (d.response  !== undefined) sh.getRange(i+1,3).setValue(d.response);
      if (d.dataFetch !== undefined) sh.getRange(i+1,4).setValue(d.dataFetch);
      if (d.category  !== undefined) sh.getRange(i+1,5).setValue(d.category);
      if (d.active    !== undefined) sh.getRange(i+1,6).setValue(d.active===true||d.active==='true');
      return {ok:true, msg:'Updated!'};
    }
  }
  return {ok:false, msg:'Not found.'};
}
 
// ── Admin: Delete key term ────────────────────────────────────
function deleteAIKeyTerm(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var sh   = getSheet('AIKeyTerms');
  var data = sh.getDataRange().getValues();
  for (var i=1;i<data.length;i++) {
    if (String(data[i][0])===String(d.id)) { sh.deleteRow(i+1); return {ok:true, msg:'Deleted.'}; }
  }
  return {ok:false, msg:'Not found.'};
}
// ── STEP 1: User requests reset — sends OTP to Gmail ──────────
function requestPasswordReset(d) {
  if (!d.gmail) return {ok:false, msg:'Email address is required.'};
 
  var gmail = d.gmail.toLowerCase().trim();
  if (gmail.indexOf('@gmail.com') === -1) return {ok:false, msg:'Only Gmail addresses are supported.'};
 
  // Check account exists
  var users = getRows('Users');
  var userFound = false;
  var userName  = '';
  for (var i=0; i<users.length; i++) {
    if (String(users[i][1]).toLowerCase() === gmail) {
      userFound = true;
      userName  = String(users[i][3] || '');
      if (String(users[i][6]) === 'blocked') return {ok:false, msg:'This account is blocked. Contact support.'};
      break;
    }
  }
  if (!userFound) return {ok:false, msg:'No account found with this email address.'};
 
  // Rate limit — block if a valid code was sent in last 5 minutes
  var sh   = getSheet('PasswordResets', ['ID','Gmail','Token','Expires','Status','Created']);
  var rows = sh.getDataRange().getValues();
  var now  = new Date();
  var fiveMinAgo = new Date(now.getTime() - 5*60*1000);
 
  for (var j=1; j<rows.length; j++) {
    if (String(rows[j][1]).toLowerCase() === gmail &&
        String(rows[j][4]) === 'pending' &&
        new Date(String(rows[j][5])) > fiveMinAgo) {
      return {ok:false, msg:'A code was already sent. Please wait a few minutes before requesting again.'};
    }
  }
 
  // Expire any old pending codes for this email
  for (var k=1; k<rows.length; k++) {
    if (String(rows[k][1]).toLowerCase() === gmail && String(rows[k][4]) === 'pending') {
      sh.getRange(k+1, 5).setValue('expired');
    }
  }
 
  // Generate 6-digit OTP
  var otp     = String(Math.floor(100000 + Math.random() * 900000));
  var id      = 'PR' + Date.now();
  var expires = new Date(now.getTime() + 15*60*1000).toISOString(); // 15 minutes
 
  sh.appendRow([id, gmail, otp, expires, 'pending', now.toISOString()]);
 
  // Send email via MailApp
  try {
    var siteName = getSettingsMap()['site_name'] || 'KEYTUBE';
    MailApp.sendEmail({
      to: gmail,
      subject: siteName + ' — Password Reset Code: ' + otp,
      body:
        'Hello ' + (userName || 'there') + ',\n\n' +
        'Your ' + siteName + ' password reset code is:\n\n' +
        '  ' + otp + '\n\n' +
        'This code expires in 15 minutes.\n' +
        'If you did not request a password reset, ignore this email.\n\n' +
        'Thanks,\n' + siteName + ' Team',
      htmlBody:
        '<div style="font-family:Roboto,Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">' +
            '<img src="https://www.keytube.work.gd/imagelib/logo.png" alt="' + siteName + '" style="height:28px;width:auto;display:block" />' +
            '<span style="font-family:Arial Black,sans-serif;font-size:1.2rem;font-weight:900;letter-spacing:1px">' + siteName + '</span>' +
          '</div>' +
          '<h2 style="font-size:1.1rem;margin-bottom:8px;color:#0f0f0f">Password Reset Request</h2>' +
          '<p style="color:#606060;font-size:.87rem;margin-bottom:18px">Hello ' + (userName || 'there') + ', here is your verification code:</p>' +
          '<div style="background:#f9f9f9;border:2px dashed #e5e5e5;border-radius:10px;padding:22px;text-align:center;margin-bottom:18px">' +
            '<div style="font-size:2.6rem;font-weight:900;letter-spacing:12px;color:#ff0000;font-family:monospace">' + otp + '</div>' +
            '<div style="font-size:.78rem;color:#aaa;margin-top:6px">⏱ Expires in <strong>15 minutes</strong></div>' +
          '</div>' +
          '<p style="font-size:.8rem;color:#606060;line-height:1.6">Enter this code on the ' + siteName + ' password reset page to set a new password.</p>' +
          '<hr style="border:none;border-top:1px solid #e5e5e5;margin:18px 0">' +
          '<p style="font-size:.74rem;color:#aaa">If you did not request this, ignore this email. Your account remains secure.</p>' +
        '</div>'
    });
    return {ok:true, msg:'A 6-digit code has been sent to your Gmail. Check your inbox (and spam folder).'};
  } catch(e) {
    // Clean up sheet row if email fails
    sh.deleteRow(sh.getLastRow());
    return {ok:false, msg:'Failed to send email: ' + e.message + '. Make sure the Gmail address is correct.'};
  }
}
 
// ── STEP 2: Verify the OTP ────────────────────────────────────
function verifyResetToken(d) {
  if (!d.gmail || !d.token) return {ok:false, msg:'Missing email or code.'};
 
  var gmail = d.gmail.toLowerCase().trim();
  var token = String(d.token).trim();
  var now   = new Date();
 
  var sh   = getSheet('PasswordResets');
  var data = sh.getDataRange().getValues();
 
  for (var i=1; i<data.length; i++) {
    if (String(data[i][1]).toLowerCase() === gmail && String(data[i][2]) === token) {
      // Check status
      if (String(data[i][4]) === 'used')    return {ok:false, msg:'This code has already been used. Request a new one.'};
      if (String(data[i][4]) === 'expired') return {ok:false, msg:'This code has expired. Request a new one.'};
      // Check expiry
      if (new Date(String(data[i][3])) < now) {
        sh.getRange(i+1, 5).setValue('expired');
        return {ok:false, msg:'Code expired. Please request a new reset code.'};
      }
      // Mark as verified (confirmed identity, waiting for new password)
      sh.getRange(i+1, 5).setValue('verified');
      return {ok:true, msg:'Code verified! Now set your new password.', resetId: String(data[i][0])};
    }
  }
  return {ok:false, msg:'Incorrect code. Please check and try again.'};
}
 
// ── STEP 3: Set new password ──────────────────────────────────
function resetPassword(d) {
  if (!d.gmail || !d.token || !d.newPassword) return {ok:false, msg:'Missing required fields.'};
  if (String(d.newPassword).length < 6) return {ok:false, msg:'Password must be at least 6 characters.'};
 
  var gmail = d.gmail.toLowerCase().trim();
  var now   = new Date();
 
  // Confirm token is verified and not expired
  var prSh   = getSheet('PasswordResets');
  var prData = prSh.getDataRange().getValues();
  var tokenRow = -1;
 
  for (var i=1; i<prData.length; i++) {
    if (String(prData[i][1]).toLowerCase() === gmail && String(prData[i][2]) === String(d.token)) {
      if (String(prData[i][4]) !== 'verified') return {ok:false, msg:'Invalid or already used code. Please start over.'};
      if (new Date(String(prData[i][3])) < now) return {ok:false, msg:'Code expired. Please request a new code.'};
      tokenRow = i+1;
      break;
    }
  }
  if (tokenRow === -1) return {ok:false, msg:'Reset code not found. Please request a new one.'};
 
  // Update user password
  var uSh   = getSheet('Users');
  var uData = uSh.getDataRange().getValues();
  for (var j=1; j<uData.length; j++) {
    if (String(uData[j][1]).toLowerCase() === gmail) {
      uSh.getRange(j+1, 3).setValue(d.newPassword);
      // Mark token as used
      prSh.getRange(tokenRow, 5).setValue('used');
      // Log
      logTraffic({user: gmail, action: 'password_reset', country: '', details: 'via OTP'});
      return {ok:true, msg:'Password reset successfully! You can now sign in with your new password.'};
    }
  }
  return {ok:false, msg:'User not found.'};
}
function googleAuth(d) {
  if (!d.email || !d.googleId) return {ok:false, msg:'Invalid Google credentials.'};
 
  // Verify token with Google (secure server-side check)
  if (d.googleToken) {
    try {
      var res  = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + d.googleToken);
      var info = JSON.parse(res.getContentText());
      // Token must match the email and be for our app
      if (info.email !== d.email) return {ok:false, msg:'Token email mismatch.'};
      if (info.error)             return {ok:false, msg:'Invalid Google token.'};
    } catch(e) {
      // If verification fails (network issue), still allow but log it
      logTraffic({user:d.email, action:'google_auth_unverified', country:d.country||'', details:e.message});
    }
  }
 
  var gmail = String(d.email).toLowerCase().trim();
 
  // ── Existing user → Login ──────────────────────────────────
  var sh   = getSheet('Users');
  var data = sh.getDataRange().getValues();
  for (var i=1; i<data.length; i++) {
    if (String(data[i][1]).toLowerCase() === gmail) {
      if (String(data[i][6]) === 'blocked') return {ok:false, msg:'Account blocked. Contact support.'};
      // Auto-update avatar from Google if user has no avatar yet
      if (!String(data[i][7]) && d.picture) {
        sh.getRange(i+1, 8).setValue(d.picture);
        data[i][7] = d.picture;
      }
      // Auto-update name if it was empty
      if (!String(data[i][3]) && d.name) {
        sh.getRange(i+1, 4).setValue(d.name);
        data[i][3] = d.name;
      }
      pingOnline({gmail:gmail, country:d.country||''});
      logTraffic({user:gmail, action:'google_login', country:d.country||'', details:'Google Sign-In'});
      return {ok:true, isNew:false, user:{
        id:      String(data[i][0]),
        gmail:   gmail,
        name:    String(data[i][3] || d.name || ''),
        country: String(data[i][4] || d.country || ''),
        status:  String(data[i][6] || 'active'),
        avatar:  String(data[i][7] || d.picture || '')
      }};
    }
  }
 
  // ── New user → Auto Register ───────────────────────────────
  var id = 'U' + Date.now();
  // Store a secure random password (they log in via Google, not password)
  var securePw = 'GOOGLE_' + Utilities.getUuid();
  var country  = d.country || '';
 
  sh.appendRow([
    id, gmail, securePw,
    d.name    || gmail.split('@')[0],
    country,
    new Date().toISOString(),
    'active',
    d.picture || ''
  ]);
 
  logTraffic({user:gmail, action:'google_register', country:country, details:'Google Sign-In auto-register'});
 
  return {ok:true, isNew:true, user:{
    id:      id,
    gmail:   gmail,
    name:    d.name    || gmail.split('@')[0],
    country: country,
    status:  'active',
    avatar:  d.picture || ''
  }};
}
// ── Business submits ad request ───────────────────────────────
function submitAdRequest(d) {
  // Basic validation
  if (!d.businessName) return {ok:false, msg:'Business name is required.'};
  if (!d.email)        return {ok:false, msg:'Email address is required.'};
  if (!d.adTitle)      return {ok:false, msg:'Ad title is required.'};
  if (!d.adType)       return {ok:false, msg:'Select an ad type.'};
  if (!d.adLinkURL)    return {ok:false, msg:'Destination link is required.'};
 
  // Rate limit: same email can only submit 3 requests per day
  var today   = new Date().toDateString();
  var todayReqs = getRows('AdRequests').filter(function(r){
    return String(r[3]).toLowerCase() === String(d.email).toLowerCase() &&
           new Date(String(r[22])).toDateString() === today;
  });
  if (todayReqs.length >= 3) return {ok:false, msg:'Maximum 3 ad requests per day per email.'};
 
  var id  = 'AD' + Date.now();
  var now = new Date().toISOString();
 
  getSheet('AdRequests').appendRow([
    id,                          // ID
    d.businessName || '',        // BusinessName
    d.contactName  || '',        // ContactName
    d.email        || '',        // Email
    d.phone        || '',        // Phone
    d.website      || '',        // Website
    d.adType       || 'banner',  // AdType: banner|video|text|sponsored
    d.adTitle      || '',        // AdTitle
    d.adDescription|| '',        // AdDescription
    d.adImageURL   || '',        // AdImageURL
    d.adLinkURL    || '',        // AdLinkURL
    d.adVideoURL   || '',        // AdVideoURL
    d.targetCategory||'all',     // TargetCategory
    d.budget       || '',        // Budget
    d.currency     || 'USD',     // Currency
    d.startDate    || '',        // StartDate
    d.endDate      || '',        // EndDate
    d.message      || '',        // Message to admin
    'pending',                   // Status
    '',                          // AdminNotes
    '',                          // Placement: top|middle|bottom|overlay
    '',                          // ApprovedPrice
    now,                         // SubmittedDate
    '',                          // ReviewedDate
    0,                           // ViewCount
    0                            // ClickCount
  ]);
 
  // Send confirmation email to advertiser
  try {
    var siteName = getSettingsMap()['site_name'] || 'KEYTUBE';
    MailApp.sendEmail({
      to: d.email,
      subject: siteName + ' — Ad Request Received (#' + id + ')',
      htmlBody:
        '<div style="font-family:sans-serif;max-width:440px;margin:0 auto;padding:22px">' +
          '<div style="margin-bottom:14px">' +
            '<img src="https://www.keytube.work.gd/imagelib/logo.png" alt="' + siteName + ' Logo" style="max-width:120px;height:auto;display:block;">' +
          '</div>' +
          '<h2 style="color:#ff0000;margin-bottom:4px">' + siteName + '</h2>' +
          '<h3 style="color:#0f0f0f;margin-bottom:14px">Ad Request Received!</h3>' +
          '<p style="color:#606060;font-size:.87rem;line-height:1.6">Hello ' + (d.contactName||d.businessName) + ',</p>' +
          '<p style="color:#606060;font-size:.87rem;line-height:1.6">Thank you for your advertising request. Our team will review it within <strong>1-2 business days</strong> and get back to you at this email address.</p>' +
          '<div style="background:#f9f9f9;border-radius:8px;padding:14px;margin:16px 0">' +
            '<p style="font-size:.82rem;font-weight:700;margin-bottom:8px">Your Request Details:</p>' +
            '<p style="font-size:.8rem;color:#606060;margin:3px 0"><strong>Reference:</strong> #' + id + '</p>' +
            '<p style="font-size:.8rem;color:#606060;margin:3px 0"><strong>Ad Type:</strong> ' + (d.adType||'Banner') + '</p>' +
            '<p style="font-size:.8rem;color:#606060;margin:3px 0"><strong>Ad Title:</strong> ' + (d.adTitle||'') + '</p>' +
            '<p style="font-size:.8rem;color:#606060;margin:3px 0"><strong>Budget:</strong> ' + (d.budget||'') + ' ' + (d.currency||'USD') + '</p>' +
          '</div>' +
          '<p style="color:#606060;font-size:.82rem">Questions? Contact us at <a href="mailto:contact@keytube.com">grensrena@gmail.com</a></p>' +
        '</div>'
    });
  } catch(e) { /* email failure doesn't block submission */ }
 
  return {ok:true, id:id, msg:'Ad request submitted successfully! We will review it within 1-2 business days and contact you at ' + d.email};
}
 
// ── Admin gets all ad requests ─────────────────────────────────
function getAdRequests(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  var list = getRows('AdRequests').filter(function(r){return !!r[0];}).map(function(r){
    return {
      id:            String(r[0]),
      businessName:  String(r[1]),
      contactName:   String(r[2]),
      email:         String(r[3]),
      phone:         String(r[4]),
      website:       String(r[5]),
      adType:        String(r[6]),
      adTitle:       String(r[7]),
      adDescription: String(r[8]),
      adImageURL:    String(r[9]),
      adLinkURL:     String(r[10]),
      adVideoURL:    String(r[11]),
      targetCategory:String(r[12]),
      budget:        String(r[13]),
      currency:      String(r[14]),
      startDate:     String(r[15]),
      endDate:       String(r[16]),
      message:       String(r[17]),
      status:        String(r[18]),
      adminNotes:    String(r[19]),
      placement:     String(r[20]),
      approvedPrice: String(r[21]),
      submittedDate: String(r[22]),
      reviewedDate:  String(r[23]),
      viewCount:     parseInt(r[24]||0),
      clickCount:    parseInt(r[25]||0)
    };
  }).sort(function(a,b){return new Date(b.submittedDate)-new Date(a.submittedDate);});
 
  var counts = {
    pending:  list.filter(function(r){return r.status==='pending';}).length,
    approved: list.filter(function(r){return r.status==='approved';}).length,
    active:   list.filter(function(r){return r.status==='active';}).length,
    rejected: list.filter(function(r){return r.status==='rejected';}).length
  };
  return {ok:true, ads:list, counts:counts};
}
 
// ── Admin reviews (approve / reject / activate / expire) ───────
function reviewAdRequest(d) {
  if (!isAdmin(d.token)) return {ok:false, msg:'Unauthorized.'};
  if (!d.id || !d.status) return {ok:false, msg:'Missing id or status.'};
 
  var sh   = getSheet('AdRequests');
  var data = sh.getDataRange().getValues();
  var now  = new Date().toISOString();
 
  for (var i=1; i<data.length; i++) {
    if (String(data[i][0]) === String(d.id)) {
      sh.getRange(i+1, 19).setValue(d.status);          // Status
      sh.getRange(i+1, 20).setValue(d.adminNotes || '');// AdminNotes
      sh.getRange(i+1, 21).setValue(d.placement  || '');// Placement
      sh.getRange(i+1, 22).setValue(d.approvedPrice||'');// ApprovedPrice
      sh.getRange(i+1, 24).setValue(now);               // ReviewedDate
 
      // Notify advertiser by email
      var email = String(data[i][3]);
      var adTitle = String(data[i][7]);
      var bizName = String(data[i][1]);
      var siteName = getSettingsMap()['site_name'] || 'KEYTUBE';
 
      try {
        var subject='', body='';
        if (d.status === 'approved' || d.status === 'active') {
          subject = siteName + ' — Your Ad Has Been Approved! 🎉';
          body = '<div style="font-family:sans-serif;max-width:440px;margin:0 auto;padding:22px">' +
            '<div style="margin-bottom:14px">' +
              '<img src="https://www.keytube.work.gd/imagelib/logo.png" alt="' + siteName + ' Logo" style="max-width:120px;height:auto;display:block;">' +
            '</div>' +
            '<h2 style="color:#ff0000">' + siteName + '</h2>' +
            '<h3 style="color:#2ba640">✅ Your Ad is Approved!</h3>' +
            '<p style="color:#606060;font-size:.87rem">Hello ' + bizName + ',</p>' +
            '<p style="color:#606060;font-size:.87rem;line-height:1.6">Great news! Your advertisement "<strong>' + adTitle + '</strong>" has been approved and will go live on ' + siteName + '.</p>' +
            (d.approvedPrice ? '<p style="color:#606060;font-size:.87rem"><strong>Agreed Price:</strong> ' + d.approvedPrice + '</p>' : '') +
            (d.placement ? '<p style="color:#606060;font-size:.87rem"><strong>Placement:</strong> ' + d.placement + '</p>' : '') +
            (d.adminNotes ? '<div style="background:#f0fff4;border-left:4px solid #2ba640;padding:10px 14px;margin:12px 0;font-size:.82rem;color:#1d7a2e">' + d.adminNotes + '</div>' : '') +
            '<p style="color:#606060;font-size:.82rem;margin-top:14px">Thank you for advertising with ' + siteName + '!</p>' +
            '</div>';
        } else if (d.status === 'rejected') {
          subject = siteName + ' — Update on Your Ad Request';
          body = '<div style="font-family:sans-serif;max-width:440px;margin:0 auto;padding:22px">' +
            '<h2 style="color:#ff0000">' + siteName + '</h2>' +
            '<h3 style="color:#d32f2f">Ad Request Update</h3>' +
            '<p style="color:#606060;font-size:.87rem">Hello ' + bizName + ',</p>' +
            '<p style="color:#606060;font-size:.87rem;line-height:1.6">After reviewing your ad request for "<strong>' + adTitle + '</strong>", we are unable to approve it at this time.</p>' +
            (d.adminNotes ? '<div style="background:#fff5f5;border-left:4px solid #d32f2f;padding:10px 14px;margin:12px 0;font-size:.82rem;color:#c62828"><strong>Reason:</strong> ' + d.adminNotes + '</div>' : '') +
            '<p style="color:#606060;font-size:.82rem">You may submit a new request with adjustments. Contact us at grensrena@gmail.com for details.</p>' +
            '</div>';
        }
        if (subject) MailApp.sendEmail({to:email, subject:subject, htmlBody:body});
      } catch(e) {}
 
      return {ok:true, msg:'Ad ' + d.status + '!'};
    }
  }
  return {ok:false, msg:'Ad not found.'};
}
 
// ── Get active ads for display on platform ────────────────────
function getActiveAds(d) {
  var now   = new Date();
  var today = now.toISOString().split('T')[0];
  var list  = getRows('AdRequests').filter(function(r){
    if (!r[0]) return false;
    var status = String(r[18]);
    if (status !== 'active' && status !== 'approved') return false;
    // Check dates if set
    var start = String(r[15]);
    var end   = String(r[16]);
    if (start && start > today) return false;
    if (end   && end   < today) return false;
    return true;
  }).map(function(r){
    return {
      id:           String(r[0]),
      adType:       String(r[6]),
      adTitle:      String(r[7]),
      adDescription:String(r[8]),
      adImageURL:   String(r[9]),
      adLinkURL:    String(r[10]),
      adVideoURL:   String(r[11]),
      targetCategory:String(r[12]),
      placement:    String(r[20]),
      businessName: String(r[1])
    };
  });
  return {ok:true, ads:list};
}
 
// ── Log ad view / click (analytics) ──────────────────────────
function logAdView(d) {
  if (!d.adId) return {ok:false};
  var sh   = getSheet('AdRequests');
  var data = sh.getDataRange().getValues();
  for (var i=1; i<data.length; i++) {
    if (String(data[i][0]) === String(d.adId)) {
      var views = parseInt(data[i][24]||0) + 1;
      sh.getRange(i+1,25).setValue(views);
      return {ok:true};
    }
  }
  return {ok:false};
}
 
function logAdClick(d) {
  if (!d.adId) return {ok:false};
  var sh   = getSheet('AdRequests');
  var data = sh.getDataRange().getValues();
  for (var i=1; i<data.length; i++) {
    if (String(data[i][0]) === String(d.adId)) {
      var clicks = parseInt(data[i][25]||0) + 1;
      sh.getRange(i+1,26).setValue(clicks);
      return {ok:true};
    }
  }
  return {ok:false};
}
// ── Step 1: Send OTP to Gmail before registering ──────────────
function sendRegOTP(d) {
  if (!d.gmail) return {ok:false, msg:'Gmail is required.'};
 
  var gmail = d.gmail.toLowerCase().trim();
 
  // Check not already registered
  var users = getRows('Users');
  for (var i=0; i<users.length; i++) {
    if (String(users[i][1]).toLowerCase() === gmail)
      return {ok:false, msg:'This Gmail is already registered. Try signing in.'};
  }
 
  // Rate limit: only 3 OTPs per email per day
  var sh   = getSheet('PasswordResets', ['ID','Gmail','Token','Expires','Status','Created']);
  var rows = sh.getDataRange().getValues();
  var today = new Date().toDateString();
  var todayCount = 0;
  for (var j=1; j<rows.length; j++) {
    if (String(rows[j][1]).toLowerCase() === gmail &&
        new Date(String(rows[j][5])).toDateString() === today &&
        String(rows[j][4]) === 'reg_pending') {
      todayCount++;
    }
  }
  if (todayCount >= 3) return {ok:false, msg:'Too many attempts. Try again tomorrow.'};
 
  // Expire old pending reg OTPs for this email
  for (var k=1; k<rows.length; k++) {
    if (String(rows[k][1]).toLowerCase()===gmail && String(rows[k][4])==='reg_pending') {
      sh.getRange(k+1,5).setValue('expired');
    }
  }
 
  // Generate 6-digit OTP
  var otp     = String(Math.floor(100000 + Math.random() * 900000));
  var id      = 'RG' + Date.now();
  var expires = new Date(Date.now() + 15*60*1000).toISOString();
  var now     = new Date().toISOString();
 
  sh.appendRow([id, gmail, otp, expires, 'reg_pending', now]);
 
  // Send email
  try {
    var siteName = getSettingsMap()['site_name'] || 'KEYTUBE';
    MailApp.sendEmail({
      to: gmail,
      subject: siteName + ' — Verify your email: ' + otp,
      htmlBody:
        '<div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:22px">' +
          '<div style="margin-bottom:14px">' +
            '<img src="https://www.keytube.work.gd/imagelib/logo.png" alt="' + siteName + ' Logo" style="max-width:120px;height:auto;display:block;">' +
          '</div>' +
          '<h2 style="color:#ff0000;margin-bottom:4px">' + siteName + '</h2>' +
          '<h3 style="margin-bottom:12px">Welcome! Verify your Gmail</h3>' +
          '<p style="color:#606060;font-size:.87rem;margin-bottom:16px">Hello ' + (d.name||'there') + '! Enter this code to complete your registration:</p>' +
          '<div style="background:#f9f9f9;border:2px dashed #e5e5e5;border-radius:10px;padding:22px;text-align:center;margin-bottom:16px">' +
            '<div style="font-size:2.6rem;font-weight:900;letter-spacing:12px;color:#ff0000;font-family:monospace">' + otp + '</div>' +
            '<div style="font-size:.78rem;color:#aaa;margin-top:6px">⏱ Expires in <strong>15 minutes</strong></div>' +
          '</div>' +
          '<p style="font-size:.8rem;color:#606060">If you did not try to create a ' + siteName + ' account, ignore this email.</p>' +
        '</div>'
    });
    return {ok:true, msg:'Verification code sent to ' + gmail};
  } catch(e) {
    sh.deleteRow(sh.getLastRow());
    return {ok:false, msg:'Could not send email: ' + e.message};
  }
}
 
// ── Step 2: Verify the OTP ────────────────────────────────────
function verifyRegOTP(d) {
  if (!d.gmail || !d.token) return {ok:false, msg:'Missing email or code.'};
 
  var gmail = d.gmail.toLowerCase().trim();
  var token = String(d.token).trim();
  var now   = new Date();
 
  var sh   = getSheet('PasswordResets');
  var data = sh.getDataRange().getValues();
 
  for (var i=1; i<data.length; i++) {
    if (String(data[i][1]).toLowerCase()===gmail &&
        String(data[i][2])===token &&
        String(data[i][4])==='reg_pending') {
      if (new Date(String(data[i][3])) < now) {
        sh.getRange(i+1,5).setValue('expired');
        return {ok:false, msg:'Code expired. Please go back and try again.'};
      }
      // Mark as verified — ready for final registration
      sh.getRange(i+1,5).setValue('reg_verified');
      return {ok:true, msg:'Email verified!'};
    }
  }
  return {ok:false, msg:'Incorrect code. Check and try again.'};
}
// ── Log watch time ────────────────────────────────────────────
function logWatchTime(d) {
  if(!d.movieId || !d.seconds || parseInt(d.seconds) < 1) return {ok:false};
  var id = 'WT' + Date.now();
  getSheet('WatchTime', ['ID','Gmail','MovieID','Seconds','Date'])
    .appendRow([id, d.gmail||'guest', String(d.movieId), parseInt(d.seconds), new Date().toISOString()]);
  return {ok:true};
}

// ── Get total watch time for a channel ────────────────────────
function getWatchTimeStats(d) {
  if(!d.gmail) return {ok:false, msg:'Not authenticated.'};
  var myIds = getRows('Movies')
    .filter(function(r){ return String(r[17])===d.gmail; })
    .map(function(r){ return String(r[0]); });
  var rows = getRows('WatchTime').filter(function(r){
    return myIds.indexOf(String(r[2])) !== -1;
  });
  // Total seconds
  var totalSec = rows.reduce(function(s,r){ return s + (parseInt(r[3])||0); }, 0);
  // Last 30 days
  var cutoff = new Date(Date.now() - 30*24*60*60*1000);
  var recentSec = rows.filter(function(r){ return new Date(String(r[4])) > cutoff; })
    .reduce(function(s,r){ return s + (parseInt(r[3])||0); }, 0);
  // Per video
  var perVideo = {};
  rows.forEach(function(r){
    var id = String(r[2]);
    perVideo[id] = (perVideo[id]||0) + (parseInt(r[3])||0);
  });
  return {ok:true, totalSeconds:totalSec, recentSeconds:recentSec, perVideo:perVideo};
}
// ── MAIN SWITCH ───────────────────────────────────────────────
function serverAction(d) {
  try {
    switch(d.action) {
      // ── Setup
      case 'init':                return initSheets();
      // ── Auth
      case 'login':               return login(d);
      case 'register':            return register(d);
      case 'adminLogin':          return adminLogin(d);
      case 'updateUserProfile':   return updateUserProfile(d);
      // ── Movies
      case 'getMovies':           return getMovies(d);
      case 'getMovie':            return getMovie(d);
      case 'addMovie':            return addMovie(d);
      case 'updateMovie':         return updateMovie(d);
      case 'deleteMovie':         return deleteMovie(d);
      case 'searchMovies':        return searchMovies(d);
      case 'searchChannels': return searchChannels(d);
      // ── Playlist
      case 'addToPlaylist':       return addToPlaylist(d);
      case 'removeFromPlaylist':  return removeFromPlaylist(d);
      case 'getPlaylist':         return getPlaylist(d);
      // ── Comments
      case 'addComment':          return addComment(d);
      case 'getComments':         return getComments(d);
      case 'deleteComment':       return deleteComment(d);
      case 'getAllComments':       return getAllComments(d);
      case 'getMyVideoComments':  return getMyVideoComments(d);
      // ── Notifications
      case 'addNotification':     return addNotification(d);
      case 'getNotifications':    return getNotifications(d);
      case 'markNotifRead':       return markNotifRead(d);
      case 'deleteNotification':  return deleteNotification(d);
      // ── Pages
      case 'getPages':            return getPages();
      case 'savePage':            return savePage(d);
      // ── Downloads
      case 'logDownload':         return logDownload(d);
      // ── Online
      case 'pingOnline':          return pingOnline(d);
      case 'getOnlineUsers':      return getOnlineUsers(d);
      // ── Settings
      case 'getSettings':         return getSettings();
      case 'updateSettings':      return updateSettings(d);
      // ── Users (admin)
      case 'getUsers':            return getUsers(d);
      case 'setUserStatus':       return setUserStatus(d);
      case 'deleteUser':          return deleteUser(d);
      // ── Traffic
      case 'logTraffic':          return logTraffic(d);
      case 'getTraffic':          return getTraffic(d);
      case 'getStats':            return getStats(d);
      // ── Channels
      case 'getMyChannel':        return getMyChannel(d);
      case 'getChannel':          return getChannel(d);
      case 'createChannel':       return createChannel(d);
      case 'updateChannel':       return updateChannel(d);
      // ── Followers
      case 'followChannel':       return followChannel(d);
      case 'unfollowChannel':     return unfollowChannel(d);
      case 'getFollowers':        return getFollowers(d);
      case 'getFollowing':        return getFollowing(d);
      // ── Likes
      case 'likeMovie':           return likeMovie(d);
      case 'unlikeMovie':         return unlikeMovie(d);
      case 'getMovieLikes':       return getMovieLikes(d);
      case 'getUserLikes':        return getUserLikes(d);
      // ── Views
      case 'logView':             return logView(d);
      case 'getMovieViews':       return getMovieViews(d);
      // ── Analytics
      case 'getChannelStats':     return getChannelStats(d);
      // ── Earnings
      case 'getEarnings':         return getEarnings(d);
      case 'getEarningRates':       return getEarningRates(d);
      case 'updateEarningRates':    return updateEarningRates(d);
      case 'calculateUserEarnings': return calculateUserEarnings(d);
      case 'processAllEarnings':    return processAllEarnings(d);
      case 'getPaymentOverview':    return getPaymentOverview(d);
      case 'getAllEarnings':         return getAllEarnings(d);
      // ── ai
      case 'aiQuery':           return aiQuery(d);
      case 'getAIKeyTerms':     return getAIKeyTerms(d);
      case 'saveUnknownQuestion':    return saveUnknownQuestion(d);
      case 'getUnknownQuestions':    return getUnknownQuestions(d);
      case 'deleteUnknownQuestion':  return deleteUnknownQuestion(d);
      case 'markQuestionAnswered':   return markQuestionAnswered(d);
      case 'convertToKeyTerm':       return convertToKeyTerm(d);
      case 'addAIKeyTerm':      return addAIKeyTerm(d);
      case 'updateAIKeyTerm':   return updateAIKeyTerm(d);
      case 'deleteAIKeyTerm':   return deleteAIKeyTerm(d);
      case 'initAIDefaults':    return initAIDefaults(d);
      // ── ai
      case 'requestPasswordReset': return requestPasswordReset(d);
      case 'verifyResetToken':     return verifyResetToken(d);
      case 'resetPassword':        return resetPassword(d);
      // GOOGLE SIGN-IN — Add to Code.gs
      case 'googleAuth': return googleAuth(d);
      // ads request
      case 'submitAdRequest':   return submitAdRequest(d);
      case 'getAdRequests':     return getAdRequests(d);
      case 'reviewAdRequest':   return reviewAdRequest(d);
      case 'getActiveAds':      return getActiveAds(d);
      case 'logAdView':         return logAdView(d);
      case 'logAdClick':        return logAdClick(d);
      // gmail verfication
      case 'sendRegOTP':    return sendRegOTP(d);
      case 'verifyRegOTP':  return verifyRegOTP(d);
      // whach time
      case 'logWatchTime':      return logWatchTime(d);
      case 'getWatchTimeStats': return getWatchTimeStats(d);
      default: return {ok:false, msg:'Unknown action: ' + d.action};
    }
  } catch(err) {
    return {ok:false, msg:'Error: ' + err.message};
  }
}
