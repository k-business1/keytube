// ── wallet.js ─────────────────────────────────────────────────
var _walletUser = null;
var _walletEarnings = [];
var _walletRates = {};

function initWalletPage(){
  var pgL = document.getElementById('pgLoad');
  var u   = getUser();
  if(!u){
    if(pgL) pgL.style.display = 'none';
    var lr = document.getElementById('loginReq');
    if(lr) lr.classList.add('show');
    return;
  }
  _walletUser = u;
  if(pgL) pgL.style.display = 'none';
  updateNavUI();
  startPing();

  // Load everything in parallel
  loadWalletBalance();
  loadMonetizationStatus();
  loadEarningRates();
  loadEarningsBreakdown();
}

// ── BALANCE ────────────────────────────────────────────────────
function loadWalletBalance(){
  var u = _walletUser;
  api('getEarnings', {gmail: u.gmail}, function(r){
    if(!r.ok) return;
    _walletEarnings = r.earnings || [];

    // Total earned (excluding withdrawals)
    var total = _walletEarnings
      .filter(function(e){ return e.type !== 'withdrawal' && e.status === 'paid'; })
      .reduce(function(s,e){ return s + parseFloat(e.amount||0); }, 0);

    // Total withdrawn
    var withdrawn = _walletEarnings
      .filter(function(e){ return e.type === 'withdrawal'; })
      .reduce(function(s,e){ return s + parseFloat(e.amount||0); }, 0);

    // Pending
    var pending = _walletEarnings
      .filter(function(e){ return e.status === 'pending'; })
      .reduce(function(s,e){ return s + parseFloat(e.amount||0); }, 0);

    // Available = total earned - withdrawn
    var available = Math.max(0, total - withdrawn);

    // This month
    var now = new Date();
    var thisMonth = _walletEarnings
      .filter(function(e){
        var d = new Date(e.date);
        return d.getMonth() === now.getMonth() &&
               d.getFullYear() === now.getFullYear() &&
               e.type !== 'withdrawal';
      })
      .reduce(function(s,e){ return s + parseFloat(e.amount||0); }, 0);

    // Set UI
    setText('walletBalance',   available.toFixed(2));
    setText('wTotalEarned',    '$'+total.toFixed(2));
    setText('wTotalWithdrawn', '$'+withdrawn.toFixed(2));
    setText('wThisMonth',      '$'+thisMonth.toFixed(2));
    setText('walletPending',   '$'+pending.toFixed(2)+' pending');

    // Render transactions
    renderTransactions(_walletEarnings);
  });
}

// ── MONETIZATION STATUS ────────────────────────────────────────
function loadMonetizationStatus(){
  var u = _walletUser;
  api('getFollowers', {gmail: u.gmail}, function(fr){
    if(!fr.ok) return;
    api('getEarningRates', {}, function(rr){
      var threshold = rr.ok ? rr.rates.monetize_threshold : 1000;
      var count     = fr.count || 0;
      var pct       = Math.min((count / threshold) * 100, 100);
      var unlocked  = count >= threshold;

      // Progress bar
      var bar = document.getElementById('mscBar');
      if(bar) bar.style.width = pct + '%';

      // Icon & title
      setText('mscIcon',  unlocked ? '💰' : '🔒');
      setText('mscTitle', unlocked ? '✅ Monetization Active' : '🔒 Monetization Locked');
      setText('mscDesc',  unlocked
        ? 'Your channel is monetized. You earn from every view, like, comment and new follower.'
        : 'You need ' + (threshold - count).toLocaleString() + ' more followers to unlock earnings. ('
          + count.toLocaleString() + ' / ' + threshold.toLocaleString() + ')');
      setText('mscCurrent', count.toLocaleString() + ' followers');

      // Rates display
      if(rr.ok) renderRatesInfo(rr.rates, unlocked);

      // Unlock badge color
      var card = document.getElementById('monetizeStatusCard');
      if(card){
        card.style.borderColor = unlocked ? 'rgba(43,166,64,.3)' : 'var(--brd)';
        card.style.background  = unlocked ? 'rgba(43,166,64,.03)' : '';
      }
    });
  });
}

// ── EARNING RATES INFO ────────────────────────────────────────
function loadEarningRates(){
  api('getEarningRates', {}, function(r){
    if(r.ok) _walletRates = r.rates;
  });
}

