// ── State ─────────────────────────────────────────────────────
var _regData = {name:'',gmail:'',password:'',country:''};
var _regAvatarURL = '';
var _regTimerInterval = null;
var _regSeconds = 15 * 60;
 
document.getElementById('pgLoad') && (document.getElementById('pgLoad').style.display='none');
if(getUser()) window.location.href='../index.html';
 
// ── STEP NAVIGATION ───────────────────────────────────────────
function goRegStep(n){
  [1,2,3].forEach(function(i){
    var s=document.getElementById('regStep'+i);
    if(s)s.style.display=i===n?'':'none';
    var r=document.getElementById('rs'+i);
    if(r)r.className='rst'+(i<=n?' active':'')+(i<n?' done':'');
    var l=document.getElementById('rl'+i);
    if(l&&i<3)l.style.background=i<n?'var(--green)':'var(--brd)';
  });
}
 
// ── STEP 1: Collect details + send OTP ───────────────────────
function regStep1(){
  var nm  = document.getElementById('regName').value.trim();
  var em  = document.getElementById('regEmail').value.trim().toLowerCase();
  var pw  = document.getElementById('regPassword').value;
  var pw2 = document.getElementById('regPassword2').value;
  var co  = document.getElementById('regCountry').value;
  var tc  = document.getElementById('termsCheck');
  var er  = document.getElementById('s1Err');
  er.textContent = '';
 
  if (!nm)         { er.textContent='Enter your full name.'; return; }
  if (!em)         { er.textContent='Enter your Gmail address.'; return; }
  if (em.indexOf('@gmail.com')===-1) { er.textContent='Only Gmail addresses are supported.'; return; }
  if (!pw)         { er.textContent='Enter a password.'; return; }
  if (pw.length<6) { er.textContent='Password must be at least 6 characters.'; return; }
  if (pw!==pw2)    { er.textContent='Passwords do not match.'; return; }
  if (tc&&!tc.checked) { er.textContent='Please accept the terms to continue.'; return; }
 
  _regData = {name:nm, gmail:em, password:pw, country:co};
 
  var btn=document.getElementById('s1Btn');
  btn.disabled=true; btn.textContent='Sending code…';
 
  api('sendRegOTP',{gmail:em, name:nm}, function(r){
    btn.disabled=false; btn.textContent='Continue → Send Verification';
    if(r.ok){
      document.getElementById('s2EmailLabel').textContent=em;
      goRegStep(2);
      startRegTimer();
      setTimeout(function(){document.getElementById('o1').focus();},200);
      toastOK(r.msg);
    } else {
      er.textContent=r.msg;
    }
  });
}
 
// ── OTP INPUT ─────────────────────────────────────────────────
function otpMove(input,nextId){
  input.value=input.value.replace(/[^0-9]/g,'');
  if(input.value&&nextId){var n=document.getElementById(nextId);if(n)n.focus();}
}
function otpBack(event,prevId,curId){
  if(event.key==='Backspace'){var c=document.getElementById(curId);if(c&&c.value===''&&prevId){var p=document.getElementById(prevId);if(p){p.value='';p.focus();}}}
  if(event.key==='Enter')regStep2();
}
function otpDone(input){otpMove(input,null);if(input.value)regStep2();}
function getOTP(){return['o1','o2','o3','o4','o5','o6'].map(function(id){var e=document.getElementById(id);return e?e.value:'';}).join('');}
function clearOTP(){['o1','o2','o3','o4','o5','o6'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});document.getElementById('o1').focus();}
 
// ── OTP TIMER ─────────────────────────────────────────────────
function startRegTimer(){
  clearInterval(_regTimerInterval);
  _regSeconds=15*60;
  updateRegTimer();
  _regTimerInterval=setInterval(function(){
    _regSeconds--;updateRegTimer();
    if(_regSeconds<=0){clearInterval(_regTimerInterval);document.getElementById('regResendBtn').style.display='inline';}
    if(_regSeconds<=14*60)document.getElementById('regResendBtn').style.display='inline';
  },1000);
}
function updateRegTimer(){
  var m=Math.floor(_regSeconds/60),s=_regSeconds%60;
  var el=document.getElementById('regTimer');
  if(el){el.textContent=(m<10?'0'+m:m)+':'+(s<10?'0'+s:s);el.style.color=_regSeconds<120?'var(--red)':'var(--blue)';}
}
function resendRegOTP(){
  clearOTP();document.getElementById('regResendBtn').style.display='none';
  document.getElementById('s2Err').textContent='';
  api('sendRegOTP',{gmail:_regData.gmail,name:_regData.name},function(r){
    if(r.ok){startRegTimer();toastOK('New code sent!');}
    else toastErr(r.msg);
  });
}
 
