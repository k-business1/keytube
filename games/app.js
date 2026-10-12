/* ====== AUTH GUARD: LOGIN NOT REQUIRED ====== */
(function () {
try {
if (document.body) {
document.body.classList.add('auth-ok');
} else {
document.addEventListener('DOMContentLoaded', function () {
document.body.classList.add('auth-ok');
});
}
} catch (e) {}
})();

function appLogout() {
try {
if (typeof clearSession === 'function') {
clearSession();
}
} catch (e) {}

location.replace('../pages/login.html');
}

/* ====== CONFIG: paste your Apps Script Web App URL (ends with /exec) ====== */
const CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycby1MTF3mYnWz4DFVb-xWfR0GNJgLym2pxRfkCDXqqQgMnVujHr47d5Jce3ReZdKNmfW/exec',
  REFRESH_MS: 30000   // safe: backend serves the sheet cache, API is hit at most every 2 min
};

const $ = s => document.querySelector(s);
const LIVE = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'];
const DONE = ['FT', 'AET', 'PEN'];
const UPC = ['NS', 'TBD'];
const todayStr = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};

const state = { mode: 'live', date: todayStr(), matches: [], open: new Set(), detail: {}, meta: null, err: '' };

/* ---------- Theme ---------- */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  $('#themeBtn').textContent = t === 'dark' ? '☀️' : '🌙';
  store.set('kt_theme', t);
}
$('#themeBtn').onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
applyTheme(store.get('kt_theme') === 'dark' ? 'dark' : 'light');
$('#logoutBtn').onclick = appLogout;

/* ---------- API ---------- */
async function api(params) {
  const r = await fetch(CONFIG.SCRIPT_URL + '?' + new URLSearchParams(params));
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Request failed');
  return j;
}

async function load() {
  try {
    const date = state.mode === 'live' ? '' : (state.mode === 'today' ? todayStr() : state.date);
    const j = await api(state.mode === 'live' ? { action: 'matches', mode: 'live' } : { action: 'matches', date });
    state.matches = j.data || [];
    state.meta = j;
    state.err = '';
  } catch (e) { state.err = e.message; }
  buildFilters();
  render();
}

async function loadDetail(id) {
  try { state.detail[id] = (await api({ action: 'detail', id })).data; }
  catch (e) { state.detail[id] = { error: e.message }; }
  render();
}

/* ---------- Filters ---------- */
const kind = m => LIVE.includes(m.st) ? 'live' : DONE.includes(m.st) ? 'finished' : UPC.includes(m.st) ? 'upcoming' : 'other';

