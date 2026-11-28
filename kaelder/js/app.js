/* Min kælder — app: datakilder, navigation, globale filtre, skuffer og import. */
'use strict';

const A = window.A = { db: null, all: [], view: [], route: { page: 'overblik' }, back: [], ui: {}, src: { mode: 'none' }, history: [], catalog: {}, log: [] };
const $ = function (id) { return document.getElementById(id); };

const PAGES = [
  ['overblik', 'Overblik'], ['samling', 'Min samling'], ['geografi', 'Geografi'], ['druer', 'Druer & vintyper'], ['producenter', 'Producenter'],
  ['vaerdi', 'Værdi & priser'], ['udvikling', 'Udvikling'], ['lab', 'Cellar Lab'], '-', ['vinkort', 'Vinkort'], ['mad', 'Mad og vin'], '-', ['data', 'Data & synk']
];

/* ---------------------------------------------------------------- datakilder */

A.load = async function () {
  const s = K.settings();
  A.notice = '';
  if (s.syncUrl && s.syncKey) {
    try {
      $('src-line').textContent = 'Henter fra CellarTracker-synk …';
      const res = await fetch(s.syncUrl + (s.syncUrl.indexOf('?') >= 0 ? '&' : '?') + 'key=' + encodeURIComponent(s.syncKey), { redirect: 'follow' });
      const p = await res.json();
      if (!p.ok) throw new Error(p.error || 'Ukendt fejl');
      K.store.set('lastPayload', p);
      A.usePayload(p, true);
      return;
    } catch (e) {
      const p = K.store.get('lastPayload', null);
      A.notice = 'Kunne ikke hente fra synkroniseringen (' + (e.message || e) + '). ' + (p ? 'Viser de senest hentede data.' : '');
      if (p) { A.usePayload(p, false); return; }
    }
  }
  const t = K.store.get('tables', null);
  if (t && t.List) {
    A.src = { mode: 'local', live: false, imported: K.store.get('importedAt', null) };
    A.history = K.store.get('history', []);
    A.catalog = K.store.get('catalog', {});
    A.log = K.store.get('log', []);
    A.setDb(K.build(t));
    return;
  }
  if (window.EMBEDDED && window.EMBEDDED.List) {
    A.src = { mode: 'demo', live: false, imported: window.EMBEDDED.date };
    A.history = [];
    A.setDb(K.build(window.EMBEDDED));
    return;
  }
  A.src = { mode: 'none' };
  A.setDb(K.build({ List: '' }));
};

A.usePayload = function (p, live) {
  A.src = { mode: 'sync', live: live, status: p.status || {}, ai: !!p.ai, next: p.nextSync, pendingList: p.pendingList };
  A.history = p.history || [];
  A.catalog = p.catalog || {};
  A.log = p.log || [];
  if (p.aliases) K.store.set('aliases', p.aliases);
  if (p.settings && Array.isArray(p.settings.weekendLocations)) K.saveSettings({ weekendLocations: p.settings.weekendLocations });
  A.setDb(K.build(p.tables || {}));
};

A.setDb = function (db) {
  A.db = db; A.all = db.items;
  A.refresh();
};

A.sourceText = function () {
  const s = A.src;
  if (s.mode === 'sync') return (s.live ? 'Synk fra CellarTracker' : 'Synk – ikke opdateret') + ' · ' + K.date(s.status && s.status.lastSuccess, true);
  if (s.mode === 'local') return 'Importeret fil · ' + K.date(s.imported, true);
  if (s.mode === 'demo') return 'Forhåndsvisning · eksport ' + K.date(s.imported);
  return 'Ingen data endnu';
};

/* ---------------------------------------------------------------- navigation */

A.go = function (page, extra, noPush) {
  if (!noPush) A.back.push(A.route);
  if (A.back.length > 40) A.back.shift();
  A.route = Object.assign({ page: page }, extra || {});
  try { if (location.hash.slice(1) !== page) history.replaceState(null, '', '#' + page); } catch (e) { /* */ }
  A.render(); window.scrollTo(0, 0);
};
A.goBack = function () {
  const r = A.back.pop();
  if (r) { A.route = r; try { history.replaceState(null, '', '#' + r.page); } catch (e) { /* */ } A.render(); }
  else A.go('overblik', null, true);
};
A.profile = function (dim, key) { A.go('profil', { dim: dim, key: key }); };