// ── STEP 2: Verify OTP ───────────────────────────────────────
function regStep2(){
  var code=getOTP();
  var er=document.getElementById('s2Err');er.textContent='';
  if(code.length<6){er.textContent='Enter the full 6-digit code.';return;}
 
  var btn=document.getElementById('s2Btn');
  btn.disabled=true;btn.textContent='Verifying…';
 
  api('verifyRegOTP',{gmail:_regData.gmail,token:code},function(r){
    btn.disabled=false;btn.textContent='✅ Verify Code';
    if(r.ok){
      clearInterval(_regTimerInterval);
      // Show user initial in avatar circle
      var init=_regData.name[0].toUpperCase();
      var ai=document.getElementById('regAvInitial');if(ai)ai.textContent=init;
      goRegStep(3);
    } else {
      er.textContent=r.msg;
      var wrap=document.querySelector('.otp-wrap');
      if(wrap){wrap.style.animation='shake .4s';setTimeout(function(){wrap.style.animation='';clearOTP();},450);}
    }
  });
}
 
// ── STEP 3: Avatar upload + create account ───────────────────
function previewRegAvatar(input){
  var file=input.files[0];if(!file)return;
  if(file.size>5*1024*1024){toastErr('Image must be under 5MB');return;}
 
  // Preview
  var reader=new FileReader();
  reader.onload=function(e){
    var img=document.getElementById('regAvImg');
    var ph=document.getElementById('regAvPlaceholder');
    if(img){img.src=e.target.result;img.style.display='block';}
    if(ph)ph.style.display='none';
  };
  reader.readAsDataURL(file);
 
  // Upload to Cloudinary
  var prog=document.getElementById('regAvProgress'),bar=document.getElementById('regAvBar'),pct=document.getElementById('regAvPct');
  if(prog)prog.style.display='block';
 
  uploadToCloudinary(file,CDN_USER,function(p){
    if(bar)bar.style.width=p+'%';if(pct)pct.textContent=p+'%';
  }).then(function(res){
    _regAvatarURL=res.url;
    if(prog)prog.style.display='none';
    toastOK('Photo ready ✓');
  }).catch(function(e){
    if(prog)prog.style.display='none';
    toastErr('Upload failed: '+e.message);
  });
}
 
function regStep3(skip){
  var er=document.getElementById('s3Err');er.textContent='';
  var btn=document.getElementById('s3Btn');
  btn.disabled=true;btn.textContent='Creating account…';
 
  api('register',{
    name:     _regData.name,
    gmail:    _regData.gmail,
    password: _regData.password,
    country:  _regData.country,
    avatar:   skip?'':(_regAvatarURL||'')
  }, function(r){
    btn.disabled=false;btn.textContent='🎉 Create Account';
    if(r.ok){
      setUser(r.user);
      toastOK('Welcome to KEYTUBE, '+_regData.name+'! 🎉');
      setTimeout(function(){window.location.href='../index.html';},700);
    } else {
      er.textContent=r.msg;
    }
  });
}
 
// ── PASSWORD STRENGTH ─────────────────────────────────────────
function checkPwStrength(pw){
  var wrap=document.getElementById('pwStrWrap'),fill=document.getElementById('pwStrFill'),label=document.getElementById('pwStrLabel');
  if(!pw){wrap.style.display='none';return;}
  wrap.style.display='';
  var score=0;
  if(pw.length>=6)score++;if(pw.length>=10)score++;
  if(/[A-Z]/.test(pw))score++;if(/[0-9]/.test(pw))score++;if(/[^A-Za-z0-9]/.test(pw))score++;
  var levels=[{p:'20%',c:'#ef5350',t:'Very Weak'},{p:'40%',c:'#ff7043',t:'Weak'},{p:'60%',c:'#ffa726',t:'Fair'},{p:'80%',c:'#66bb6a',t:'Strong'},{p:'100%',c:'#43a047',t:'Very Strong'}];
  var lv=levels[Math.min(score-1,4)]||levels[0];
  fill.style.width=lv.p;fill.style.background=lv.c;label.textContent=lv.t;label.style.color=lv.c;
}
