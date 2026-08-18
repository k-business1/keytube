// State
var _resetEmail = '';
var _resetToken = '';
var _otpTimerInterval = null;
var _otpSecondsLeft   = 15 * 60;

document.getElementById('pgLoad') && (document.getElementById('pgLoad').style.display = 'none');

// ── STEP NAVIGATION ──────────────────────────────────────────
function goStep(n) {
  [1,2,3,4].forEach(function(i){
    var s = document.getElementById('step'+i);
    if(s) s.style.display = i===n ? '' : 'none';
  });
  [1,2,3].forEach(function(i){
    var r = document.getElementById('rst'+i);
    if(r) r.className = 'rst' + (i<=n?' active':'') + (i<n?' done':'');
  });
  var stepsBar = document.getElementById('resetSteps');
  if(stepsBar) stepsBar.style.display = n===4 ? 'none' : '';
}

// ── STEP 1: Request reset ─────────────────────────────────────
function requestReset() {
  var em  = (document.getElementById('s1Email').value || '').trim().toLowerCase();
  var err = document.getElementById('s1Err');
  err.textContent = '';
  if (!em) { err.textContent = 'Enter your Gmail address.'; return; }
  if (em.indexOf('@gmail.com') === -1) { err.textContent = 'Only Gmail addresses are supported.'; return; }

  var btn = document.getElementById('s1Btn');
  btn.disabled = true; btn.textContent = 'Sending…';

  api('requestPasswordReset', {gmail: em}, function(r) {
    btn.disabled = false; btn.textContent = '📨 Send Reset Code';
    if (r.ok) {
      _resetEmail = em;
      document.getElementById('s2EmailLabel').textContent = em;
      goStep(2);
      startOtpTimer();
      setTimeout(function(){ document.getElementById('otp1').focus(); }, 200);
      toastOK(r.msg);
    } else {
      err.textContent = r.msg;
    }
  });
}

// ── OTP INPUT HANDLING ────────────────────────────────────────
function otpMove(input, nextId) {
  input.value = input.value.replace(/[^0-9]/g,'');
  if (input.value.length === 1 && nextId) {
    var next = document.getElementById(nextId);
    if (next) next.focus();
  }
}

function otpBack(event, prevId, currentId) {
  if (event.key === 'Backspace') {
    var cur = document.getElementById(currentId);
    if (cur && cur.value === '' && prevId) {
      var prev = document.getElementById(prevId);
      if (prev) { prev.value = ''; prev.focus(); }
    }
  }
  if (event.key === 'Enter') verifyOTP();
}

function otpDone(input) {
  otpMove(input, null);
  if (input.value) verifyOTP();
}

function getOTPValue() {
  return ['otp1','otp2','otp3','otp4','otp5','otp6'].map(function(id){
    var el = document.getElementById(id); return el ? el.value : '';
  }).join('');
}

function clearOTP() {
  ['otp1','otp2','otp3','otp4','otp5','otp6'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value = '';
  });
  document.getElementById('otp1').focus();
}

// ── OTP TIMER ─────────────────────────────────────────────────
function startOtpTimer() {
  clearInterval(_otpTimerInterval);
  _otpSecondsLeft = 15 * 60;
  updateTimerDisplay();
  _otpTimerInterval = setInterval(function(){
    _otpSecondsLeft--;
    updateTimerDisplay();
    if (_otpSecondsLeft <= 0) {
      clearInterval(_otpTimerInterval);
      document.getElementById('otpTimerLabel').textContent = 'Code expired. ';
      document.getElementById('otpTimer').textContent = '';
      document.getElementById('resendBtn').style.display = 'inline';
      document.getElementById('s2Btn').disabled = true;
    }
    // Show resend after 60 seconds
    if (_otpSecondsLeft <= 14*60) document.getElementById('resendBtn').style.display = 'inline';
  }, 1000);
}