A.refresh = function () {
  A.view = K.apply(A.all, K.filters);
  A.renderNav(); A.renderFilters(); A.render();
};

A.renderNav = function () {
  $('nav').innerHTML = PAGES.map(function (p) {
    if (p === '-') return '<div class="sep"></div>';
    const on = A.route.page === p[0] || (A.route.page === 'profil' && p[0] === A.profileSection());
    return '<a href="#' + p[0] + '" data-nav="' + p[0] + '" class="' + (on ? 'on' : '') + '">' + p[1] + '</a>';
  }).join('');
  $('src-line').textContent = A.sourceText();
  const st = A.db ? K.stats(A.all) : null;
  $('foot').innerHTML = st && st.bottles ? K.n0(st.bottles) + ' flasker i alt<br>' + K.n0(st.wines) + ' vine · ' + K.money(st.value) + (A.src.mode === 'sync' ? '<br>Næste synk: ' + K.esc(A.src.next || 'dagligt') : '') : '';
};
A.profileSection = function () {
  const d = A.route.dim;
  return ['country', 'region', 'subregion', 'appellation', 'vineyard'].indexOf(d) >= 0 ? 'geografi' : ['producer', 'producerRaw'].indexOf(d) >= 0 ? 'producenter' : ['grape', 'varietal', 'color', 'cls'].indexOf(d) >= 0 ? 'druer' : '';
};

A.render = function () {
  U.resetReg();
  const v = $('view');
  const fn = P[A.route.page] || P.overblik;
  try { v.innerHTML = fn(); } catch (e) { console.error(e); v.innerHTML = '<div class="note bad">Siden kunne ikke vises: ' + K.esc(e.message) + '</div>'; }
  A.renderNav();
  if (P.after) P.after();
};

/* ---------------------------------------------------------------- filterlinje */

const FILTER_MAIN = ['location', 'country', 'region', 'producer', 'grape', 'color', 'cls', '#vintage', '#price', 'size', 'store'];
const FILTER_MORE = ['subregion', 'appellation', 'vineyard', 'varietal', 'producerRaw', 'type', 'priceBand'];

A.renderFilters = function () {
  const db = A.db; const f = K.filters;
  if (!db || !A.all.length) { $('fbar').innerHTML = ''; $('fbar').hidden = true; return; }
  $('fbar').hidden = false;
  const avail = K.dimsAvailable(db);
  const btn = function (d) {
    if (d === '#vintage') return '<button class="fbtn" data-fpop="#vintage">Årgang' + (f.vintage || !f.nv ? ' <span class="n">1</span>' : '') + '</button>';
    if (d === '#price') return '<button class="fbtn" data-fpop="#price">Pris' + (f.price || !f.zeroPrice ? ' <span class="n">1</span>' : '') + '</button>';
    if (avail.indexOf(d) < 0) return '';
    const n = f.dims[d] ? f.dims[d].vals.size : 0;
    return '<button class="fbtn' + (d === 'location' ? ' loc' : '') + '" data-fpop="' + d + '">' + K.DIMS[d].label + (n ? ' <span class="n">' + n + '</span>' : '') + '</button>';
  };
  const st = K.stats(A.view), tot = K.sum(A.all);
  const wk = (K.settings().weekendLocations || []).filter(function (l) { return db.locations.indexOf(l) >= 0; });
  let h = '<div class="fbar-row">' + FILTER_MAIN.map(btn).join('') +
    '<button class="fbtn" data-fpop="#more">Flere filtre</button>' +
    (db.hasLoc && wk.length ? '<button class="fbtn" data-weekend="1" title="Røde vine på ' + K.esc(wk.join(', ')) + '">Weekendvine</button>' : '') +
    '<span class="fsum num">' + (st.bottles === tot ? K.n0(tot) + ' fl.' : K.n0(st.bottles) + ' af ' + K.n0(tot) + ' fl.') + ' · ' + K.n0(st.wines) + ' vine · ' + K.money(st.value) + '</span></div>';
  // chips
  let chips = '';
  Object.keys(f.dims).forEach(function (d) {
    const fd = f.dims[d]; if (!fd.vals.size) return;
    const names = Array.from(fd.vals).map(function (k) { return K.dimName(d, k); });
    chips += '<span class="chip' + (fd.mode === 'out' ? ' out' : '') + '">' + K.DIMS[d].label + (fd.mode === 'out' ? ' undtagen' : '') + ': <b>' + K.esc(names.slice(0, 3).join(', ') + (names.length > 3 ? ' +' + (names.length - 3) : '')) + '</b><button data-unf="' + d + '" aria-label="Fjern filter">×</button></span>';
  });
  if (f.vintage) chips += '<span class="chip">Årgang: <b>' + f.vintage[0] + '–' + f.vintage[1] + '</b><button data-unf="#vintage" aria-label="Fjern">×</button></span>';
  if (!f.nv) chips += '<span class="chip">Uden NV<button data-unf="#nv" aria-label="Fjern">×</button></span>';
  if (f.price) chips += '<span class="chip">Pris: <b>' + K.n0(f.price[0]) + '–' + K.n0(f.price[1]) + ' €</b><button data-unf="#price" aria-label="Fjern">×</button></span>';
  if (!f.zeroPrice) chips += '<span class="chip">Uden ukendt pris<button data-unf="#zero" aria-label="Fjern">×</button></span>';
  if (chips) chips += '<button class="link" data-unf="#all" style="font-size:.85rem">Nulstil alle</button>';
  h += '<div class="chips">' + chips + '</div>';
  $('fbar').innerHTML = h;
};