function renderRatesInfo(rates, unlocked){
  var el = document.getElementById('earningRatesInfo');
  if(!el) return;
  if(!unlocked){ el.style.display = 'none'; return; }
  el.style.display = '';
  el.innerHTML =
    '<div style="font-size:.82rem;font-weight:700;margin-bottom:10px;color:var(--txt)">📊 Your Earning Rates</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
      makeRateChip('👁','Per View',   rates.rate_per_view)+
      makeRateChip('❤️','Per Like',   rates.rate_per_like)+
      makeRateChip('💬','Per Comment',rates.rate_per_comment)+
      makeRateChip('👥','Per Follower',rates.rate_per_follower)+
    '</div>';
}

function makeRateChip(icon, label, rate){
  return '<div style="background:var(--bg);border:1px solid var(--brd);border-radius:var(--r2px);padding:8px 10px">'+
    '<div style="font-size:.75rem;color:var(--t2)">'+icon+' '+label+'</div>'+
    '<div style="font-size:.88rem;font-weight:700;color:var(--green);margin-top:2px">$'+parseFloat(rate||0).toFixed(4)+'</div>'+
  '</div>';
}

// ── TRANSACTIONS ──────────────────────────────────────────────
function renderTransactions(list){
  var tl = document.getElementById('transactionsList');
  var te = document.getElementById('txEmpty');
  if(!tl) return;
  tl.innerHTML = '';

  if(!list.length){
    if(te) te.classList.remove('hidden');
    return;
  }
  if(te) te.classList.add('hidden');

  list.slice(0, 80).forEach(function(e){
    tl.appendChild(makeTxItem(e));
  });
}

function filterTransactions(v){
  var filtered = v === 'all'
    ? _walletEarnings
    : _walletEarnings.filter(function(e){ return e.type === v || e.status === v; });
  renderTransactions(filtered);
}

function makeTxItem(e){
  var d   = document.createElement('div');
  d.className = 'tx-item';
  var typeInfo = {
    view_revenue:    {icon:'👁',  label:'View Revenue',    color:'var(--blue)'},
    like_revenue:    {icon:'❤️',  label:'Like Revenue',    color:'var(--red)'},
    comment_revenue: {icon:'💬',  label:'Comment Revenue', color:'var(--green)'},
    follower_bonus:  {icon:'👥',  label:'Follower Bonus',  color:'var(--gold)'},
    withdrawal:      {icon:'💸',  label:'Withdrawal',      color:'var(--t2)'},
    bonus:           {icon:'⭐',  label:'Bonus',           color:'var(--gold)'}
  };
  var info    = typeInfo[e.type] || {icon:'💰', label:e.type||'Earning', color:'var(--green)'};
  var isDebit = e.type === 'withdrawal';
  var amt     = parseFloat(e.amount || 0);

  d.innerHTML =
    '<div style="width:36px;height:36px;border-radius:50%;background:var(--bg2);display:grid;place-items:center;font-size:1.1rem;flex-shrink:0">'+info.icon+'</div>'+
    '<div style="flex:1;min-width:0">'+
      '<div style="font-size:.82rem;font-weight:600;color:var(--txt)">'+info.label+'</div>'+
      '<div style="font-size:.73rem;color:var(--t2);margin-top:2px">'+h(e.description||'')+'</div>'+
      '<div style="font-size:.69rem;color:var(--t3);margin-top:2px">'+fmtDate(e.date)+'</div>'+
    '</div>'+
    '<div style="font-weight:700;font-size:.9rem;color:'+(isDebit?'var(--red)':'var(--green)')+'">'+
      (isDebit?'-':'+')+'$'+amt.toFixed(4)+
    '</div>';
  return d;
}

// ── EARNINGS BREAKDOWN ────────────────────────────────────────
function loadEarningsBreakdown(){
  var u = _walletUser;
  api('getEarnings', {gmail: u.gmail}, function(r){
    if(!r.ok) return;
    var list = r.earnings || [];

    var breakdown = {
      view_revenue:    0,
      like_revenue:    0,
      comment_revenue: 0,
      follower_bonus:  0
    };
    list.filter(function(e){ return e.status==='paid' && e.type!=='withdrawal'; })
        .forEach(function(e){
          if(breakdown[e.type] !== undefined)
            breakdown[e.type] += parseFloat(e.amount||0);
        });

    var ebv = document.getElementById('earningsByVideo');
    var ebe = document.getElementById('ebvEmpty');
    if(!ebv) return;

    var total = breakdown.view_revenue + breakdown.like_revenue +
                breakdown.comment_revenue + breakdown.follower_bonus;

    if(total <= 0){
      if(ebe) ebe.classList.remove('hidden');
      return;
    }
    if(ebe) ebe.classList.add('hidden');

    ebv.innerHTML = makeBreakdownBar('👁 Views',    breakdown.view_revenue,    total, 'var(--blue)')+
                    makeBreakdownBar('❤️ Likes',    breakdown.like_revenue,    total, 'var(--red)')+
                    makeBreakdownBar('💬 Comments', breakdown.comment_revenue, total, 'var(--green)')+
                    makeBreakdownBar('👥 Followers',breakdown.follower_bonus,  total, '#b8860b');
  });
}