function updateTimerDisplay() {
  var min = Math.floor(_otpSecondsLeft / 60);
  var sec = _otpSecondsLeft % 60;
  var el  = document.getElementById('otpTimer');
  if (el) el.textContent = (min < 10 ? '0'+min : min) + ':' + (sec < 10 ? '0'+sec : sec);
  // Turn red in last 2 minutes
  if (el) el.style.color = _otpSecondsLeft < 120 ? 'var(--red)' : 'var(--blue)';
}

function resendCode() {
  clearOTP();
  clearInterval(_otpTimerInterval);
  document.getElementById('s2Btn').disabled = false;
  document.getElementById('s2Err').textContent = '';
  document.getElementById('resendBtn').style.display = 'none';
  document.getElementById('otpTimerLabel').textContent = 'Code expires in ';

  var btn = document.getElementById('resendBtn');
  api('requestPasswordReset', {gmail: _resetEmail}, function(r){
    if (r.ok) { startOtpTimer(); toastOK('New code sent! Check your Gmail.'); }
    else { toastErr(r.msg); }
  });
}

// ── STEP 2: Verify OTP ───────────────────────────────────────
function verifyOTP() {
  var code = getOTPValue();
  var err  = document.getElementById('s2Err');
  err.textContent = '';
  if (code.length < 6) { err.textContent = 'Enter the full 6-digit code.'; return; }

  var btn = document.getElementById('s2Btn');
  btn.disabled = true; btn.textContent = 'Verifying…';

  // Shake animation on inputs while verifying
  api('verifyResetToken', {gmail: _resetEmail, token: code}, function(r) {
    btn.disabled = false; btn.textContent = '✅ Verify Code';
    if (r.ok) {
      _resetToken = code;
      clearInterval(_otpTimerInterval);
      goStep(3);
      setTimeout(function(){ document.getElementById('s3Pw').focus(); }, 200);
    } else {
      err.textContent = r.msg;
      // Shake OTP inputs
      var otpWrap = document.querySelector('.otp-wrap');
      if (otpWrap) {
        otpWrap.style.animation = 'shake .4s';
        setTimeout(function(){ otpWrap.style.animation = ''; clearOTP(); }, 450);
      }
    }
  });
}

// ── PASSWORD STRENGTH ─────────────────────────────────────────
function checkPwStrength(pw) {
  var wrap  = document.getElementById('pwStrengthWrap');
  var fill  = document.getElementById('pwStrengthFill');
  var label = document.getElementById('pwStrengthLabel');
  if (!pw) { wrap.style.display='none'; return; }
  wrap.style.display = '';
  var score = 0;
  if (pw.length >= 6)  score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  var levels = [
    {pct:'20%', color:'#ef5350', text:'Very Weak'},
    {pct:'40%', color:'#ff7043', text:'Weak'},
    {pct:'60%', color:'#ffa726', text:'Fair'},
    {pct:'80%', color:'#66bb6a', text:'Strong'},
    {pct:'100%',color:'#43a047', text:'Very Strong'}
  ];
  var lv = levels[Math.min(score-1, 4)] || levels[0];
  fill.style.width = lv.pct;
  fill.style.background = lv.color;
  label.textContent = lv.text;
  label.style.color = lv.color;
}

// ── STEP 3: Reset Password ────────────────────────────────────
function doResetPassword() {
  var pw  = document.getElementById('s3Pw').value;
  var pw2 = document.getElementById('s3Pw2').value;
  var err = document.getElementById('s3Err');
  err.textContent = '';
  if (!pw)           { err.textContent = 'Enter your new password.'; return; }
  if (pw.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }
  if (pw !== pw2)    { err.textContent = 'Passwords do not match.'; return; }

  var btn = document.getElementById('s3Btn');
  btn.disabled = true; btn.textContent = 'Resetting…';

  api('resetPassword', {gmail: _resetEmail, token: _resetToken, newPassword: pw}, function(r){
    btn.disabled = false; btn.textContent = '🔒 Set New Password';
    if (r.ok) {
      goStep(4);
      toastOK(r.msg);
    } else {
      err.textContent = r.msg;
    }
  });
}