A.setFilter = function (dim, vals, mode) {
  if (!vals || !vals.size) delete K.filters.dims[dim];
  else K.filters.dims[dim] = { mode: mode || 'in', vals: vals };
  A.refresh();
};
A.addFilter = function (dim, key) {
  const cur = K.filters.dims[dim];
  const vals = cur && cur.mode === 'in' ? new Set(cur.vals) : new Set();
  vals.add(key); A.setFilter(dim, vals, 'in');
};

/* popover med valg */
const pop = function () { return $('pop'); };
A.closePop = function () { pop().classList.remove('open'); pop().innerHTML = ''; A.popDim = null; };
A.openPop = function (anchor, dim) {
  A.popDim = dim;
  const p = pop(); const f = K.filters;
  let h = '';
  if (dim === '#vintage') {
    const ys = A.all.filter(function (i) { return !i.w.nv; }).map(function (i) { return i.w.vintage; });
    const lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
    h = '<div class="ph2"><b>Årgang</b><div style="display:flex;gap:8px;align-items:center"><input type="number" id="fv-a" value="' + (f.vintage ? f.vintage[0] : lo) + '" style="width:90px"> – <input type="number" id="fv-b" value="' + (f.vintage ? f.vintage[1] : hi) + '" style="width:90px"></div>' +
      '<label class="inl"><input type="checkbox" id="fv-nv"' + (f.nv ? ' checked' : '') + '> Medtag vine uden årgang (NV)</label></div>' +
      '<div class="pf"><button class="link" data-popclear="#vintage">Ryd</button><button class="btn sm pri" data-popapply="#vintage">Anvend</button></div>';
  } else if (dim === '#price') {
    h = '<div class="ph2"><b>Pris pr. flaske (€)</b><div style="display:flex;gap:8px;align-items:center"><input type="number" id="fp-a" value="' + (f.price ? f.price[0] : '') + '" placeholder="fra" style="width:90px"> – <input type="number" id="fp-b" value="' + (f.price ? f.price[1] : '') + '" placeholder="til" style="width:90px"></div>' +
      '<label class="inl"><input type="checkbox" id="fp-z"' + (f.zeroPrice ? ' checked' : '') + '> Medtag flasker uden registreret pris</label><span class="faint" style="font-size:.78rem">Intervallet gælder registreret indkøbspris i EUR.</span></div>' +
      '<div class="pf"><button class="link" data-popclear="#price">Ryd</button><button class="btn sm pri" data-popapply="#price">Anvend</button></div>';
  } else if (dim === '#more') {
    h = '<div class="ph2"><b>Flere filtre</b></div><div class="opts">' + FILTER_MORE.filter(function (d) { return K.dimsAvailable(A.db).indexOf(d) >= 0; }).map(function (d) {
      const n = f.dims[d] ? f.dims[d].vals.size : 0;
      return '<div class="opt" data-fpop="' + d + '">' + K.DIMS[d].label + (n ? '<span class="c">' + n + ' valgt</span>' : '') + '</div>';
    }).join('') + '</div>';
  } else {
    // tællinger ud fra alle andre filtre end denne dimension
    const g = K.cloneFilters(f); delete g.dims[dim];
    const base = K.apply(A.all, g);
    const r = K.rank(base, dim, 'bottles', { natural: !!K.DIMS[dim].order || K.DIMS[dim].numeric });
    const cur = f.dims[dim] || { mode: 'in', vals: new Set() };
    A.popSel = new Set(cur.vals); A.popMode = cur.mode;
    cur.vals.forEach(function (k) { if (!r.some(function (x) { return x.key === k; })) r.push({ key: k, name: K.dimName(dim, k), v: 0 }); });
    h = '<div class="ph2"><b>' + K.DIMS[dim].label + '</b><input type="search" id="pop-q" placeholder="Søg …" autocomplete="off">' +
      '<div>' + U.seg('popmode', [['in', 'Vis kun valgte'], ['out', 'Udelad valgte']], cur.mode) + '</div></div><div class="opts" id="pop-opts">' +
      r.map(function (x) { return '<label class="opt" data-q="' + K.esc(K.fold(x.name)) + '"><input type="checkbox" data-popv="' + K.esc(x.key) + '"' + (cur.vals.has(x.key) ? ' checked' : '') + '> ' + K.esc(x.name) + '<span class="c">' + K.n0(x.v) + '</span></label>'; }).join('') +
      '</div><div class="pf"><button class="link" data-popclear="' + dim + '">Ryd</button><button class="btn sm pri" data-popapply="' + dim + '">Anvend</button></div>';
  }
  p.innerHTML = h; p.classList.add('open');
  const rc = anchor.getBoundingClientRect();
  const w = p.offsetWidth;
  p.style.left = Math.max(12, Math.min(rc.left, window.innerWidth - w - 12)) + 'px';
  p.style.top = Math.min(rc.bottom + 6, window.innerHeight - p.offsetHeight - 12) + 'px';
  const q = $('pop-q'); if (q) { q.focus(); q.addEventListener('input', function () { const s = K.fold(q.value); p.querySelectorAll('[data-q]').forEach(function (o) { o.hidden = s && o.getAttribute('data-q').indexOf(s) < 0; }); }); }
};
A.applyPop = function (dim) {
  const f = K.filters;
  if (dim === '#vintage') {
    const a = +$('fv-a').value, b = +$('fv-b').value;
    const ys = A.all.filter(function (i) { return !i.w.nv; }).map(function (i) { return i.w.vintage; });
    f.vintage = a && b && (a > Math.min.apply(null, ys) || b < Math.max.apply(null, ys)) ? [Math.min(a, b), Math.max(a, b)] : null;
    f.nv = $('fv-nv').checked;
  } else if (dim === '#price') {
    const a = $('fp-a').value, b = $('fp-b').value;
    f.price = a !== '' || b !== '' ? [a === '' ? 0 : +a, b === '' ? 1e9 : +b] : null;
    f.zeroPrice = $('fp-z').checked;
  } else {
    const vals = new Set(); pop().querySelectorAll('[data-popv]').forEach(function (c) { if (c.checked) vals.add(c.getAttribute('data-popv')); });
    if (vals.size) f.dims[dim] = { mode: A.popMode || 'in', vals: vals }; else delete f.dims[dim];
  }
  A.closePop(); A.refresh();
};
A.clearFilter = function (dim) {
  const f = K.filters;
  if (dim === '#all') { K.filters = K.blankFilters(); }
  else if (dim === '#vintage') { f.vintage = null; f.nv = true; }
  else if (dim === '#nv') f.nv = true;
  else if (dim === '#price') { f.price = null; f.zeroPrice = true; }
  else if (dim === '#zero') f.zeroPrice = true;
  else delete f.dims[dim];
  A.closePop(); A.refresh();
};