function makeBreakdownBar(label, amount, total, color){
  var pct   = total > 0 ? Math.round((amount / total) * 100) : 0;
  return '<div style="margin-bottom:12px">'+
    '<div style="display:flex;justify-content:space-between;font-size:.79rem;margin-bottom:4px">'+
      '<span style="font-weight:500">'+label+'</span>'+
      '<span style="color:var(--green);font-weight:700">$'+amount.toFixed(4)+' <span style="color:var(--t3);font-weight:400">('+pct+'%)</span></span>'+
    '</div>'+
    '<div style="height:7px;background:var(--bg2);border-radius:4px;overflow:hidden">'+
      '<div style="height:100%;width:'+pct+'%;background:'+color+';border-radius:4px;transition:width .5s"></div>'+
    '</div>'+
  '</div>';
}

// ── WALLET TABS ───────────────────────────────────────────────
function showWalletTab(tab){
  document.querySelectorAll('.wtab').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('.wallet-tab-panel').forEach(function(p){ p.classList.remove('active'); });
  var btn   = document.getElementById('wtab-'+tab);
  var panel = document.getElementById('wpanel-'+tab);
  if(btn)   btn.classList.add('active');
  if(panel) panel.classList.add('active');
}

// ── WITHDRAW MODAL ────────────────────────────────────────────
function showWithdraw(){
  // Check balance first
  var balEl = document.getElementById('walletBalance');
  var bal   = parseFloat(balEl ? balEl.textContent : '0');
  var minPay = parseFloat(_walletRates.min_payout || '5');

  if(bal < minPay){
    toast('Minimum withdrawal is $'+minPay.toFixed(2)+'. Your balance: $'+bal.toFixed(2),'terr');
    return;
  }
  var wm = document.getElementById('withdrawModal');
  if(wm) wm.classList.remove('hidden');
  // Pre-fill max amount
  var amtEl = document.getElementById('wdAmount');
  if(amtEl) amtEl.value = bal.toFixed(2);
}

function closeWithdraw(){
  var wm = document.getElementById('withdrawModal');
  if(wm) wm.classList.add('hidden');
}

function showAddMoney(){
  toast('Contact support to add funds to your wallet.', 'tinfo');
}

function submitWithdrawal(){
  var u   = _walletUser; if(!u) return;
  var amt = document.getElementById('wdAmount');
  var meth= document.getElementById('wdMethod');
  var er  = document.getElementById('wdErr');
  if(er) er.textContent = '';

  if(!amt || !parseFloat(amt.value) || parseFloat(amt.value) <= 0){
    if(er) er.textContent = 'Enter a valid amount.'; return;
  }
  var minPay = parseFloat(_walletRates.min_payout || '5');
  if(parseFloat(amt.value) < minPay){
    if(er) er.textContent = 'Minimum withdrawal is $'+minPay.toFixed(2)+'.'; return;
  }
  if(!meth || !meth.value){
    if(er) er.textContent = 'Select a payment method.'; return;
  }

  var phone = document.getElementById('wdPhone');
  var bank  = document.getElementById('wdBank');
  var detail= (phone && phone.style.display!=='none') ? phone.value : (bank ? bank.value : '');

  if(!detail.trim()){
    if(er) er.textContent = 'Enter your account/phone number.'; return;
  }

  // Log withdrawal request to Earnings sheet (status=pending)
  var btn = document.querySelector('#withdrawModal .st-btn-red');
  if(btn){ btn.disabled=true; btn.textContent='Submitting…'; }

  // We simulate saving — in production connect to your backend
  toast('Withdrawal request of $'+parseFloat(amt.value).toFixed(2)+' submitted! Processing in 3–5 days.','tok');
  closeWithdraw();
  if(btn){ btn.disabled=false; btn.textContent='Request Withdrawal'; }
}

function filterTransactionsUI(v){
  filterTransactions(v);
}

function savePayoutSettings(){
  toast('Payout settings saved ✓','tok');
}

// ── HELPERS ───────────────────────────────────────────────────
function setText(id, val){
  var el = document.getElementById(id);
  if(el) el.textContent = val;
}
function h(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtDate(d){ var dt=new Date(d); return isNaN(dt)?d||'':dt.toLocaleDateString(); }
