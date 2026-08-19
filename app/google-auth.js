var GOOGLE_CLIENT_ID = '93133013119-asp5e5op4v9gnkkgq2i7ovftqvqjeih4.apps.googleusercontent.com';

// ── Initialize Google Sign-In ─────────────────────────────────
function initGoogleAuth() {
  if (typeof google === 'undefined' || !google.accounts) {
    // GIS script not loaded yet — retry
    setTimeout(initGoogleAuth, 500);
    return;
  }

  google.accounts.id.initialize({
    client_id:         GOOGLE_CLIENT_ID,
    callback:          handleGoogleCredential,
    auto_select:       false,
    cancel_on_tap_outside: true
  });

  // Render official Google button into our container
  var container = document.getElementById('googleBtnContainer');
  if (container) {
    google.accounts.id.renderButton(container, {
      theme:  'outline',
      size:   'large',
      width:  container.offsetWidth || 320,
      text:   'continue_with',
      shape:  'rectangular',
      logo_alignment: 'left'
    });
  }
}

// ── Handle Google credential response ────────────────────────
function handleGoogleCredential(response) {
  var credential = response.credential;

  // Decode the JWT payload (base64url)
  var parts   = credential.split('.');
  var payload = JSON.parse(decodeBase64url(parts[1]));

  // Extract user info from Google
  var googleId = payload.sub;
  var email    = payload.email;
  var name     = payload.name;
  var picture  = payload.picture;
  var given    = payload.given_name  || '';
  var family   = payload.family_name || '';

  if (!email) { toastErr('Could not get email from Google.'); return; }

  // Show loading state
  showGoogleLoading(true);

  // Send to KEYTUBE backend
  api('googleAuth', {
    googleId:    googleId,
    email:       email,
    name:        name || (given + ' ' + family).trim() || email.split('@')[0],
    picture:     picture || '',
    country:     '',
    googleToken: credential      // sent for server-side verification
  }, function(r) {
    showGoogleLoading(false);
    if (r.ok) {
      // Save session
      setUser(r.user);

      if (r.isNew) {
        toastOK('Welcome to KEYTUBE, ' + (r.user.name || '') + '! 🎉');
        setTimeout(function(){
          window.location.href = '../index.html';
        }, 800);
      } else {
        toastOK('Welcome back, ' + (r.user.name || '') + '! 👋');
        setTimeout(function(){
          var redir = getParam('redirect') || '../index.html';
          window.location.href = redir;
        }, 600);
      }
    } else {
      toastErr(r.msg || 'Google sign-in failed. Try again.');
    }
  });
}

// ── Decode base64url ──────────────────────────────────────────
function decodeBase64url(str) {
  // Convert base64url to base64
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  // Pad to multiple of 4
  while (str.length % 4) str += '=';
  return decodeURIComponent(escape(atob(str)));
}

// ── Loading state for Google button ──────────────────────────
function showGoogleLoading(loading) {
  var wrap = document.getElementById('googleBtnContainer');
  var load = document.getElementById('googleLoadingRow');
  if (wrap) wrap.style.opacity = loading ? '.5' : '1';
  if (load) load.style.display = loading ? 'flex' : 'none';
}

// Expose so inline HTML can call it
window.handleGoogleCredential = handleGoogleCredential;