/* ---------------------------------------------------------------- skuffe */

A.drawer = function (html) {
  $('drawer-body').innerHTML = html;
  $('drawer').classList.add('open'); $('scrim').classList.add('open');
  $('drawer').scrollTop = 0;
};
A.closeDrawer = function () { $('drawer').classList.remove('open'); $('scrim').classList.remove('open'); };
A.showItems = function (reg) {
  const r = U._reg[reg]; if (!r) return;
  const st = K.stats(r.items);
  A.drawer('<div class="eyebrow">Udsnit</div><h2 style="margin:4px 0 10px">' + K.esc(r.title || 'Vine') + '</h2>' +
    '<p class="muted" style="margin:0 0 14px">' + K.n0(st.bottles) + ' fl. · ' + K.n0(st.wines) + ' vine · ' + K.money(st.value) + (st.zero ? ' · ' + st.zero + ' fl. uden pris' : '') + '</p>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"><button class="btn sm" data-wlreg="' + reg + '">Lav vinkort af udsnittet</button><button class="btn sm" data-csvreg="' + reg + '">Hent som CSV</button></div>' +
    U.wineTable(r.items));
};
A.showWine = function (id) {
  const w = A.db.wines.get(id); if (!w) return;
  const its = A.all.filter(function (i) { return i.w.id === id; });
  const q = K.sum(its);
  const byLoc = K.rank(its, 'location');
  const buys = A.db.purchases.filter(function (p) { return p.w.id === id; });
  const drunk = A.db.consumed.filter(function (c) { return c.w.id === id; });
  const row = function (k, v) { return v ? '<dt>' + k + '</dt><dd>' + v + '</dd>' : ''; };
  const pl = function (dim, key, label) { return '<button class="link" data-dim="' + dim + '" data-key="' + K.esc(key) + '" data-prof="1">' + K.esc(label) + '</button>'; };
  A.drawer('<div class="eyebrow">' + K.esc(w.cls) + ' · ' + (w.nv ? 'NV' : w.vintage) + '</div><h2 style="margin:4px 0 4px">' + K.esc(w.name) + '</h2>' +
    '<p class="muted" style="margin:0 0 16px">' + K.n0(q) + ' fl. i beholdningen' + (w.pending ? ' · ' + w.pending + ' på bestilling' : '') + '</p>' +
    '<dl class="kv">' + row('Producent', pl('producer', w.producer, w.producerRaw) + (w.producer !== w.producerRaw ? ' <span class="tag">gruppe: ' + K.esc(w.producer) + '</span>' : '')) +
    row('Cuvée / designation', K.esc(w.designation)) + row('Mark', K.esc(w.vineyard)) +
    row('Land', pl('country', w.country, w.countryDa)) + row('Region', pl('region', w.regionKey, w.regionDa)) + row('Underområde', w.subregion ? pl('subregion', w.subregion, w.subregion) : '') + row('Appellation', w.appellation ? pl('appellation', w.appellation, w.appellation) : '') +
    row('Farve', K.esc(w.color)) + row('CT-type / kategori', K.esc(w.type + ' / ' + w.category)) +
    row('Drue', pl('grape', w.master, w.master) + (w.varietal !== w.master ? ' <span class="muted">(' + K.esc(w.varietal) + ')</span>' : '')) +
    row('Pris pr. flaske', w.price > 0 ? K.money(w.price, 2) + (A.db.bottleLevel ? '' : ' <span class="faint">(CT-pris for vinposten)</span>') : '<span class="faint">ikke registreret (nul)</span>') +
    row('Registreret værdi', w.price > 0 ? K.money(w.price * q, 2) : '') +
    row('Størrelser', K.esc(Array.from(new Set(its.map(function (i) { return K.sizeLabel(i.ml); }))).join(', '))) +
    (A.db.hasLoc ? row('Lokation', byLoc.map(function (l) { return K.esc(l.name) + ': ' + l.v + ' fl.'; }).join('<br>')) : '') +
    row('CT-aktivitet', w.cnotes || w.likeVotes ? K.n0(w.cnotes) + ' noter · ' + K.n0(w.likeVotes) + ' synes-om-stemmer <span class="faint">(registreret aktivitet, ikke kvalitet)</span>' : '') +
    row('iWine', '<span class="mono">' + K.esc(w.id) + '</span>') + '</dl>' +
    (buys.length ? '<h3 style="margin:18px 0 6px">Køb</h3>' + buys.map(function (b) { return '<div class="muted">' + K.date(b.date) + ' · ' + b.qty + ' fl.' + (b.price ? ' · ' + K.money(b.price, 2) : '') + (b.store ? ' · ' + K.esc(b.store) : '') + '</div>'; }).join('') : '') +
    (drunk.length ? '<h3 style="margin:18px 0 6px">Afgang</h3>' + drunk.map(function (b) { return '<div class="muted">' + K.date(b.date) + ' · ' + b.qty + ' fl. · ' + K.esc(b.reason) + '</div>'; }).join('') : '') +
    '<p style="margin-top:20px"><a href="https://www.cellartracker.com/wine.asp?iWine=' + encodeURIComponent(w.id) + '" target="_blank" rel="noopener">Åbn vinen i CellarTracker ↗</a></p>');
};