function buildFilters() {
  const cSel = $('#fCountry'), lSel = $('#fLeague');
  const cVal = cSel.value, lVal = lSel.value;
  const countries = [...new Set(state.matches.map(m => m.lg.country))].sort();
  cSel.innerHTML = '<option value="">All countries</option>' + countries.map(c => `<option>${esc(c)}</option>`).join('');
  cSel.value = countries.includes(cVal) ? cVal : '';
  const leagues = [...new Map(state.matches.filter(m => !cSel.value || m.lg.country === cSel.value).map(m => [m.lg.id, m.lg.name])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  lSel.innerHTML = '<option value="">All leagues</option>' + leagues.map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('');
  lSel.value = leagues.some(([id]) => String(id) === lVal) ? lVal : '';
}

function filtered() {
  const q = $('#q').value.trim().toLowerCase(), c = $('#fCountry').value, l = $('#fLeague').value, s = $('#fStatus').value;
  return state.matches.filter(m =>
    (!c || m.lg.country === c) && (!l || String(m.lg.id) === l) && (!s || kind(m) === s) &&
    (!q || (m.h.name + m.a.name + m.lg.name + m.lg.country).toLowerCase().includes(q)));
}

/* ---------- Render ---------- */
const time = d => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
function statusText(m) {
  if (LIVE.includes(m.st)) return m.st === 'HT' ? 'HALF TIME' : (m.el != null ? `${m.el}'${m.ex ? '+' + m.ex : ''}` : m.st);
  return m.stl || m.st;
}

function detailHTML(id) {
  const d = state.detail[id];
  if (!d) return '<div class="detail">Loading details...</div>';
  if (d.error) return `<div class="detail">${esc(d.error)}</div>`;
  const ev = d.events.length ? d.events.map(e =>
    `<div class="ev"><b>${e.m}'${e.x ? '+' + e.x : ''}</b> ${esc(e.type)} – ${esc(e.p || '')} <small>(${esc(e.d || '')}, ${esc(e.team)})</small></div>`).join('') : '<div class="ev">No events yet.</div>';
  let st = '';
  if (d.stats.length === 2) {
    st = d.stats[0].items.map((it, i) => {
      const o = d.stats[1].items[i] || {};
      return `<div class="stat"><span>${esc(it.v ?? 0)}</span><span>${esc(it.t)}</span><span>${esc(o.v ?? 0)}</span></div>`;
    }).join('');
  }
  return `<div class="detail">${ev}<hr style="border:0;border-top:1px dashed var(--line)">${st}</div>`;
}

function render() {
  const list = filtered();
  const meta = state.meta;
  $('#info').textContent = state.err
    ? '⚠ ' + state.err
    : `${list.length} match(es)` + (meta ? ` · updated ${new Date(meta.updatedAt).toLocaleTimeString()} · ${meta.cached ? 'from shared cache' : 'fresh'}${meta.stale ? ' (stale)' : ''}` : '');
  if (!list.length) { $('#list').innerHTML = '<div class="empty">No matches found.</div>'; return; }

  const groups = new Map();
  list.forEach(m => { if (!groups.has(m.lg.id)) groups.set(m.lg.id, []); groups.get(m.lg.id).push(m); });
  const sorted = [...groups.values()].sort((a, b) => (a[0].lg.country + a[0].lg.name).localeCompare(b[0].lg.country + b[0].lg.name));

  $('#list').innerHTML = sorted.map(ms => {
    const lg = ms[0].lg;
    return `<section class="league"><div class="lg-head">
      <img src="${esc(lg.flag || lg.logo || '')}" alt="" onerror="this.style.visibility='hidden'">
      ${esc(lg.country)} · ${esc(lg.name)}<small>${esc(lg.round || '')}</small></div>` +
      ms.sort((a, b) => a.ts - b.ts).map(m => {
        const has = m.g[0] != null && m.g[1] != null;
        return `<div class="match" data-id="${m.id}">
          <div class="row">
            <div class="team ${m.h.win ? 'win' : ''}"><img src="${esc(m.h.logo)}" alt="" onerror="this.style.visibility='hidden'"><span>${esc(m.h.name)}</span></div>
            <div class="score">${has ? m.g[0] + ' - ' + m.g[1] : time(m.date)}
              <span class="status ${LIVE.includes(m.st) ? 'live' : ''}">${esc(statusText(m))}</span></div>
            <div class="team ${m.a.win ? 'win' : ''}"><img src="${esc(m.a.logo)}" alt="" onerror="this.style.visibility='hidden'"><span>${esc(m.a.name)}</span></div>
          </div>${state.open.has(m.id) ? detailHTML(m.id) : ''}</div>`;
      }).join('') + '</section>';
  }).join('');
}

/* ---------- Events ---------- */
$('#list').addEventListener('click', e => {
  if (e.target.closest('.detail')) return;
  const el = e.target.closest('.match'); if (!el) return;
  const id = Number(el.dataset.id);
  if (state.open.has(id)) state.open.delete(id);
  else { state.open.add(id); if (!state.detail[id]) loadDetail(id); }
  render();
});
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); state.mode = b.dataset.mode; load();
});
$('#dateInput').value = state.date;
$('#dateInput').onchange = e => {
  state.date = e.target.value || todayStr(); state.mode = 'date';
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('active', x.dataset.mode === 'date'));
  load();
};
$('#fCountry').onchange = () => { buildFilters(); render(); };
['#fLeague', '#fStatus'].forEach(s => $(s).onchange = render);
$('#q').oninput = render;
$('#reset').onclick = () => { $('#q').value = ''; $('#fCountry').value = ''; $('#fStatus').value = ''; buildFilters(); render(); };

load();
setInterval(() => { if (!document.hidden) load(); }, CONFIG.REFRESH_MS);