A.downloadCSV = function (items, name) {
  const rows = [['iWine', 'Producent', 'Producentgruppe', 'Vin', 'Årgang', 'Antal', 'Størrelse', 'Farve', 'Vintype', 'Drue', 'Land', 'Region', 'Appellation', 'Lokation', 'Pris pr. flaske (EUR)']];
  items.forEach(function (i) { rows.push([i.w.id, i.w.producerRaw, i.w.producer, i.w.name, i.w.nv ? 'NV' : i.w.vintage, i.qty, i.size, i.w.color, i.w.cls, i.w.master, i.w.countryDa, i.w.regionDa, i.w.appellation, i.loc, i.price ? String(i.price).replace('.', ',') : '']); });
  const blob = new Blob(['﻿' + K.toCSV(rows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'min-kaelder-udsnit.csv';
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
};

/* ---------------------------------------------------------------- import af filer */

A.stageFiles = async function (files) {
  const staged = { tables: {}, files: [], errors: [] };
  for (const f of files) {
    const buf = await f.arrayBuffer();
    const txt = K.decode(buf);
    const head = txt.slice(0, 300).toLowerCase();
    if (head.indexOf('<html') >= 0 || head.indexOf('<!doctype') >= 0) { staged.errors.push(f.name + ': filen er en webside, ikke en CSV-eksport (er du logget ind?).'); continue; }
    const o = K.csvObjects(txt);
    const t = K.detectTable(o.header);
    if (!t) { staged.errors.push(f.name + ': kunne ikke genkende filen som en CellarTracker-eksport (kolonnerne iWine/Wine mangler).'); continue; }
    staged.tables[t] = txt; staged.files.push({ name: f.name, table: t, rows: o.rows.length, cols: o.header.length });
  }
  const current = K.store.get('tables', null) || (A.src.mode === 'demo' ? window.EMBEDDED : null) || {};
  const merged = Object.assign({}, current, staged.tables);
  if (!merged.List) staged.errors.push('Beholdningen (My Cellar / List-eksporten) mangler. Den er grundlaget for dashboardet.');
  staged.merged = merged;
  if (merged.List) {
    const nd = K.build(merged);
    const ns = K.stats(nd.items), os = A.all.length ? K.stats(A.all) : null;
    staged.summary = ns; staged.prev = os; staged.warnings = nd.warnings.slice();
    const oldQ = new Map(), newQ = new Map();
    A.all.forEach(function (i) { oldQ.set(i.w.id, (oldQ.get(i.w.id) || 0) + i.qty); });
    nd.items.forEach(function (i) { newQ.set(i.w.id, (newQ.get(i.w.id) || 0) + i.qty); });
    let up = 0, down = 0, added = 0, gone = 0;
    newQ.forEach(function (v, k) { const o = oldQ.get(k) || 0; if (!o) added++; if (v > o) up += v - o; else down += o - v; });
    oldQ.forEach(function (v, k) { if (!newQ.has(k)) { gone++; down += v; } });
    staged.diff = { up: up, down: down, added: added, gone: gone };
    staged.hash = K.hash(JSON.stringify(K.snapshotRows(nd)));
    if (os && ns.bottles < os.bottles * 0.5) staged.warnings.push('Den nye fil har under halvdelen af flaskerne fra sidste import. Kontrollér at eksporten er komplet, før du godkender.');
    if (!ns.bottles) staged.warnings.push('Filen indeholder ingen flasker. Godkend kun, hvis kælderen faktisk er tom.');
    staged.db = nd;
  }
  A.staged = staged;
  A.go('data', null, true);
};
A.approveImport = function () {
  const s = A.staged; if (!s || !s.merged.List) return;
  const now = new Date().toISOString();
  if (!K.store.set('tables', s.merged)) { alert('Browseren kunne ikke gemme filen lokalt.'); return; }
  K.store.set('importedAt', now);
  const hist = K.store.get('history', []);
  const rows = K.snapshotRows(s.db);
  const last = hist[hist.length - 1];
  if (last && last.h === s.hash) last.seen = now; else hist.push({ d: now, seen: now, h: s.hash, r: rows });
  K.store.set('history', hist.slice(-400));
  const cat = Object.assign(K.store.get('catalog', {}), K.catalogFrom(s.db)); K.store.set('catalog', cat);
  const log = K.store.get('log', []);
  log.unshift({ time: now, ok: true, files: s.files, bottles: s.summary.bottles, diff: s.diff, observation: last && last.h === s.hash ? 'uændret' : 'ny observation', warnings: s.warnings });
  K.store.set('log', log.slice(0, 60));
  A.staged = null;
  A.load().then(function () { A.go('data', null, true); });
};

A.syncNow = async function () {
  const s = K.settings(); if (!s.syncUrl) return;
  A.syncing = true; A.render();
  try {
    const res = await fetch(s.syncUrl + '?action=sync&key=' + encodeURIComponent(s.syncKey));
    const p = await res.json();
    if (!p.ok) throw new Error(p.error);
    K.store.set('lastPayload', p); A.usePayload(p, true);
    A.syncMsg = p.sync && p.sync.ok ? (p.sync.skipped ? p.sync.message : 'Opdateret fra CellarTracker.') : 'Synkroniseringen fejlede: ' + (p.sync && p.sync.error || 'ukendt fejl') + ' Seneste gode data er bevaret.';
  } catch (e) { A.syncMsg = 'Kunne ikke kontakte synkroniseringen: ' + (e.message || e); }
  A.syncing = false; A.render();
};
A.post = async function (body) {
  const s = K.settings();
  const res = await fetch(s.syncUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ key: s.syncKey }, body)) });
  return res.json();
};

/* ---------------------------------------------------------------- hændelser */

document.addEventListener('click', function (e) {
  const t = e.target.closest('[data-nav],[data-fpop],[data-popapply],[data-popclear],[data-unf],[data-seg],[data-wine],[data-reg],[data-dim],[data-act],[data-wlreg],[data-csvreg],[data-weekend]');
  if (!t) { if (!e.target.closest('#pop')) A.closePop(); return; }
  const d = t.dataset;
  if (d.nav) { e.preventDefault(); A.closeDrawer(); A.go(d.nav); return; }
  if (d.fpop) { e.stopPropagation(); if (A.popDim === d.fpop && !t.closest('#pop')) { A.closePop(); return; } A.openPop(t.closest('#pop') ? document.querySelector('[data-fpop="#more"]') : t, d.fpop); return; }
  if (d.popapply) { A.applyPop(d.popapply); return; }
  if (d.popclear) { A.clearFilter(d.popclear); return; }
  if (d.unf) { A.clearFilter(d.unf); return; }
  if (d.seg) { if (d.seg === 'popmode') { A.popMode = d.val; t.parentNode.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === t); }); return; } if (d.seg === 'cur') { K.saveSettings({ currency: d.val }); A.refresh(); return; } A.ui[d.seg] = d.val; A.render(); return; }
  if (d.weekend) { const wk = K.settings().weekendLocations || []; K.filters.dims.location = { mode: 'in', vals: new Set(wk) }; K.filters.dims.color = { mode: 'in', vals: new Set(['Rød']) }; A.refresh(); return; }
  if (d.wlreg) { A.closeDrawer(); A.go('vinkort', { items: U._reg[+d.wlreg].items, title: U._reg[+d.wlreg].title }); return; }
  if (d.csvreg) { A.downloadCSV(U._reg[+d.csvreg].items); return; }
  if (d.wine) { A.showWine(d.wine); return; }
  if (d.act) { if (t.tagName === 'SELECT' || t.tagName === 'INPUT') return; if (P.act) P.act(d.act, t, e); return; }
  if (d.dim && d.prof) { A.closeDrawer(); A.profile(d.dim, d.key); return; }
  if (d.reg) { A.showItems(+d.reg); return; }
});
document.addEventListener('change', function (e) {
  const t = e.target;
  if (t.dataset.sel) { A.ui[t.dataset.sel] = t.value; A.render(); return; }
  if (t.dataset.act && P.act) P.act(t.dataset.act, t, e);
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { A.closePop(); A.closeDrawer(); } });
$('scrim').addEventListener('click', A.closeDrawer);
$('drawer-x').addEventListener('click', A.closeDrawer);
window.addEventListener('hashchange', function () { const p = location.hash.slice(1); if (p && p !== A.route.page && P[p]) A.go(p); });

(function start() {
  const p = location.hash.slice(1);
  if (p && P[p] && p !== 'profil') A.route = { page: p };
  A.load().then(function () { if (A.src.mode === 'none') A.route = { page: 'data' }; A.refresh(); });
})();
