/* Min kælder — siderne. Hver side returnerer HTML ud fra det aktuelle filterudsnit (A.view). */
'use strict';

const P = window.P = {};
const e = K.esc;
const ui = function (k, d) { return A.ui[k] === undefined ? d : A.ui[k]; };
const panel = function (title, body, opts) {
  opts = opts || {};
  return '<section class="panel' + (opts.cls ? ' ' + opts.cls : '') + '"' + (opts.id ? ' id="' + opts.id + '"' : '') + '><div class="ph"><h3>' + title + '</h3>' + (opts.tools || '') + (opts.def ? '<div class="def">' + opts.def + '</div>' : '') + '</div>' + body + '</section>';
};
const head = function (title, sub, tools, crumb) {
  return '<header class="page-head"><div>' + (crumb ? '<div class="crumb">' + crumb + '</div>' : '') + '<h1>' + title + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (tools ? '<div class="toolbar" style="margin:0">' + tools + '</div>' : '') + '</header>';
};
const filterNote = function () {
  const n = K.activeFilterCount();
  return n ? 'Viser ' + K.n0(K.sum(A.view)) + ' af ' + K.n0(K.sum(A.all)) + ' flasker efter ' + n + ' aktive filtre.' : 'Hele samlingen.';
};
const noData = function () {
  return '<div class="empty"><h2>Ingen flasker i udsnittet</h2><p>' + (A.all.length ? 'De aktive filtre udelukker alle flasker. <button class="link" data-unf="#all">Nulstil filtrene</button>.' : 'Der er endnu ikke indlæst data. Gå til <a href="#data" data-nav="data">Data & synk</a> for at hente din CellarTracker-eksport.') + '</p></div>';
};
const notice = function () {
  let h = '';
  if (A.notice) h += '<div class="note warn" style="margin-bottom:16px">' + e(A.notice) + '</div>';
  if (A.src.mode === 'demo' && A.route.page === 'overblik') h += '<div class="note" style="margin-bottom:16px">Forhåndsvisning med din eksport fra CellarTracker (' + K.date(A.src.imported) + '). Automatisk opdatering sættes op under <a href="#data" data-nav="data">Data & synk</a>.</div>';
  return h;
};
const pctOf = function (a, b) { return b ? a / b : 0; };

/* ================================================================ OVERBLIK */

P.overblik = function () {
  const it = A.view;
  if (!it.length) return head('Overblik') + notice() + noData();
  const s = K.stats(it), all = K.stats(A.all);
  const m = ui('ov_m', 'bottles');
  let h = head('Overblik', filterNote(), '<button class="btn" data-nav="vinkort">Vinkort</button><button class="btn" data-nav="mad">Mad og vin</button>') + notice();
  h += U.kpis([
    { v: K.n0(s.bottles), l: 'Flasker', s: K.n1(s.bottles / (s.wines || 1)) + ' pr. vin' },
    { v: K.n0(s.wines), l: 'Unikke vine (iWine)', s: K.n0(s.cuvees) + ' cuvéer på tværs af årgange', tip: 'iWine er én vin i én årgang i CellarTracker. Cuvéer samler samme vin på tværs af årgange.' },
  ]);
  h += '<div class="section" style="margin-top:14px">' + panel('Vintype', U.stack(it, 'cls'), { def: 'Mousserende og hedvin tælles kun her, ikke også som hvid eller rosé. Klik for at åbne en profil.' }) + '</div>';
  h += '<div class="grid g3 section" style="margin-top:18px">' +
    panel('Regioner', U.bars(it, 'region', { measure: m, top: 10 }), { tools: U.measureSeg('ov_m', m) }) +
    panel('Druer', U.bars(it, 'grape', { measure: m, top: 10 }), { def: 'Overordnet drue (MasterVarietal). Blends tælles som deres blendkategori.' }) +
    panel('Producenter', U.bars(it, 'producer', { measure: m, top: 10 })) + '</div>';
  h += '<div class="section">' + panel('Årgange', U.vintages(it), { def: 'Antal flasker pr. årgang. NV står for sig. Årgang er ikke købsår og siger intet om modenhed.' }) + '</div>';
  h += '<div class="section"><h2>Observationer</h2>' + P.facts(it) + '</div>';
  h += '<div class="section">' + P.miniHistory() + '</div>';
  return h;
};

P.facts = function (it) {
  const s = K.stats(it); const out = [];
  const c = K.rank(it, 'country')[0]; if (c) out.push({ b: K.pct(c.v / s.bottles), t: 'af flaskerne er fra ' + c.name + ' (' + K.n0(c.v) + ' fl.)', act: U.act('country', c.key, c.items) });
  const r = K.rank(it, 'region');
  if (r.length > 1) { const two = r[0].items.concat(r[1].items); out.push({ b: K.pct((r[0].v + r[1].v) / s.bottles), t: r[0].name + ' og ' + r[1].name + ' tilsammen (' + K.n0(r[0].v + r[1].v) + ' fl.)', reg: U.reg(two, r[0].name + ' + ' + r[1].name) }); }
  const g = K.rank(it, 'grape')[0]; if (g) out.push({ b: K.pct(g.v / s.bottles), t: g.name + ' – største drue (' + K.n0(g.v) + ' fl.)', act: U.act('grape', g.key, g.items) });
  const per = Array.from(K.group(it, function (i) { return i.w.id; }).values());
  const single = per.filter(function (x) { return K.sum(x) === 1; });
  out.push({ b: K.n0(single.length) + ' af ' + K.n0(per.length), t: 'vinposter har kun én flaske (' + K.pct(single.length / (per.length || 1)) + ')', reg: U.reg([].concat.apply([], single), 'Vine med kun én flaske') });
  const p = K.rank(it, 'producer')[0]; if (p) out.push({ b: p.name, t: 'største producent: ' + K.n0(p.v) + ' fl. (' + K.pct(p.v / s.bottles) + ') og ' + K.money(K.value(p.items)), act: U.act('producer', p.key, p.items) });
  const d = K.diversity(it, 'region'); out.push({ b: d.c50 + ' af ' + d.n + ' regioner', t: 'rummer tilsammen halvdelen af flaskerne', reg: U.reg([].concat.apply([], d.rank.slice(0, d.c50).map(function (x) { return x.items; })), 'Regioner der dækker 50 %') });
  const pv = K.rank(it, 'producer', 'value')[0]; if (pv && pv.key !== (p && p.key)) out.push({ b: K.money(pv.v), t: 'bundet hos ' + pv.name + ', den producent med højest registreret værdi', act: U.act('producer', pv.key, pv.items) });
  const top = it.filter(function (i) { return i.price > 0; }).sort(function (a, b) { return b.price - a.price; })[0];
  if (top) out.push({ b: K.money(top.price), t: 'dyreste flaske: ' + top.w.producerRaw + ' ' + top.w.label + ' ' + (top.w.nv ? 'NV' : top.w.vintage), wine: top.w.id });
  return '<div class="facts">' + out.map(function (f) {
    return '<button type="button" class="fact"' + (f.act || '') + (f.reg !== undefined ? ' data-reg="' + f.reg + '"' : '') + (f.wine ? ' data-wine="' + e(f.wine) + '"' : '') + '><b>' + e(f.b) + '</b><span>' + e(f.t) + '</span></button>';
  }).join('') + '</div>';
};

P.miniHistory = function () {
  const hist = A.history || [];
  if (hist.length < 2) {
    return panel('Udvikling over tid', '<div class="note">' + ('Der er endnu ingen historik. Dashboardet gemmer en dateret observation af beholdningen ved hver import' + (hist.length ? ' (første: ' + K.date(hist[0].d) + ')' : '') + ', så udviklingen bygges op fra nu. Med køb og forbrug fra CellarTracker kan historikken gå længere tilbage.') + '</div>');
  }
  const xs = hist.map(function (s) { return K.date(s.d); });
  const ys = hist.map(function (s) { return s.r.reduce(function (a, r) { return a + r[2]; }, 0); });
  return panel('Observeret beholdning', U.lines(xs, [{ name: 'Flasker', color: 'var(--accent)', ys: ys }], { h: 180 }), { def: 'Antal flasker ved hver import, hvor beholdningen havde ændret sig. Forskelle er nettoændringer, ikke køb eller forbrug.' });
};

/* ================================================================ MIN SAMLING */

P.samling = function () {
  let h = head('Min samling', filterNote(),
    '<button class="btn" data-act="wl-view">Vinkort</button>');
  h += '<div class="toolbar"><input type="search" id="samling-q" placeholder="Søg i ' + K.n0(U.wineRows(A.view).length) + ' vine …" value="' + e(ui('q', '')) + '" style="flex:1;min-width:180px;max-width:420px">' +
    U.seg('srt', [['producer', 'A–Å'], ['qty', 'Flest flasker'], ['vintage', 'Årgang']], ui('srt', 'producer')) + '</div>';
  h += '<div id="samling-tbl">' + P.samlingTable() + '</div>';
  return h;
};
P.samlingTable = function () {
  const q = K.fold(ui('q', '')).trim();
  const words = q ? q.split(/\s+/) : [];
  const it = words.length ? A.view.filter(function (i) { return words.every(function (w) { return i.w.search.indexOf(w) >= 0; }); }) : A.view;
  if (!it.length) return A.view.length ? '<div class="empty">Ingen vine matcher »' + e(ui('q', '')) + '«.</div>' : noData();
  return U.wineTable(it, { sort: ui('srt', 'producer'), limit: 500, open: words.length > 0 });
};

/* ================================================================ PROFIL (dynamisk for enhver dimension) */

P.profil = function () {
  const dim = A.route.dim, key = A.route.key; const D = K.DIMS[dim];
  if (!D) return P.overblik();
  const get = D.get;
  const it = A.view.filter(function (i) { return get(i) === key; });
  const whole = A.all.filter(function (i) { return get(i) === key; });
  const name = K.dimName(dim, key);
  const back = A.back.length ? '<button class="link" data-act="back">← Tilbage</button> · ' : '';
  let path = D.label;
  if (it[0] && ['region', 'subregion', 'appellation', 'vineyard'].indexOf(dim) >= 0) {
    const w = it[0].w;
    path = [w.countryDa, dim !== 'region' ? w.regionDa : '', dim === 'appellation' || dim === 'vineyard' ? w.subregion : ''].filter(Boolean).join(' › ');
  }
  let h = head(e(name), it.length < whole.length ? 'Viser ' + K.n0(K.sum(it)) + ' af ' + K.n0(K.sum(whole)) + ' flasker pga. aktive filtre.' : '',
    '<button class="btn" data-act="prof-filter">Filtrér hele dashboardet på ' + e(name) + '</button><button class="btn" data-act="prof-wl">Vinkort</button>', back + e(path));
  if (!it.length) return h + noData();
  const s = K.stats(it), tot = K.sum(A.view), totAll = K.sum(A.all);
  h += U.kpis([
    { v: K.n0(s.bottles), l: 'Flasker', s: K.pct(s.bottles / tot) + ' af udsnittet' + (tot !== totAll ? ' · ' + K.pct(s.bottles / totAll) + ' af alt' : '') },
    { v: K.n0(s.wines), l: 'Unikke vine', s: K.n0(s.cuvees) + ' cuvéer' },
    { v: K.n0(s.producers), l: 'Producenter' },
    { v: K.money(s.value), l: 'Registreret værdi', s: K.pct(K.value(it) / (K.value(A.view) || 1)) + ' af udsnittets værdi' },
    { v: s.avg ? K.money(s.avg) : '–', l: 'Gns. pris pr. flaske', s: 'median ' + (s.median ? K.money(s.median) : '–') + ' · pris kendt for ' + s.priced + ' fl.' },
    { v: s.vintages ? K.n0(s.vintages) : '–', l: 'Årgange', s: P.vintRange(it) }
  ]);
  const m = ui('pf_m', 'bottles');
  const geoDim = { country: 'region', region: 'appellation', subregion: 'appellation', appellation: 'producer', vineyard: 'producer' }[dim];
  h += '<div class="grid g2 section" style="margin-top:22px">';
  if (dim !== 'color') h += panel('Farve', U.stack(it, 'color'));
  if (dim !== 'cls') h += panel('Vintype', U.stack(it, 'cls'));
  h += '</div><div class="grid g3 section" style="margin-top:18px">';
  if (geoDim) h += panel(K.DIMS[geoDim].label + 'r i ' + e(name), U.bars(it, geoDim, { measure: m, top: 12 }), { tools: U.measureSeg('pf_m', m) });
  if (['region', 'country', 'subregion', 'appellation', 'vineyard'].indexOf(dim) < 0) h += panel('Regioner', U.bars(it, 'region', { measure: m, top: 12 }), { tools: geoDim ? '' : U.measureSeg('pf_m', m) });
  if (dim !== 'producer' && dim !== 'producerRaw' && geoDim !== 'producer') h += panel('Producenter', U.bars(it, 'producer', { measure: m, top: 12 }));
  if (dim !== 'grape') h += panel('Druer', U.bars(it, 'grape', { measure: m, top: 12 }));
  if (dim === 'producer' && new Set(it.map(function (i) { return i.w.producerRaw; })).size > 1) h += panel('Oprindelige producentnavne', U.bars(it, 'producerRaw', { measure: m }), { def: 'Producentgruppen samler flere navne fra CellarTracker. Vinkortet bruger altid det oprindelige navn.' });
  if (A.db.hasLoc) h += panel('Lokationer', U.bars(it, 'location', { measure: m }));
  if (A.db.hasStore) h += panel('Forhandlere', U.bars(it, 'store', { measure: m }));
  h += '</div>';
  // drue × underområde
  const cross = dim === 'grape' ? ['region', 'color'] : ['country', 'region', 'subregion'].indexOf(dim) >= 0 ? [dim === 'country' ? 'region' : 'appellation', 'grape'] : dim === 'producer' ? ['appellation', 'grape'] : null;
  if (cross && K.group(it, cross[0]).size > 1 && K.group(it, cross[1]).size > 1) {
    const hm = ui('pf_hm', 'abs');
    h += '<div class="section">' + panel(K.DIMS[cross[1]].label + ' × ' + K.DIMS[cross[0]].label.toLowerCase(), U.heat(it, cross[0], cross[1], { mode: hm, topR: 14, topC: 9 }), { tools: U.seg('pf_hm', [['abs', 'Antal'], ['row', 'Række-%'], ['col', 'Kolonne-%']], hm) }) + '</div>';
  }
  h += '<div class="grid g2 section">' + panel('Årgange', U.vintages(it)) + panel('Priser', P.priceBlock(it)) + '</div>';
  if (dim === 'producer' || dim === 'producerRaw') h += '<div class="section">' + panel('Cuvéer og vertikaler', P.verticalMatrix(it, true), { def: 'Én række pr. vin (samme navn på tværs af årgange), én kolonne pr. årgang. Tomme felter betyder kun, at årgangen ikke er i din kælder.' }) + '</div>';
  h += P.historyFor(it, dim, key);
  h += '<div class="section"><h2>Vinene</h2>' + U.wineTable(it) + '</div>';
  return h;
};
P.vintRange = function (it) {
  const ys = it.filter(function (i) { return !i.w.nv; }).map(function (i) { return i.w.vintage; });
  const nv = K.sum(it.filter(function (i) { return i.w.nv; }));
  return (ys.length ? Math.min.apply(null, ys) + '–' + Math.max.apply(null, ys) : '') + (nv ? (ys.length ? ' · ' : '') + nv + ' NV' : '');
};
P.priceBlock = function (it) {
  const s = K.stats(it);
  const priced = it.filter(function (i) { return i.price > 0; });
  const max = priced.slice().sort(function (a, b) { return b.price - a.price; })[0];
  const bands = K.rank(it, 'priceBand', 'bottles', { natural: true });
  return '<dl class="kv" style="margin-bottom:14px"><dt>Gennemsnit (vægtet)</dt><dd class="num">' + (s.avg ? K.money(s.avg, 2) : '–') + '</dd><dt>Median</dt><dd class="num">' + (s.median ? K.money(s.median, 2) : '–') + '</dd>' +
    (max ? '<dt>Højeste pris</dt><dd><button class="link" data-wine="' + e(max.w.id) + '">' + e(max.w.producerRaw + ' ' + max.w.label + ' ' + (max.w.nv ? 'NV' : max.w.vintage)) + '</button> · <span class="num">' + K.money(max.price, 2) + '</span></dd>' : '') +
    '<dt>Prisdækning</dt><dd>' + s.priced + ' fl. med pris · ' + s.zero + ' fl. uden (tæller ikke i gennemsnit)</dd></dl>' +
    U.columns(bands.map(function (b) { return { label: b.name.replace(' €', ''), v: b.v, act: U.act('priceBand', b.key, b.items, 'Pris: ' + b.name), tip: b.name + ': ' + b.v + ' fl.', color: b.key === 'Ingen pris' ? 'var(--ink-3)' : 'var(--accent)' }; }), { h: 160, label: 'Prisfordeling' });
};

/* vertikaler: cuvée × årgang */
P.verticalMatrix = function (it, all) {
  const g = K.group(it, 'cuvee');
  let rows = Array.from(g).map(function (x) {
    const ys = new Map(); x[1].forEach(function (i) { const k = i.w.nv ? 'NV' : i.w.vintage; ys.set(k, (ys.get(k) || []).concat([i])); });
    const num = Array.from(ys.keys()).filter(function (k) { return k !== 'NV'; });
    return { key: x[0], items: x[1], ys: ys, n: num.length, b: K.sum(x[1]), w: x[1][0].w };
  });
  if (!all) rows = rows.filter(function (r) { return r.n >= 2; });
  if (!rows.length) return '<div class="empty">Ingen vine findes i mindst to forskellige årgange i udsnittet.</div>';
  rows.sort(function (a, b) { return b.n - a.n || b.b - a.b || a.w.name.localeCompare(b.w.name, 'da'); });
  const yrs = Array.from(new Set([].concat.apply([], rows.map(function (r) { return Array.from(r.ys.keys()); })))).sort(function (a, b) { return a === 'NV' ? -1 : b === 'NV' ? 1 : a - b; });
  if (U.narrow()) {
    return '<div class="hml">' + rows.slice(0, 80).map(function (r) {
      const ys = Array.from(r.ys.keys()).sort(function (a, b) { return a === 'NV' ? -1 : b === 'NV' ? 1 : a - b; });
      return '<div class="hml-r"><div class="hml-h"><span>' + (all ? '' : '<span class="muted">' + e(r.w.producerRaw) + '</span> ') + e(r.w.label) + '</span><span class="faint num">' + r.n + ' årg. · ' + r.b + ' fl.</span></div><div class="hml-c">' +
        ys.map(function (y) { const c = r.ys.get(y); const q = K.sum(c); return '<button type="button" class="hml-chip" data-reg="' + U.reg(c, r.w.name + ' ' + y) + '" style="background:color-mix(in srgb, var(--accent) ' + Math.min(70, 12 + q * 12) + '%, transparent);' + (q > 4 ? 'color:var(--paper)' : '') + '">' + y + ' <b>' + q + ' fl.</b></button>'; }).join('') + '</div></div>';
    }).join('') + '</div>';
  }
  let h = '<div class="tw hm"><table><thead><tr><th class="rowh">Vin</th>' + yrs.map(function (y) { return '<th class="r">' + (y === 'NV' ? 'NV' : "'" + String(y).slice(2)) + '</th>'; }).join('') + '<th class="r">Årg.</th><th class="r">Fl.</th></tr></thead><tbody>';
  rows.slice(0, 80).forEach(function (r) {
    h += '<tr><td class="rowh">' + (all ? '' : '<span class="muted">' + e(r.w.producerRaw) + '</span> ') + e(r.w.label) + '</td>' + yrs.map(function (y) {
      const c = r.ys.get(y); if (!c) return '<td class="c z">·</td>';
      const q = K.sum(c);
      return '<td class="c" data-reg="' + U.reg(c, r.w.name + ' ' + y) + '" style="background:color-mix(in srgb, var(--accent) ' + Math.min(70, 18 + q * 12) + '%, transparent);' + (q > 3 ? 'color:var(--paper)' : '') + '"' + U.tipAttr(r.w.name + ' ' + y + ': ' + q + ' fl.') + '>' + q + '</td>';
    }).join('') + '<td class="c r">' + r.n + '</td><td class="c r">' + r.b + '</td></tr>';
  });
  return h + '</tbody></table></div>' + (rows.length > 80 ? '<div class="faint">Viser 80 af ' + rows.length + '.</div>' : '');
};

/* ================================================================ GEOGRAFI */

P.geografi = function () {
  const it = A.view;
  let h = head('Geografi', filterNote() + ' Klik et land eller en region for en fuld profil.');
  if (!it.length) return h + noData();
  const m = ui('geo_m', 'bottles');
  h += '<div class="grid g2">' + panel('Lande', U.bars(it, 'country', { measure: m, top: 12 }), { tools: U.measureSeg('geo_m', m) }) +
    panel('Regioner', U.bars(it, 'region', { measure: m, top: 14 })) + '</div>';
  h += '<div class="section" style="margin-top:14px">' + panel('Appellationer', U.bars(it.filter(function (i) { return i.w.appellation; }), 'appellation', { measure: m, top: 14 }), { def: K.n0(K.sum(it.filter(function (i) { return !i.w.appellation; }))) + ' fl. har ingen kendt appellation og er udeladt her.' }) + '</div>';
  return h;
};
P.geoTree = function (it) {
  const tot = K.sum(it);
  const line = function (name, items, depth, act) {
    const st = K.stats(items);
    return '<div style="display:grid;grid-template-columns:minmax(0,1fr) 70px 60px 90px;gap:10px;padding:4px 0 4px ' + (depth * 18) + 'px;border-bottom:1px solid var(--line);align-items:baseline">' +
      '<span>' + (act ? '<button class="link"' + act + '>' + e(name) + '</button>' : '<span class="muted">' + e(name) + '</span>') + '</span><span class="num r" style="text-align:right">' + K.n0(st.bottles) + ' fl.</span><span class="num faint" style="text-align:right">' + K.pct(st.bottles / tot).replace(' ', '') + '</span><span class="num faint" style="text-align:right">' + K.money(st.value) + '</span></div>';
  };
  return K.rank(it, 'country').map(function (c) {
    const regs = K.rank(c.items, 'region');
    return '<details' + (c.v / tot > 0.3 ? ' open' : '') + '><summary style="cursor:pointer;list-style:none">' + line(c.name, c.items, 0, U.act('country', c.key, c.items)) + '</summary>' +
      regs.map(function (r) {
        const apps = K.rank(r.items.filter(function (i) { return i.w.appellation; }), 'appellation');
        const unk = r.items.filter(function (i) { return !i.w.appellation; });
        return line(r.name, r.items, 1, U.act('region', r.key, r.items)) + apps.map(function (a) { return line(a.name, a.items, 2, U.act('appellation', a.key, a.items)); }).join('') + (unk.length && apps.length ? line('appellation ikke angivet', unk, 2) : '');
      }).join('') + '</details>';
  }).join('');
};

/* Sammenligning af 2–4 enheder side om side */
P.compare = function (ns, dims) {
  const it = A.view;
  const dim = ui(ns + '_cd', dims[0]);
  const r = K.rank(it, dim);
  let sel = (A.ui[ns + '_cs'] || '').split('\u0001').filter(function (k) { return r.some(function (x) { return x.key === k; }); });
  if (!sel.length) sel = r.slice(0, 2).map(function (x) { return x.key; });
  const opts = r.slice(0, 40).map(function (x) {
    return '<label class="inl" style="margin-right:10px"><input type="checkbox" data-act="cmp" data-ns="' + ns + '" value="' + e(x.key) + '"' + (sel.indexOf(x.key) >= 0 ? ' checked' : '') + '> ' + e(x.name) + '</label>';
  }).join('');
  const cols = sel.slice(0, 4).map(function (k) { return r.find(function (x) { return x.key === k; }); }).filter(Boolean);
  const cm = ui(ns + '_cm', 'share');
  let body = '<div class="toolbar"><label class="inl">Sammenlign ' + U.select(ns + '_cd', dims.map(function (d) { return [d, K.DIMS[d].label.toLowerCase()]; }), dim) + '</label>' + U.seg(ns + '_cm', [['share', 'Andel af enheden'], ['bottles', 'Flasker'], ['value', 'Værdi']], cm) + '</div>' +
    '<details style="margin-bottom:14px"><summary class="link" style="cursor:pointer">Vælg op til 4 (' + cols.length + ' valgt)</summary><div style="margin-top:8px;line-height:2">' + opts + '</div></details>';
  if (!cols.length) return panel('Sammenlign', body + '<div class="empty">Vælg mindst én.</div>');
  const block = function (title, fn) { return '<tr><th colspan="' + (cols.length + 1) + '" style="padding-top:16px">' + title + '</th></tr>' + fn(); };
  const crossRows = function (sub) {
    const keys = K.rank([].concat.apply([], cols.map(function (c) { return c.items; })), sub).slice(0, 8);
    return keys.map(function (k) {
      return '<tr><td>' + e(k.name) + '</td>' + cols.map(function (c) {
        const its = c.items.filter(function (i) { return K.DIMS[sub].get(i) === k.key; });
        const v = cm === 'share' ? K.pct(K.sum(its) / (K.sum(c.items) || 1)) : cm === 'value' ? K.money(K.value(its)) : K.n0(K.sum(its));
        return '<td class="r num"' + (its.length ? ' data-reg="' + U.reg(its, c.name + ' · ' + k.name) + '" style="cursor:pointer"' : '') + '>' + (its.length ? v : '<span class="faint">–</span>') + '</td>';
      }).join('') + '</tr>';
    }).join('');
  };
  let t = '<div class="tw"><table><thead><tr><th></th>' + cols.map(function (c) { return '<th class="r"><button class="link"' + U.act(dim, c.key, c.items) + '>' + e(c.name) + '</button></th>'; }).join('') + '</tr></thead><tbody>';
  const stats = cols.map(function (c) { return K.stats(c.items); });
  [['Flasker', function (s) { return K.n0(s.bottles); }], ['Andel af udsnittet', function (s) { return K.pct(s.bottles / (K.sum(it) || 1)); }], ['Unikke vine', function (s) { return K.n0(s.wines); }], ['Producenter', function (s) { return K.n0(s.producers); }], ['Registreret værdi', function (s) { return K.money(s.value); }], ['Gns. pris', function (s) { return s.avg ? K.money(s.avg) : '–'; }], ['Median pris', function (s) { return s.median ? K.money(s.median) : '–'; }]]
    .forEach(function (row) { t += '<tr><td>' + row[0] + '</td>' + stats.map(function (s) { return '<td class="r num">' + row[1](s) + '</td>'; }).join('') + '</tr>'; });
  t += '<tr><td>Medianårgang</td>' + cols.map(function (c) { return '<td class="r num">' + (P.medVintage(c.items) || '–') + '</td>'; }).join('') + '</tr>';
  t += block('Farve', function () { return crossRows('color'); });
  t += block('Druer', function () { return crossRows('grape'); });
  if (dim !== 'appellation') t += block('Producenter', function () { return crossRows('producer'); });
  t += '</tbody></table></div><div class="faint" style="font-size:.78rem;margin-top:6px">' + (cm === 'share' ? 'Procenter er andel af hver kolonnes egne flasker.' : '') + ' Samme filterkontekst for alle kolonner.</div>';
  return panel('Sammenlign side om side', body + t);
};
P.medVintage = function (items) {
  const ys = []; items.forEach(function (i) { if (!i.w.nv) for (let k = 0; k < i.qty; k++) ys.push(i.w.vintage); });
  ys.sort(); return ys.length ? ys[Math.floor((ys.length - 1) / 2)] : null;
};

/* ================================================================ DRUER */

P.druer = function () {
  const it = A.view;
  let h = head('Druer & vintyper', filterNote());
  if (!it.length) return h + noData();
  const m = ui('dr_m', 'bottles');
  h += '<div class="grid g2">' + panel('Druer', U.bars(it, 'grape', { measure: m, top: 15 }), { tools: U.measureSeg('dr_m', m), def: 'Blends tælles som deres registrerede blendkategori. De enkelte druers andele i en blend er ikke registreret og opfindes ikke.' }) +
    '<div class="grid" style="gap:14px">' + panel('Farve', U.stack(it, 'color')) + panel('Vintype', U.stack(it, 'cls')) + panel('Flaskestørrelse', U.bars(it, 'size', { measure: 'bottles' }), { def: 'Volumen i alt ' + K.n1(K.MEASURES.liters.fn(it)) + ' liter = ' + K.n1(K.MEASURES.liters.fn(it) / 0.75) + ' standardflasker; fysisk ' + K.n0(K.sum(it)) + ' flasker.' }) + '</div></div>';
  h += '<div class="section">' + P.grapeGeo(it) + '</div>';
  h += '<div class="section">' + panel('Vintype × land', U.heat(it, 'country', 'cls', { mode: ui('dr_hm2', 'abs'), topR: 10, topC: 9 }), { tools: U.seg('dr_hm2', [['abs', 'Antal'], ['row', 'Række-%'], ['col', 'Kolonne-%']], ui('dr_hm2', 'abs')) }) + '</div>';
  return h;
};
/* Drue og geografi som søjler i stedet for en bred krydstabel: vælg en drue og se regionerne, eller omvendt. */
P.grapeGeo = function (it) {
  const mode = ui('gg_m', 'g2r');
  const from = mode === 'g2r' ? 'grape' : 'region', to = mode === 'g2r' ? 'region' : 'grape';
  const opts = K.rank(it, from);
  let sel = ui('gg_' + from, '');
  if (!opts.some(function (o) { return o.key === sel; })) sel = opts.length ? opts[0].key : '';
  const sub = it.filter(function (i) { return K.DIMS[from].get(i) === sel; });
  const meas = ui('gg_v', 'bottles');
  const tot = K.sum(sub);
  const body = '<div class="toolbar">' + U.seg('gg_m', [['g2r', 'Drue → regioner'], ['r2g', 'Region → druer']], mode) +
    U.select('gg_' + from, opts.map(function (o) { return [o.key, o.name + ' (' + o.v + ')']; }), sel) + U.seg('gg_v', [['bottles', 'Flasker'], ['share', '%']], meas) + '</div>' +
    '<p class="muted" style="margin:0 0 10px;font-size:15px">' + (mode === 'g2r' ? 'Hvor kommer dine ' + K.n0(tot) + ' flasker ' + e(K.dimName(from, sel)) + ' fra?' : 'Hvilke druer udgør dine ' + K.n0(tot) + ' flasker fra ' + e(K.dimName(from, sel)) + '?') + '</p>' +
    U.bars(sub, to, { measure: meas, top: 12 });
  return panel('Drue og geografi', body, { def: meas === 'share' ? 'Procent af den valgte ' + (mode === 'g2r' ? 'drues' : 'regions') + ' flasker.' : '' });
};

/* ================================================================ PRODUCENTER */

P.producenter = function () {
  const it = A.view;
  let h = head('Producenter', filterNote() + ' Hvem du har flest flasker fra, og hvem du har brugt flest penge på.');
  if (!it.length) return h + noData();
  const g = K.group(it, 'producer');
  const tot = K.sum(it);
  let rows = Array.from(g).map(function (x) {
    const s = K.stats(x[1]);
    return { key: x[0], items: x[1], s: s, regs: Array.from(new Set(x[1].map(function (i) { return i.w.regionDa; }))) };
  });
  const sort = ui('pr_s', 'bottles');
  const val = { bottles: function (r) { return r.s.bottles; }, wines: function (r) { return r.s.wines; }, vintages: function (r) { return r.s.vintages; }, value: function (r) { return r.s.value; }, avg: function (r) { return r.s.avg; } };
  rows.sort(sort === 'name' ? function (a, b) { return a.key.localeCompare(b.key, 'da'); } : function (a, b) { return val[sort](b) - val[sort](a) || b.s.bottles - a.s.bottles; });
  const q = K.fold(ui('pr_q', ''));
  if (q) rows = rows.filter(function (r) { return K.fold(r.key).indexOf(q) >= 0; });
  const n = +ui('pr_n', 25);
  const th = function (k, l, cls) { return '<th class="s' + (cls ? ' ' + cls : '') + (sort === k ? ' on' : '') + '" data-seg="pr_s" data-val="' + k + '">' + l + (sort === k ? ' ↓' : '') + '</th>'; };
  let t = '<div class="tw"><table class="pt"><thead><tr><th class="xm">#</th>' + th('name', 'Producent') + th('bottles', 'Fl.', 'r') + '<th class="r xm">Andel</th>' + th('wines', 'Vine', 'r xm') + th('vintages', 'Årgange', 'r xm') + th('value', 'Brugt', 'r') + th('avg', 'Gns. pris', 'r xm') + '<th class="xm">Regioner</th></tr></thead><tbody>';
  rows.slice(0, n || rows.length).forEach(function (r, i) {
    t += '<tr class="click"' + U.act('producer', r.key, r.items) + '><td class="faint num xm">' + (i + 1) + '</td><td><b>' + e(r.key) + '</b><div class="sm">' + e(r.regs.join(', ')) + '</div></td><td class="r num">' + r.s.bottles + '</td><td class="r num faint xm">' + K.pct(r.s.bottles / tot) + '</td><td class="r num xm">' + r.s.wines + '</td><td class="r num xm">' + r.s.vintages + '</td><td class="r num">' + K.money(r.s.value) + '</td><td class="r num xm">' + (r.s.avg ? K.money(r.s.avg) : '–') + '</td><td class="muted xm">' + e(r.regs.join(', ')) + '</td></tr>';
  });
  t += '</tbody></table></div>';
  h += '<div class="toolbar"><input type="search" id="pr-q" placeholder="Søg producent …" value="' + e(ui('pr_q', '')) + '" style="min-width:180px">' +
    '<label class="inl">Vis ' + U.select('pr_n', [['15', 'top 15'], ['25', 'top 25'], ['50', 'top 50'], ['0', 'alle']], String(n)) + '</label></div>' + t;
  h += '<div class="section">' + panel('Flest flasker', U.bars(it, 'producer', { measure: 'bottles', top: 12 })) + '</div>';
  return h;
};

/* ================================================================ TRENDS */

P.trends = function () {
  const db = A.db;
  let h = head('Trends & historik', 'Tre forskellige perspektiver: faktiske køb (købsdato), faktisk forbrug (drikkedato) og observeret beholdning (importtidspunkt). Årgang er noget fjerde og bruges ikke her.');
  if (!A.all.length && !(A.history || []).length) return h + noData();
  const ef = K.eventFilter(K.filters);
  if (db.hasPurchases) h += P.purchaseTrends(db.purchases.filter(ef), ef);
  else h += '<div class="section">' + panel('Købstrends', '<div class="note">Der er ingen købshistorik i de indlæste data. Grafen over regionale købspræferencer kræver CellarTrackers <b>Purchase</b>-tabel med købsdatoer. ' + (A.src.mode === 'sync' ? 'Synkroniseringen forsøger at hente den hver nat; se status under <a href="#data" data-nav="data">Data & synk</a>.' : 'Upload den under <a href="#data" data-nav="data">Data & synk</a>, eller sæt den automatiske synkronisering op.') + '</div>') + '</div>';
  if (db.hasConsumed) h += P.consumption(db.consumed.filter(ef), db.hasPurchases ? db.purchases.filter(ef) : null);
  h += P.observed();
  return h;
};
const yearOf = function (d) { return d.getFullYear(); };
P.years = function (events) {
  const ys = events.map(function (p) { return yearOf(p.date); });
  if (!ys.length) return [];
  const out = []; for (let y = Math.min.apply(null, ys); y <= Math.max.apply(null, ys); y++) out.push(y);
  return out;
};
P.purchaseTrends = function (pur) {
  if (!pur.length) return '<div class="section">' + panel('Købstrends', '<div class="empty">Ingen køb matcher filtrene.</div>') + '</div>';
  const dim = ui('tr_d', 'region'), m = ui('tr_m', 'share');
  const years = P.years(pur);
  const nowY = new Date().getFullYear();
  const byY = new Map(years.map(function (y) { return [y, []]; }));
  pur.forEach(function (p) { byY.get(yearOf(p.date)).push(p); });
  const get = K.DIMS[dim].get;
  const ev = function (p) { return { w: p.w, qty: p.qty, price: p.price || p.w.price || 0, ml: 750, loc: '', store: p.store }; };
  const tot = new Map(); pur.forEach(function (p) { const k = get(ev(p)); tot.set(k, (tot.get(k) || 0) + p.qty); });
  const keys = Array.from(tot).sort(function (a, b) { return b[1] - a[1]; }).map(function (x) { return x[0]; });
  const n = +ui('tr_n', 5);
  const shown = keys.slice(0, n);
  const yv = function (list, k) {
    const sel = list.filter(function (p) { return get(ev(p)) === k; });
    const b = sel.reduce(function (a, p) { return a + p.qty; }, 0), all = list.reduce(function (a, p) { return a + p.qty; }, 0);
    const v = sel.reduce(function (a, p) { return a + p.qty * (p.price || 0); }, 0);
    return { b: b, all: all, v: v, sel: sel };
  };
  const series = shown.map(function (k, i) {
    return { name: K.dimName(dim, k), color: U.series(i), ys: years.map(function (y) {
      const r = yv(byY.get(y), k); if (!r.all) return null;
      return m === 'share' ? r.b / r.all : m === 'value' ? r.v : r.b;
    }), tips: years.map(function (y) { const r = yv(byY.get(y), k); return r.all ? K.n0(r.b) + ' af ' + K.n0(r.all) + ' købte fl. (' + K.pct(r.b / r.all) + ') · ' + K.money(r.v) : ''; }) };
  });
  const xs = years.map(function (y) { return y === nowY ? y + '*' : String(y); });
  let h = '<div class="section">' + panel('Købspræferencer: ' + K.DIMS[dim].label.toLowerCase(),
    U.lines(xs, series, { pct: m === 'share', fmt: m === 'value' ? function (v) { return K.n0(v); } : null }) +
    '<div class="faint" style="font-size:.78rem;margin-top:6px">' + (m === 'share' ? 'Andel = købte flasker i kategorien / alle købte flasker samme år i den valgte filterkontekst. Skjulte kategorier ændrer ikke nævneren.' : m === 'value' ? 'Købsværdi i EUR.' : 'Købte flasker.') + ' År uden køb vises som hul. * = år til dato.</div>',
    { tools: U.select('tr_d', [['region', 'Region'], ['country', 'Land'], ['grape', 'Drue'], ['color', 'Farve'], ['cls', 'Vintype'], ['producer', 'Producent'], ['appellation', 'Appellation']].concat(A.db.hasStore ? [['store', 'Forhandler']] : []), dim) + U.select('tr_n', [['3', 'top 3'], ['5', 'top 5'], ['8', 'top 8']], String(n)) + U.seg('tr_m', [['share', 'Andel'], ['bottles', 'Flasker'], ['value', 'Værdi']], m) }) + '</div>';
  // 100% stak
  const groups = years.map(function (y) {
    const list = byY.get(y);
    const parts = shown.map(function (k) { const r = yv(list, k); return { key: k, name: K.dimName(dim, k), v: r.b }; });
    const rest = list.filter(function (p) { return shown.indexOf(get(ev(p))) < 0; }).reduce(function (a, p) { return a + p.qty; }, 0);
    if (rest) parts.push({ key: '…', name: 'Øvrige', v: rest });
    return { x: String(y), parts: parts };
  });
  h += '<div class="grid g2 section">' + panel('Fordeling af køb pr. år', U.stackCols(groups, shown.concat(['…']), { color: function (k, i) { return k === '…' ? 'var(--line-2)' : U.series(i); } }), { def: 'Stablet 100 %: hvert år summerer til alle købte flasker.' });
  // forskydninger
  const yA = +ui('tr_ya', years.length > 1 ? years[years.length - 2] : years[0]), yB = +ui('tr_yb', years[years.length - 1]);
  const la = byY.get(yA) || [], lb = byY.get(yB) || [];
  const shifts = keys.map(function (k) { const a = yv(la, k), b = yv(lb, k); return { k: k, a: a.all ? a.b / a.all : 0, b: b.all ? b.b / b.all : 0, ab: a.b, bb: b.b }; })
    .map(function (s) { s.d = s.b - s.a; return s; }).filter(function (s) { return s.ab || s.bb; }).sort(function (x, y) { return y.d - x.d; });
  const mx = Math.max.apply(null, shifts.map(function (s) { return Math.abs(s.d); }).concat([0.01]));
  const sh = shifts.slice(0, 6).concat(shifts.length > 12 ? shifts.slice(-6) : shifts.slice(6)).map(function (s) {
    const w = 50 * Math.abs(s.d) / mx;
    return '<div style="display:grid;grid-template-columns:minmax(90px,34%) 1fr 70px;gap:10px;align-items:center;font-size:.86rem;padding:2px 0"' + U.tipAttr(K.dimName(dim, s.k) + ': ' + K.pct(s.a) + ' (' + s.ab + ' fl.) → ' + K.pct(s.b) + ' (' + s.bb + ' fl.)') + '><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + e(K.dimName(dim, s.k)) + '</span>' +
      '<span style="position:relative;height:12px;background:linear-gradient(90deg,transparent calc(50% - .5px),var(--line-2) calc(50% - .5px),var(--line-2) calc(50% + .5px),transparent calc(50% + .5px))"><span style="position:absolute;top:0;bottom:0;' + (s.d >= 0 ? 'left:50%' : 'right:50%') + ';width:' + w + '%;background:' + (s.d >= 0 ? 'var(--accent)' : 'var(--ink-3)') + ';border-radius:2px"></span></span>' +
      '<span class="num" style="text-align:right">' + (s.d >= 0 ? '+' : '−') + K.n1(Math.abs(s.d) * 100) + ' pp</span></div>';
  }).join('');
  h += panel('Største forskydninger', '<div class="toolbar">' + U.select('tr_ya', years.map(function (y) { return [String(y), String(y)]; }), String(yA)) + ' → ' + U.select('tr_yb', years.map(function (y) { return [String(y), String(y)]; }), String(yB)) + '</div>' + sh, { def: 'Ændring i andel af årets køb, målt i procentpoint (fx 10 % → 15 % = +5 pp).' + (yB === nowY ? ' ' + yB + ' er ikke afsluttet.' : '') }) + '</div>';
  // pris og forhandlere
  const pr = years.map(function (y) { const l = byY.get(y).filter(function (p) { return p.price > 0; }); const b = l.reduce(function (a, p) { return a + p.qty; }, 0); return b ? l.reduce(function (a, p) { return a + p.qty * p.price; }, 0) / b : null; });
  const vals = years.map(function (y) { return byY.get(y).reduce(function (a, p) { return a + p.qty * (p.price || 0); }, 0); });
  const cnt = years.map(function (y) { return byY.get(y).reduce(function (a, p) { return a + p.qty; }, 0); });
  h += '<div class="grid g2 section">' + panel('Købte flasker og værdi pr. år', U.columns(years.map(function (y, i) { return { label: "'" + String(y).slice(2), v: cnt[i], tip: y + ': ' + cnt[i] + ' fl. · ' + K.money(vals[i]) }; }), { h: 180 })) +
    panel('Gennemsnitspris pr. købt flaske', U.lines(xs, [{ name: 'Gns. pris', color: 'var(--accent)', ys: pr }], { h: 180, fmt: function (v) { return K.n0(v) + ' €'; } }), { def: 'Vægtet med antal; kun køb med registreret pris.' }) + '</div>';
  if (A.db.hasStore) {
    const st = new Map(); pur.forEach(function (p) { const k = p.store || 'Ukendt forhandler'; const o = st.get(k) || { b: 0, v: 0, first: p.date, ws: new Set() }; o.b += p.qty; o.v += p.qty * (p.price || 0); o.ws.add(p.w.id); if (p.date < o.first) o.first = p.date; st.set(k, o); });
    const tb = Array.from(st).sort(function (a, b) { return b[1].b - a[1].b; }).map(function (x) { return '<tr><td>' + e(x[0]) + '</td><td class="r num">' + x[1].b + '</td><td class="r num">' + x[1].ws.size + '</td><td class="r num">' + K.money(x[1].v) + '</td><td class="r num">' + (x[1].b ? K.money(x[1].v / x[1].b) : '–') + '</td><td class="num">' + K.date(x[1].first) + '</td></tr>'; }).join('');
    h += '<div class="section">' + panel('Forhandlere (alle historiske køb)', '<div class="tw"><table><thead><tr><th>Forhandler</th><th class="r">Købte fl.</th><th class="r">Vine</th><th class="r">Købsværdi</th><th class="r">Gns. pris</th><th>Første køb</th></tr></thead><tbody>' + tb + '</tbody></table></div>') + '</div>';
  }
  return h;
};
P.consumption = function (con, pur) {
  const dim = ui('co_d', 'region');
  const years = P.years(con.concat(pur || []));
  const nowY = new Date().getFullYear();
  const drunk = con.filter(function (c) { return c.drunk; });
  const reasons = new Map(); con.forEach(function (c) { reasons.set(c.reason, (reasons.get(c.reason) || 0) + c.qty); });
  let h = '<div class="section"><h2>Forbrug</h2></div><div class="grid g2">' + panel('Drukne flasker pr. år', U.columns(years.map(function (y) {
    const d = drunk.filter(function (c) { return yearOf(c.date) === y; }).reduce(function (a, c) { return a + c.qty; }, 0);
    return { label: "'" + String(y).slice(2) + (y === nowY ? '*' : ''), v: d, tip: y + ': ' + d + ' fl. drukket' };
  }), { h: 180 }), { def: 'Kun afgang registreret som drukket. Anden afgang: ' + Array.from(reasons).filter(function (r) { return !/drank|drunk|drukket|consumed|ukendt/i.test(r[0]); }).map(function (r) { return r[0] + ' ' + r[1]; }).join(', ') });
  if (pur) {
    const yr = ui('co_y', 'all');
    const inY = function (x) { return yr === 'all' || yearOf(x.date) === +yr; };
    const g = new Map(); const get = K.DIMS[dim].get;
    const ev = function (p) { return { w: p.w, qty: p.qty, price: 0, ml: 750, loc: '', store: p.store || '' }; };
    pur.filter(inY).forEach(function (p) { const k = get(ev(p)); const o = g.get(k) || { b: 0, d: 0 }; o.b += p.qty; g.set(k, o); });
    drunk.filter(inY).forEach(function (c) { const k = get(ev(c)); const o = g.get(k) || { b: 0, d: 0 }; o.d += c.qty; g.set(k, o); });
    const rows = Array.from(g).sort(function (a, b) { return (b[1].b + b[1].d) - (a[1].b + a[1].d); }).slice(0, 20);
    h += panel('Køb kontra drukket', '<div class="toolbar">' + U.select('co_d', [['region', 'Region'], ['country', 'Land'], ['grape', 'Drue'], ['producer', 'Producent'], ['color', 'Farve']], dim) + U.select('co_y', [['all', 'Alle år']].concat(years.map(function (y) { return [String(y), String(y)]; })), yr) + '</div>' +
      '<div class="tw"><table><thead><tr><th>' + K.DIMS[dim].label + '</th><th class="r">Købt</th><th class="r">Drukket</th><th class="r">Køb − drukket</th></tr></thead><tbody>' +
      rows.map(function (r) { const d = r[1].b - r[1].d; return '<tr><td>' + e(K.dimName(dim, r[0])) + '</td><td class="r num">' + r[1].b + '</td><td class="r num">' + r[1].d + '</td><td class="r num" style="color:' + (d > 0 ? 'var(--good)' : d < 0 ? 'var(--bad)' : 'inherit') + '">' + (d > 0 ? '+' : '') + d + '</td></tr>'; }).join('') +
      '</tbody></table></div>', { def: 'Beskrivende tal. En positiv forskel kan skyldes langtidslagring, en negativ tidligere køb – ingen af dem er et mål for smag.' });
  }
  return h + '</div>';
};
P.observed = function () {
  const hist = A.history || [];
  let h = '<div class="section"><h2>Observeret beholdning</h2><p class="muted" style="margin:6px 0 14px;max-width:70ch">Ved hver import gemmes en dateret observation. Forskellen mellem to observationer er en <b>nettoændring</b>: køber du tre og drikker to mellem to importer, ses kun +1.</p></div>';
  if (hist.length < 2) return h + '<div class="note">' + (hist.length ? 'Første observation er gemt ' + K.date(hist[0].d, true) + '. Udviklingen vises, når beholdningen har ændret sig ved en senere import.' : 'Ingen observationer endnu. De starter ved første godkendte import eller synkronisering.') + '</div>';
  const dim = ui('ob_d', 'color'), m = ui('ob_m', 'bottles');
  const snaps = hist.map(function (s) { return { d: s.d, items: K.snapshotItems(s, A.db, A.catalog) }; });
  const fn = K.filterFn(Object.assign(K.cloneFilters(K.filters), {}));
  snaps.forEach(function (s) { s.items = s.items.filter(fn); });
  const xs = snaps.map(function (s) { return K.date(s.d); });
  const all = [].concat.apply([], snaps.map(function (s) { return s.items; }));
  const keys = K.rank(all, dim).slice(0, 6).map(function (r) { return r.key; });
  const M = function (it) { return m === 'value' ? K.value(it) : K.sum(it); };
  const series = [{ name: 'I alt', color: 'var(--ink)', ys: snaps.map(function (s) { return M(s.items); }) }].concat(keys.map(function (k, i) {
    return { name: K.dimName(dim, k), color: U.series(i), ys: snaps.map(function (s) { return M(s.items.filter(function (it) { return K.DIMS[dim].get(it) === k; })); }) };
  }));
  h += '<div class="grid g2">' + panel('Udvikling', U.lines(xs, series, { fmt: m === 'value' ? function (v) { return K.n0(v); } : null }), { tools: U.select('ob_d', [['color', 'Farve'], ['region', 'Region'], ['country', 'Land'], ['grape', 'Drue'], ['producer', 'Producent'], ['cls', 'Vintype']], dim) + U.seg('ob_m', [['bottles', 'Flasker'], ['value', 'Værdi']], m),
    def: hist.length + ' observationer fra ' + K.date(hist[0].d) + ' til ' + K.date(hist[hist.length - 1].seen || hist[hist.length - 1].d) + '. Værdi er registreret indkøbspris på datoen, ikke markedsværdi.' });
  // seneste nettoændring
  const a = snaps[snaps.length - 2].items, b = snaps[snaps.length - 1].items;
  const qa = new Map(), qb = new Map();
  a.forEach(function (i) { qa.set(i.w.id, (qa.get(i.w.id) || 0) + i.qty); }); b.forEach(function (i) { qb.set(i.w.id, (qb.get(i.w.id) || 0) + i.qty); });
  const ch = [];
  new Set(Array.from(qa.keys()).concat(Array.from(qb.keys()))).forEach(function (id) { const d = (qb.get(id) || 0) - (qa.get(id) || 0); if (d) ch.push({ w: A.db.wines.get(id), d: d }); });
  ch.sort(function (x, y) { return y.d - x.d; });
  h += panel('Nettoændring mellem de to seneste observationer', ch.length ? '<div class="tw"><table><tbody>' + ch.slice(0, 40).map(function (c) { return '<tr class="click" data-wine="' + e(c.w.id) + '"><td>' + e(c.w.producerRaw + ' ' + c.w.label) + ' <span class="faint">' + (c.w.nv ? 'NV' : c.w.vintage) + '</span></td><td class="r num" style="color:' + (c.d > 0 ? 'var(--good)' : 'var(--bad)') + '">' + (c.d > 0 ? '+' : '') + c.d + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">Ingen ændringer i udsnittet.</div>',
    { def: K.date(snaps[snaps.length - 2].d, true) + ' → ' + K.date(snaps[snaps.length - 1].d, true) + '. Ikke det samme som køb og forbrug.' }) + '</div>';
  return h;
};
P.historyFor = function (it, dim, key) {
  if (!A.db.hasPurchases) return '';
  const get = K.DIMS[dim].get; const ef = K.eventFilter(K.filters);
  const all = A.db.purchases.filter(ef);
  const mine = all.filter(function (p) { return get({ w: p.w, qty: p.qty, price: 0, ml: 750, loc: '', store: p.store || '' }) === key; });
  if (!mine.length) return '';
  const years = P.years(all);
  const share = years.map(function (y) { const t = all.filter(function (p) { return yearOf(p.date) === y; }).reduce(function (a, p) { return a + p.qty; }, 0); const m = mine.filter(function (p) { return yearOf(p.date) === y; }).reduce(function (a, p) { return a + p.qty; }, 0); return t ? m / t : null; });
  return '<div class="section">' + panel('Andel af årets køb', U.lines(years.map(String), [{ name: K.dimName(dim, key), color: 'var(--accent)', ys: share }], { pct: true, h: 200 }), { def: mine.reduce(function (a, p) { return a + p.qty; }, 0) + ' købte flasker i alt (inkl. drukne).' }) + '</div>';
};

/* ================================================================ VÆRDI */

P.vaerdi = function () {
  const it = A.view;
  const cur = K.settings().currency === 'DKK' ? 'DKK' : 'EUR';
  let h = head('Værdi & priser', 'Registreret indkøbspris fra CellarTracker. ' + filterNote() + (cur === 'DKK' ? ' Omregnet med fast kurs ' + K.n2(K.settings().dkkRate) + ' kr. pr. €.' : ''),
    U.seg('cur', [['EUR', 'Euro'], ['DKK', 'Kroner']], cur));
  if (!it.length) return h + noData();
  const s = K.stats(it);
  h += U.kpis([
    { v: K.money(s.value), l: 'Indkøbsværdi i alt', s: 'antal × registreret pris' },
    { v: K.n0(s.priced) + ' / ' + K.n0(s.zero), l: 'Flasker med / uden pris', s: s.zero ? 'uden pris tæller ikke med' : '' },
    { v: s.avg ? K.money(s.avg) : '–', l: 'Gns. pris pr. flaske', s: 'kun flasker med pris' }
  ]);
  const dim = ui('va_d', 'producer'), m = ui('va_m', 'value');
  h += '<div class="grid g2 section">' + panel('Hvad pengene er brugt på', U.bars(it, dim, { measure: m, top: 15 }), { tools: U.select('va_d', [['producer', 'Producent'], ['region', 'Region'], ['country', 'Land'], ['grape', 'Drue'], ['cls', 'Vintype'], ['vintage', 'Årgang']].concat(A.db.hasLoc ? [['location', 'Lokation']] : []), dim) + U.measureSeg('va_m', m, ['value', 'bottles', 'avgPrice']) }) +
    panel('Prisfordeling', P.priceChart(it), { def: 'Flasker pr. prisinterval (pr. flaske, i euro).' }) + '</div>';
  const rows = U.wineRows(it).filter(function (r) { return r.price > 0; }).sort(function (a, b) { return b.price - a.price; });
  h += '<div class="section">' + panel('Dyreste vine', '<div class="tw"><table class="dv"><thead><tr><th>Vin</th><th class="r">Årgang</th><th class="r xm">Antal</th><th class="r">Pris</th></tr></thead><tbody>' +
    rows.slice(0, 15).map(function (r) { return '<tr class="click" data-wine="' + e(r.w.id) + '"><td><b>' + e(r.w.producerRaw) + '</b> ' + e(r.w.label) + (r.ml !== 750 ? ' <span class="tag">' + K.sizeLabel(r.ml) + '</span>' : '') + '</td><td class="r num">' + (r.w.nv ? 'NV' : r.w.vintage) + '</td><td class="r num xm">' + r.qty + '</td><td class="r num">' + K.money(r.price) + '</td></tr>'; }).join('') +
    '</tbody></table></div>', { def: 'Pris pr. flaske.' }) + '</div>';
  // prisniveau som lodret liste, så intet skal scrolles sidelæns
  const pd = ui('va_pd', 'region');
  const reg = K.rank(it, pd).filter(function (r) { return r.items.some(function (i) { return i.price > 0; }); });
  const q = function (items, p) { const ps = []; items.forEach(function (i) { if (i.price > 0) for (let k = 0; k < i.qty; k++) ps.push(i.price); }); ps.sort(function (a, b) { return a - b; }); return ps.length ? ps[Math.min(ps.length - 1, Math.floor(p * (ps.length - 1) + 0.5))] : 0; };
  const gmax = Math.max.apply(null, reg.map(function (r) { return q(r.items, 1); }).concat([1]));
  const X = function (v) { return (100 * v / gmax).toFixed(1) + '%'; };
  h += '<div class="section">' + panel('Prisniveau pr. ' + K.DIMS[pd].label.toLowerCase(), '<div class="pl">' + reg.slice(0, 20).map(function (r) {
    const mn = q(r.items, 0), q1 = q(r.items, 0.25), md = q(r.items, 0.5), q3 = q(r.items, 0.75), mx = q(r.items, 1);
    return '<button type="button" class="pl-row"' + U.act(pd, r.key, r.items) + U.tipAttr(r.name + ': billigste ' + K.money(mn) + ' · median ' + K.money(md) + ' · dyreste ' + K.money(mx)) + '>' +
      '<span class="pl-n">' + e(r.name) + ' <span class="faint">' + K.priceCoverage(r.items).priced + ' fl.</span></span><span class="pl-v num">median <b>' + K.money(md) + '</b></span>' +
      '<span class="pl-b"><i style="left:' + X(mn) + ';width:calc(' + X(mx) + ' - ' + X(mn) + ')"></i><em style="left:' + X(q1) + ';width:calc(' + X(q3) + ' - ' + X(q1) + ')"></em><s style="left:' + X(md) + '"></s></span></button>';
  }).join('') + '</div>', { tools: U.select('va_pd', [['region', 'Region'], ['country', 'Land'], ['grape', 'Drue'], ['cls', 'Vintype'], ['producer', 'Producent']], pd), def: 'Stregen går fra billigste til dyreste flaske, kassen viser de midterste 50 %, og den mørke streg er medianen.' }) + '</div>';
  const hist = A.history || [];
  if (hist.length >= 2) {
    const xs = hist.map(function (s) { return K.date(s.d); });
    const rate = cur === 'DKK' ? K.settings().dkkRate : 1;
    h += '<div class="section">' + panel('Indkøbsværdi over tid', U.lines(xs, [{ name: 'Værdi', color: 'var(--accent)', ys: hist.map(function (s) { return rate * s.r.reduce(function (a, r) { return a + r[2] * (r[3] || 0); }, 0); }) }], { fmt: function (v) { return K.n0(v); } }), { def: 'Beholdning × registreret pris ved hver import (hele samlingen).' }) + '</div>';
  }
  return h;
};
P.priceChart = function (it) {
  const bands = K.rank(it, 'priceBand', 'bottles', { natural: true });
  return U.columns(bands.map(function (b) {
    const short = { 'Ingen pris': 'Ingen', 'Under 20 €': '<20', 'Over 150 €': '150+' };
    return { label: short[b.name] || b.name.replace(' €', ''), v: b.v, act: U.act('priceBand', b.key, b.items, 'Pris: ' + b.name), tip: b.name + ': ' + b.v + ' fl.', color: b.key === 'Ingen pris' ? 'var(--ink-3)' : 'var(--accent)' }; }), { h: 180, label: 'Prisfordeling' });
};


/* ================================================================ UDVIKLING */

P.udvMain = function () {
  const db = A.db;
  let h = head('Udvikling', 'Hvordan samlingen har ændret sig år for år. Vælg hvad der skal fordeles på, og om du vil se beholdningen eller årets køb.');
  const dim = ui('ud_d', 'color');
  const inclR = ui('ud_r', 'nej') === 'ja';
  const isR = function (p) { return /^restaurant$/i.test(p.store || ''); };
  const ef = K.eventFilter(K.filters);
  // »Restaurant«-køb er typisk vine drukket ude; de påvirker kun visningen af årets køb, ikke beholdningen.
  const purAll = db.purchases.filter(ef);
  let pur = purAll;
  const con = db.consumed.filter(ef);
  const persp = [];
  if (db.hasPurchases && db.hasConsumed) persp.push(['hold', 'Beholdning ved årets udgang']);
  if (db.hasPurchases) persp.push(['buy', 'Købt pr. år']);
  if (db.hasPurchases || db.bottleLevel) persp.push(['have', 'Nuværende flasker efter købsår']);
  if (!persp.length) return h + '<div class="note">Udviklingen kræver CellarTrackers købshistorik (Purchase) og helst også forbrug (Consumed). ' + (A.src.mode === 'sync' ? 'Synkroniseringen henter dem, når de er tilgængelige; se <a href="#data" data-nav="data">Data & synk</a>.' : 'Upload dem under <a href="#data" data-nav="data">Data & synk</a>, eller sæt den automatiske synkronisering op.') + '</div>';
  let pv = ui('ud_p', persp[0][0]);
  if (!persp.some(function (x) { return x[0] === pv; })) pv = persp[0][0];
  if (pv === 'buy' && !inclR) pur = purAll.filter(function (p) { return !isR(p); });
  const get = K.DIMS[dim].get;
  const ev = function (e) { return { w: e.w, qty: e.qty, price: e.price || 0, ml: 750, loc: '', store: e.store || '' }; };
  const nowY = new Date().getFullYear();
  // tællinger pr. år og kategori
  const byY = new Map();
  const add = function (y, k, q) { if (!byY.has(y)) byY.set(y, new Map()); const m = byY.get(y); m.set(k, (m.get(k) || 0) + q); };
  let years = [];
  if (pv === 'buy') {
    pur.forEach(function (p) { add(p.date.getFullYear(), get(ev(p)), p.qty); });
    years = Array.from(byY.keys()).sort();
  } else if (pv === 'have') {
    if (db.bottleLevel) A.view.forEach(function (i) { if (i.pdate) add(i.pdate.getFullYear(), get(i), i.qty); });
    else pur.forEach(function (p) { if (p.rem) add(p.date.getFullYear(), get(ev(p)), p.rem); });
    years = Array.from(byY.keys()).sort();
  } else {
    const delta = new Map();
    const dd = function (y, k, q) { if (!delta.has(y)) delta.set(y, new Map()); const m = delta.get(y); m.set(k, (m.get(k) || 0) + q); };
    pur.forEach(function (p) { dd(p.date.getFullYear(), get(ev(p)), p.qty); });
    con.forEach(function (c) { dd(c.date.getFullYear(), get(ev(c)), -c.qty); });
    const ys = Array.from(delta.keys()); const y0 = Math.min.apply(null, ys);
    const run = new Map();
    for (let y = y0; y <= nowY; y++) {
      (delta.get(y) || new Map()).forEach(function (q, k) { run.set(k, (run.get(k) || 0) + q); });
      run.forEach(function (q, k) { if (q > 0) add(y, k, q); });
      years.push(y);
    }
  }
  if (!years.length) return h + '<div class="empty">Ingen data matcher filtrene.</div>';
  if (pv !== 'hold') { const lo = years[0], hi = years[years.length - 1]; years = []; for (let y = lo; y <= hi; y++) years.push(y); }
  // de største kategorier, resten som Øvrige
  const tot = new Map();
  (pv === 'hold' ? [years[years.length - 1]] : years).forEach(function (y) { (byY.get(y) || new Map()).forEach(function (q, k) { tot.set(k, (tot.get(k) || 0) + q); }); });
  years.forEach(function (y) { (byY.get(y) || new Map()).forEach(function (q, k) { if (!tot.has(k)) tot.set(k, 0); }); });
  const D = K.DIMS[dim];
  let keys = Array.from(tot.keys()).sort(function (a, b) { return D.order ? D.order.indexOf(a) - D.order.indexOf(b) : tot.get(b) - tot.get(a); });
  const n = +ui('ud_n', 6);
  if (!D.order) keys = Array.from(tot.keys()).sort(function (a, b) { return tot.get(b) - tot.get(a); });
  const shown = keys.slice(0, n), hasOther = keys.length > n;
  const val = function (y, k) {
    const m = byY.get(y) || new Map();
    if (k === '…') { let s = 0; m.forEach(function (q, kk) { if (shown.indexOf(kk) < 0) s += q; }); return s; }
    return m.get(k) || 0;
  };
  const allKeys = shown.concat(hasOther ? ['…'] : []);
  const color = function (k, i) { return k === '…' ? 'var(--line-2)' : U.color(dim, k, i); };
  const nm = function (k) { return k === '…' ? 'Øvrige' : K.dimName(dim, k); };
  const ytot = function (y) { let s = 0; (byY.get(y) || new Map()).forEach(function (q) { s += q; }); return s; };
  const xs = years.map(function (y) { return pv === 'buy' && y === nowY ? y + '*' : String(y); });
  const label = { hold: 'flasker i beholdningen ved årets udgang', buy: 'købte flasker i året', have: 'nuværende flasker købt i året' }[pv];
  // værktøjslinje
  h += '<div class="toolbar">' + U.seg('ud_p', persp, pv) + '</div><div class="toolbar">' +
    '<label class="inl">Fordel på ' + U.select('ud_d', [['color', 'Farve'], ['cls', 'Vintype'], ['grape', 'Drue'], ['country', 'Land'], ['region', 'Region'], ['producer', 'Producent']].concat(db.hasStore ? [['store', 'Forhandler']] : []), dim) + '</label>' +
    '<label class="inl">Vis ' + U.select('ud_n', [['4', 'top 4'], ['6', 'top 6'], ['8', 'top 8'], ['10', 'top 10'], ['12', 'top 12']], String(n)) + '</label>' +
    (pv === 'buy' && purAll.some(isR) ? '<label class="inl">' + U.select('ud_r', [['nej', 'Uden »Restaurant«'], ['ja', 'Med »Restaurant«']], inclR ? 'ja' : 'nej') + '</label>' : '') + '</div>';
  // 1: antal
  const series = shown.map(function (k, i) { return { name: nm(k), color: color(k, i), ys: years.map(function (y) { return val(y, k); }) }; });
  h += '<div class="grid g2">' + panel('Antal', U.lines(xs, series, { label: 'Antal pr. år' }), { def: 'Antal ' + label + '.' + (pv === 'buy' && years.indexOf(nowY) >= 0 ? ' * = år til dato.' : '') });
  // 2: andel
  const groups = years.map(function (y) { return { x: String(y), parts: allKeys.map(function (k) { return { key: k, name: nm(k), v: val(y, k) }; }) }; });
  h += panel('Andel', U.stackCols(groups, allKeys, { color: color }) + '<div class="legend">' + allKeys.map(function (k, i) { return '<span><span class="sw" style="background:' + color(k, i) + '"></span>' + esc(nm(k)) + '</span>'; }).join('') + '</div>', { def: 'Hver søjle er 100 % af ' + label + '.' }) + '</div>';
  // 3: lagkage for et valgt år
  const py = +ui('ud_y', years[years.length - 1]);
  const yy = years.indexOf(py) >= 0 ? py : years[years.length - 1];
  const parts = allKeys.map(function (k, i) { return { name: nm(k), v: val(yy, k), color: color(k, i) }; });
  h += '<div class="grid g2 section">' + panel('Fordeling ' + yy, U.pie(parts, { label: 'Fordeling ' + yy }), { tools: U.select('ud_y', years.slice().reverse().map(function (y) { return [String(y), String(y)]; }), String(yy)), def: K.n0(ytot(yy)) + ' ' + label + '.' });
  // tabel med andel pr. år
  const tb = '<div class="tw"><table class="dv"><thead><tr><th></th>' + years.slice(U.narrow() ? -3 : -6).map(function (y) { return '<th class="r">' + y + '</th>'; }).join('') + '</tr></thead><tbody>' +
    allKeys.map(function (k) { return '<tr><td>' + esc(nm(k)) + '</td>' + years.slice(U.narrow() ? -3 : -6).map(function (y) { const t = ytot(y); return '<td class="r num"' + U.tipAttr(nm(k) + ' ' + y + ': ' + val(y, k) + ' af ' + t + ' fl.') + '>' + (t ? K.n0(val(y, k) / t * 100) + ' %' : '–') + '</td>'; }).join('') + '</tr>'; }).join('') +
    '<tr><td class="faint">I alt</td>' + years.slice(U.narrow() ? -3 : -6).map(function (y) { return '<td class="r num faint">' + K.n0(ytot(y)) + '</td>'; }).join('') + '</tr></tbody></table></div>';
  h += panel('Andel de seneste år', tb, { def: 'Procent af årets ' + label + '. Holder du musen over et tal, ser du antallet.' }) + '</div>';
  // gennemsnitspris pr. købt flaske, år for år
  const pe = db.hasPurchases ? purAll.filter(function (p) { return !isR(p) && p.price > 0; }).map(function (p) { return { y: p.date.getFullYear(), k: get(ev(p)), q: p.qty, pr: p.price }; })
    : A.view.filter(function (i) { return i.pdate && i.price > 0; }).map(function (i) { return { y: i.pdate.getFullYear(), k: get(i), q: i.qty, pr: i.price }; });
  if (pe.length) {
    const rate = K.settings().currency === 'DKK' ? K.settings().dkkRate : 1;
    const yv = pe.map(function (x) { return x.y; }); const pys = [];
    for (let y = Math.min.apply(null, yv); y <= Math.max.apply(null, yv); y++) pys.push(y);
    const avg = function (fn) { return pys.map(function (y) { let s = 0, n = 0; pe.forEach(function (x) { if (x.y === y && fn(x)) { s += x.q * x.pr; n += x.q; } }); return n ? s / n * rate : null; }); };
    const cnt = function (fn) { return pys.map(function (y) { let n = 0; pe.forEach(function (x) { if (x.y === y && fn(x)) n += x.q; }); return n; }); };
    const unit = rate === 1 ? ' €' : ' kr.';
    const mk = function (name, col, fn) { const a = avg(fn), c = cnt(fn); return { name: name, color: col, ys: a, tips: a.map(function (v, i) { return v === null ? '' : K.n0(v) + unit + ' i snit (' + c[i] + ' fl.)'; }) }; };
    // valgte linjer huskes pr. inddeling; standard er »Alle« plus de fire største
    const selKey = 'pr_sel_' + dim;
    if (!A.ui[selKey]) A.ui[selKey] = ['*'].concat(shown.slice(0, 4));
    const sel = A.ui[selKey];
    const ser = (sel.indexOf('*') >= 0 ? [mk('Alle', 'var(--ink)', function () { return true; })] : [])
      .concat(shown.map(function (k, i) { return sel.indexOf(k) >= 0 ? mk(nm(k), color(k, i), function (x) { return x.k === k; }) : null; }).filter(Boolean));
    const tog = '<div class="toolbar" style="gap:6px">' + [['*', 'Alle', 'var(--ink)']].concat(shown.map(function (k, i) { return [k, nm(k), color(k, i)]; })).map(function (o) {
      const on = sel.indexOf(o[0]) >= 0;
      return '<button type="button" class="fbtn' + (on ? ' loc' : '') + '" data-act="pr-tog" data-dim="' + e(dim) + '" data-k="' + e(o[0]) + '" aria-pressed="' + on + '"><span class="sw" style="background:' + o[2] + '"></span>' + e(o[1]) + '</button>';
    }).join('') + '</div>';
    h += '<div class="section">' + panel('Gennemsnitspris pr. købt flaske', tog + (ser.length ? U.lines(pys.map(String), ser, { fmt: function (v) { return K.n0(v) + unit; }, label: 'Gennemsnitspris pr. år' }) : '<div class="empty">Vælg mindst én linje.</div>'),
      { def: 'Vægtet med antal flasker; kun køb med registreret pris' + (db.hasPurchases ? ', uden »Restaurant«' : ' (kun nuværende flasker)') + '. Tryk på knapperne for at vise eller skjule linjer. »Alle« er alle køb samlet.' }) + '</div>';
  }
  if (pv === 'hold') {
    const recon = ytot(nowY), actual = K.sum(A.view);
    h += '<div class="note" style="margin-top:14px">Beholdningen er regnet ud som køb minus afgang år for år. ' + (Math.abs(recon - actual) > 2 ? 'Udregningen giver ' + K.n0(recon) + ' fl. i dag, mens kælderen faktisk har ' + K.n0(actual) + ' fl. Forskellen skyldes typisk flasker uden registreret køb eller afgang.' : 'Den stemmer med den faktiske beholdning i dag (' + K.n0(actual) + ' fl.).') + '</div>';
  } else if (pv === 'have') {
    h += '<div class="note" style="margin-top:14px">Viser kun de flasker, du har nu, fordelt på det år de blev købt. Drukne flasker indgår ikke. Med CellarTrackers forbrugsdata (Consumed) kan dashboardet vise den faktiske beholdning år for år.</div>';
  }
  return h;
};


/* ================================================================ SAMLEDE FANER */

const subnav = function (key, opts, dflt) { return '<div class="subnav noprint">' + U.seg(key, opts, ui(key, dflt)) + '</div>'; };
P.udforsk = function () {
  const v = ui('uf', 'geografi');
  return subnav('uf', [['geografi', 'Geografi'], ['druer', 'Druer & vintyper'], ['producenter', 'Producenter']], 'geografi') + (P[v] || P.geografi)();
};
P.udvikling = function () {
  const v = ui('udv', 'udvikling');
  return subnav('udv', [['udvikling', 'Udvikling'], ['vaerdi', 'Værdi & priser']], 'udvikling') + (v === 'vaerdi' ? P.vaerdi() : P.udvMain());
};

/* ================================================================ CELLAR LAB */

P.lab = function () {
  const it = A.view;
  let h = head('Cellar Lab', 'Nørdede krydsanalyser af din samling. Alt er beskrivende, beregnet på de aktive filtre og klikbart ned til vinene. ' + filterNote());
  if (!it.length) return h + noData();
  h += '<nav class="toolbar" style="margin-bottom:18px">' + [['lab-builder', 'Analysebygger'], ['lab-depth', 'Bredde og dybde'], ['lab-vert', 'Vertikaler'], ['lab-hor', 'Horisontaler'], ['lab-vint', 'Årgangsunivers'], ['lab-div', 'Diversitet'], ['lab-rare', 'Sjældne kombinationer'], ['lab-overlap', 'Producentoverlap']].map(function (x) { return '<a class="btn sm" href="#lab" data-act="jump" data-to="' + x[0] + '">' + x[1] + '</a>'; }).join('') + '</nav>';
  h += P.builder(it);
  h += P.depth(it);
  h += '<div class="section" id="lab-vert">' + panel('Vertikaler', P.verticalMatrix(it, false), { def: 'Samme vin (producent + navn) i mindst to forskellige årgange. Specialcuvéer har eget navn og slås ikke sammen med standardcuvéen. NV tæller ikke som årgang.' }) + '</div>';
  h += P.horizontals(it);
  h += P.vintUniverse(it);
  h += P.diversityPanel(it);
  h += P.rare(it);
  h += P.overlap(it);
  return h;
};
P.builder = function (it) {
  const dims = U.dimOptions(A.db);
  const r = ui('b_r', 'region'), c = ui('b_c', 'grape'), m = ui('b_m', 'bottles'), v = ui('b_v', 'heat'), mode = ui('b_p', 'abs'), n = +ui('b_n', 15);
  let body = '<div class="toolbar"><label class="inl">Rækker ' + U.select('b_r', dims, r) + '</label><label class="inl">Kolonner ' + U.select('b_c', [['', '(ingen)']].concat(dims.filter(function (d) { return d[0] !== r; })), c === r ? '' : c) + '</label>' +
    '<label class="inl">Måling ' + U.select('b_m', [['bottles', 'Flasker'], ['wines', 'Unikke vine'], ['value', 'Indkøbsværdi'], ['avgPrice', 'Gns. pris'], ['producers', 'Producenter'], ['liters', 'Liter']], m) + '</label>' +
    '<label class="inl">Top ' + U.select('b_n', [['8', '8'], ['15', '15'], ['25', '25'], ['50', '50']], String(n)) + '</label>' +
    (c && c !== r ? U.seg('b_v', [['heat', 'Heatmap'], ['stack', 'Stablet 100 %']], v) + (v === 'heat' ? U.seg('b_p', [['abs', 'Antal'], ['row', 'Række-%'], ['col', 'Kolonne-%'], ['total', 'Af alt']], mode) : '') : '') + '</div>';
  if (!c || c === r) {
    body += U.bars(it, r, { measure: m, top: n });
  } else if (v === 'stack') {
    const rows = K.rank(it, r).slice(0, n); const cols = K.rank(it, c).slice(0, 8).map(function (x) { return x.key; });
    body += '<div class="bars">' + rows.map(function (row) {
      const tot = K.sum(row.items);
      const parts = cols.map(function (k, i) { const s = row.items.filter(function (x) { return K.DIMS[c].get(x) === k; }); return s.length ? '<button type="button" style="flex:' + K.sum(s) + ';background:' + U.color(c, k, i) + '" data-reg="' + U.reg(s, row.name + ' × ' + K.dimName(c, k)) + '"' + U.tipAttr(row.name + ' · ' + K.dimName(c, k) + ': ' + K.sum(s) + ' fl. (' + K.pct(K.sum(s) / tot) + ')') + '></button>' : ''; }).join('');
      const rest = row.items.filter(function (x) { return cols.indexOf(K.DIMS[c].get(x)) < 0; });
      return '<div style="display:grid;grid-template-columns:minmax(90px,30%) 1fr 50px;gap:10px;align-items:center;font-size:.86rem"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + e(row.name) + '</span><div class="stack" style="height:16px">' + parts + (rest.length ? '<button type="button" style="flex:' + K.sum(rest) + ';background:var(--line-2)" data-reg="' + U.reg(rest, row.name + ' · øvrige') + '"></button>' : '') + '</div><span class="num faint" style="text-align:right">' + tot + '</span></div>';
    }).join('') + '</div><div class="legend">' + cols.map(function (k, i) { return '<span><span class="sw" style="background:' + U.color(c, k, i) + '"></span> ' + e(K.dimName(c, k)) + '</span>'; }).join('') + '<span><span class="sw" style="background:var(--line-2)"></span> Øvrige</span></div><div class="faint" style="font-size:.78rem;margin-top:6px">Hver række summerer til 100 % af rækkens flasker.</div>';
  } else {
    body += U.heat(it, r, c, { measure: m, mode: m === 'avgPrice' ? 'abs' : mode, topR: n, topC: Math.min(9, n) });
  }
  return '<div id="lab-builder">' + panel('Fri analysebygger', body, { def: 'Vælg to dimensioner og en måling. Eksempler: region × drue, producent × årgang, land × vintype i værdi, drue × region i gennemsnitspris.' }) + '</div>';
};
P.depth = function (it) {
  const per = Array.from(K.group(it, function (i) { return i.w.id; }).values());
  const buckets = [1, 2, 3, 4, 5, 6].map(function (b) { const g = per.filter(function (x) { const q = K.sum(x); return b === 6 ? q >= 6 : q === b; }); return { b: b, n: g.length, q: g.reduce(function (a, x) { return a + K.sum(x); }, 0), items: [].concat.apply([], g) }; });
  const tot = K.sum(it), wines = per.length;
  let body = '<div class="grid g2"><div>' + U.columns(buckets.map(function (x) { return { label: x.b === 6 ? '6+' : String(x.b), v: x.n, act: x.items.length ? ' data-reg="' + U.reg(x.items, 'Vine med ' + (x.b === 6 ? '6 eller flere' : x.b) + ' fl.') + '"' : '', tip: x.n + ' vinposter med ' + (x.b === 6 ? '6+' : x.b) + ' fl. = ' + x.q + ' fl. (' + K.pct(x.q / tot) + ' af flaskerne)' }; }), { h: 180, label: 'Flasker pr. vin' }) +
    '<div class="faint" style="font-size:.78rem">Antal vinposter (iWine) efter hvor mange flasker du har af hver.</div></div><div><dl class="kv">' +
    '<dt>Singletons</dt><dd>' + buckets[0].n + ' af ' + wines + ' vinposter (' + K.pct(buckets[0].n / (wines || 1)) + ') · ' + buckets[0].q + ' af ' + tot + ' fl. (' + K.pct(buckets[0].q / (tot || 1)) + ')</dd>' +
    '<dt>Gns. flasker pr. vin</dt><dd class="num">' + K.n2(tot / (wines || 1)) + '</dd>' +
    '<dt>Gns. flasker pr. cuvée</dt><dd class="num">' + K.n2(tot / (K.group(it, 'cuvee').size || 1)) + '</dd>' +
    '<dt>Gns. flasker pr. producent</dt><dd class="num">' + K.n2(tot / (K.group(it, 'producer').size || 1)) + '</dd>' +
    '<dt>Sidste flasker</dt><dd>' + buckets[0].n + ' vine har kun én flaske tilbage <button class="link" data-reg="' + U.reg(buckets[0].items, 'Sidste flaske') + '">vis</button></dd></dl>' +
    '<h3 style="margin:16px 0 6px;font-size:.95rem">Eneste repræsentant</h3><dl class="kv">' + ['producer', 'region', 'grape', 'appellation'].map(function (d) {
      const one = K.rank(it.filter(function (i) { return d !== 'appellation' || i.w.appellation; }), d).filter(function (r) { return r.v === 1; });
      return '<dt>' + K.DIMS[d].label + '</dt><dd>' + one.length + ' med kun én flaske' + (one.length ? ' <button class="link" data-reg="' + U.reg([].concat.apply([], one.map(function (o) { return o.items; })), K.DIMS[d].label + ' med én flaske') + '">vis</button>' : '') + '</dd>';
    }).join('') + '</dl></div></div>';
  // bredde vs dybde pr. producent
  const pr = Array.from(K.group(it, 'producer')).map(function (x) { const s = K.stats(x[1]); return { k: x[0], items: x[1], s: s, depth: s.bottles / (s.cuvees || 1) }; }).filter(function (x) { return x.s.bottles >= 3; });
  const br = pr.slice().sort(function (a, b) { return b.s.cuvees - a.s.cuvees || b.s.vintages - a.s.vintages; }).slice(0, 8);
  const dp = pr.slice().sort(function (a, b) { return b.depth - a.depth || b.s.bottles - a.s.bottles; }).slice(0, 8);
  const tbl = function (list, col) { return '<div class="tw"><table><thead><tr><th>Producent</th><th class="r">Fl.</th><th class="r">Cuvéer</th><th class="r">Årg.</th><th class="r">Fl./cuvée</th></tr></thead><tbody>' + list.map(function (x) { return '<tr class="click"' + U.act('producer', x.k, x.items) + '><td>' + e(x.k) + '</td><td class="r num">' + x.s.bottles + '</td><td class="r num"' + (col === 'b' ? ' style="font-weight:600"' : '') + '>' + x.s.cuvees + '</td><td class="r num">' + x.s.vintages + '</td><td class="r num"' + (col === 'd' ? ' style="font-weight:600"' : '') + '>' + K.n1(x.depth) + '</td></tr>'; }).join('') + '</tbody></table></div>'; };
  body += '<div class="grid g2" style="margin-top:18px"><div><h3 style="font-size:.95rem;margin-bottom:6px">Bredde: flest forskellige cuvéer</h3>' + tbl(br, 'b') + '</div><div><h3 style="font-size:.95rem;margin-bottom:6px">Dybde: flest flasker pr. cuvée</h3>' + tbl(dp, 'd') + '</div></div><div class="faint" style="font-size:.78rem;margin-top:6px">Producenter med mindst 3 flasker.</div>';
  return '<div class="section" id="lab-depth">' + panel('Bredde og dybde', body) + '</div>';
};
P.horizontals = function (it) {
  const crit = ui('h_c', 'appellation');
  const ys = Array.from(new Set(it.filter(function (i) { return !i.w.nv; }).map(function (i) { return i.w.vintage; }))).sort(function (a, b) { return b - a; });
  const y = ui('h_y', 'all');
  const lab = { appellation: 'Samme appellation og årgang, forskellige producenter', grape: 'Samme drue og årgang, forskellige regioner', producer: 'Samme producent og årgang, forskellige marker/cuvéer', region: 'Samme region og årgang, forskellige producenter' };
  const keyOf = { appellation: function (w) { return w.appellation; }, grape: function (w) { return w.master; }, producer: function (w) { return w.producer; }, region: function (w) { return w.regionKey; } }[crit];
  const varOf = { appellation: function (w) { return w.producer; }, grape: function (w) { return w.regionKey; }, producer: function (w) { return w.cuvee; }, region: function (w) { return w.producer; } }[crit];
  const g = new Map();
  it.forEach(function (i) { if (i.w.nv || (y !== 'all' && i.w.vintage !== +y)) return; const k = keyOf(i.w); if (!k || k === K.UNKNOWN) return; const kk = i.w.vintage + '\u0001' + k; (g.get(kk) || g.set(kk, []).get(kk)).push(i); });
  const groups = Array.from(g).map(function (x) { return { y: x[0].split('\u0001')[0], k: x[0].split('\u0001')[1], items: x[1], n: new Set(x[1].map(function (i) { return varOf(i.w); })).size }; }).filter(function (x) { return x.n >= 2; })
    .sort(function (a, b) { return b.n - a.n || K.sum(b.items) - K.sum(a.items); });
  const nm = function (k) { return crit === 'region' ? K.dimName('region', k) : k; };
  let body = '<div class="toolbar">' + U.select('h_c', Object.keys(lab).map(function (k) { return [k, lab[k]]; }), crit) + U.select('h_y', [['all', 'Alle årgange']].concat(ys.map(function (v) { return [String(v), String(v)]; })), String(y)) + '</div>';
  body += groups.length ? '<div class="grid g2">' + groups.slice(0, 12).map(function (gr) {
    const wl = U.wineRows(gr.items).sort(function (a, b) { return a.w.producer.localeCompare(b.w.producer, 'da'); });
    return '<div style="border:1px solid var(--line);border-radius:var(--r);padding:12px 14px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline"><b>' + e(nm(gr.k)) + ' ' + gr.y + '</b><span class="faint num">' + gr.n + ' ' + (crit === 'grape' ? 'regioner' : crit === 'producer' ? 'cuvéer' : 'producenter') + '</span></div>' +
      wl.map(function (r) { return '<div class="click" data-wine="' + e(r.w.id) + '" style="cursor:pointer;font-size:.86rem;display:flex;justify-content:space-between;gap:8px;padding:2px 0"><span>' + e(r.w.producerRaw) + ' <span class="muted">' + e(r.w.label) + '</span>' + (crit === 'grape' ? ' <span class="faint">· ' + e(r.w.regionDa) + '</span>' : '') + '</span><span class="num faint">' + r.qty + ' fl.' + (r.price ? ' · ' + K.n0(r.price) + ' €' : '') + '</span></div>'; }).join('') + '</div>';
  }).join('') + '</div>' + (groups.length > 12 ? '<div class="faint" style="margin-top:6px">' + groups.length + ' kandidater i alt; viser de 12 bredeste.</div>' : '') : '<div class="empty">Ingen kandidater med de valgte kriterier.</div>';
  return '<div class="section" id="lab-hor">' + panel('Horisontaler og tematiske smagninger', body, { def: 'Sammenlignelige vine fra samme årgang, fundet med faste regler ud fra registrerede data. Ingen kvalitetsvurdering.' }) + '</div>';
};
P.vintUniverse = function (it) {
  const num = []; it.forEach(function (i) { if (!i.w.nv) for (let k = 0; k < i.qty; k++) num.push(i.w.vintage); });
  num.sort(function (a, b) { return a - b; });
  const nv = K.sum(it.filter(function (i) { return i.w.nv; }));
  const cnt = new Map(); num.forEach(function (v) { cnt.set(v, (cnt.get(v) || 0) + 1); });
  const mode = Array.from(cnt).sort(function (a, b) { return b[1] - a[1]; })[0];
  const mean = num.reduce(function (a, b) { return a + b; }, 0) / (num.length || 1);
  const sd = Math.sqrt(num.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (num.length || 1));
  const cut = +ui('vu_cut', 2020);
  const after = num.filter(function (v) { return v >= cut; }).length;
  const hd = ui('vu_d', 'region');
  let body = '<div class="grid g2"><div>' + U.vintages(it) + '</div><div><dl class="kv"><dt>Ældste / yngste</dt><dd class="num">' + (num.length ? num[0] + ' / ' + num[num.length - 1] : '–') + '</dd><dt>Mest repræsenteret</dt><dd class="num">' + (mode ? mode[0] + ' (' + mode[1] + ' fl.)' : '–') + '</dd>' +
    '<dt>Median / gennemsnit</dt><dd class="num">' + (num.length ? num[Math.floor((num.length - 1) / 2)] + ' / ' + K.n1(mean) : '–') + '</dd><dt>Spredning (sd)</dt><dd class="num">' + K.n1(sd) + ' år</dd><dt>Uden årgang (NV)</dt><dd class="num">' + nv + ' fl.</dd>' +
    '<dt>Fra og med <input type="number" value="' + cut + '" data-act="vu-cut" style="width:76px;padding:2px 6px"></dt><dd class="num">' + after + ' fl. (' + K.pct(after / (num.length || 1)) + ' af flasker med årgang)</dd></dl><div class="faint" style="font-size:.78rem;margin-top:8px">Vægtet pr. flaske. Ikke købsår, modenhed eller årgangskvalitet.</div></div></div>';
  body += '<div style="margin-top:16px">' + U.select('vu_d', [['region', 'Årgang × region'], ['grape', 'Årgang × drue'], ['producer', 'Årgang × producent'], ['color', 'Årgang × farve']], hd) + '</div><div style="margin-top:8px">' + U.heat(it, hd, 'vintage', { topR: 14, topC: 22 }) + '</div>';
  return '<div class="section" id="lab-vint">' + panel('Årgangsunivers', body) + '</div>';
};
P.diversityPanel = function (it) {
  const rows = ['producer', 'region', 'country', 'grape', 'appellation', 'vineyard'].map(function (d) {
    const base = d === 'appellation' || d === 'vineyard' ? it.filter(function (i) { return d === 'appellation' ? i.w.appellation : i.w.vineyard; }) : it;
    return { d: d, x: K.diversity(base, d), base: K.sum(base) };
  });
  const body = '<div class="tw"><table class="dv"><thead><tr><th>Dimension</th><th class="r">Kategorier</th><th class="r xm">25 %</th><th class="r">50 %</th><th class="r xm">75 %</th><th class="r xm">90 %</th><th class="r">Top 1</th><th class="r xm">Top 3</th><th class="r xm">Top 10</th><th class="r xm">Shannon H</th><th class="r xm">Effektivt antal</th><th class="r xm">HHI</th></tr></thead><tbody>' +
    rows.map(function (r) { const x = r.x; return '<tr><td>' + K.DIMS[r.d].label + (r.base !== K.sum(it) ? ' <span class="faint xm">(' + r.base + ' fl. med kendt værdi)</span>' : '') + '</td><td class="r num">' + x.n + '</td><td class="r num xm">' + x.c25 + '</td><td class="r num">' + x.c50 + '</td><td class="r num xm">' + x.c75 + '</td><td class="r num xm">' + x.c90 + '</td><td class="r num">' + K.pct(x.t1) + '</td><td class="r num xm">' + K.pct(x.t3) + '</td><td class="r num xm">' + K.pct(x.t10) + '</td><td class="r num xm">' + K.n2(x.H) + '</td><td class="r num xm">' + K.n1(x.eff) + '</td><td class="r num xm">' + K.n2(x.HHI * 100) + '</td></tr>'; }).join('') +
    '</tbody></table></div><div class="faint" style="font-size:.78rem;margin-top:6px">25–90 %: hvor mange af de største kategorier der tilsammen dækker andelen af flaskerne. H = −Σ pᵢ ln pᵢ over flaskefordelingen; effektivt antal = e^H; HHI = Σ pᵢ² (×100). Ukendt appellation/mark er udeladt. Beskrivende, ikke en karakter.</div>';
  const pd = ui('dv_d', 'region');
  const d = K.diversity(it, pd); let c = 0; const tot = K.sum(it) || 1;
  const pts = d.rank.map(function (r) { c += r.v; return c / tot; });
  const par = U.lines(d.rank.map(function (r, i) { return String(i + 1); }), [{ name: 'Kumuleret', color: 'var(--accent)', ys: pts, tips: d.rank.map(function (r, i) { return '#' + (i + 1) + ' ' + r.name + ': ' + K.pct(pts[i]); }) }], { pct: true, max: 1, h: 200 });
  return '<div class="section" id="lab-div">' + panel('Diversitet og koncentration', body + '<div style="margin-top:18px" class="toolbar"><b>Pareto-kurve</b>' + U.select('dv_d', [['region', 'Regioner'], ['producer', 'Producenter'], ['grape', 'Druer'], ['country', 'Lande']], pd) + '</div>' + par) + '</div>';
};
P.rare = function (it) {
  const a = ui('rr_a', 'country'), b = ui('rr_b', 'grape');
  const g = new Map();
  it.forEach(function (i) { const k = K.DIMS[a].get(i) + '\u0001' + K.DIMS[b].get(i); (g.get(k) || g.set(k, []).get(k)).push(i); });
  const list = Array.from(g).map(function (x) { return { k: x[0].split('\u0001'), items: x[1], n: K.sum(x[1]) }; }).filter(function (x) { return x.n <= 2 && x.k[1] !== K.UNKNOWN; }).sort(function (x, y) { return x.n - y.n || K.dimName(a, x.k[0]).localeCompare(K.dimName(a, y.k[0]), 'da'); });
  const body = '<div class="toolbar">' + U.select('rr_a', [['country', 'Land'], ['region', 'Region']], a) + ' × ' + U.select('rr_b', [['grape', 'Drue'], ['cls', 'Vintype'], ['color', 'Farve']], b) + '<span class="faint">' + list.length + ' kombinationer med 1–2 flasker</span></div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px">' + list.slice(0, 60).map(function (x) { return '<button class="chip" style="cursor:pointer;padding-right:11px" data-reg="' + U.reg(x.items, K.dimName(a, x.k[0]) + ' × ' + K.dimName(b, x.k[1])) + '">' + e(K.dimName(a, x.k[0])) + ' × <b>' + e(K.dimName(b, x.k[1])) + '</b> <span class="num faint">' + x.n + '</span></button>'; }).join('') + '</div>';
  return '<div class="section" id="lab-rare">' + panel('Sjældne kombinationer i din samling', body, { def: 'Kombinationer du kun har én eller to flasker af. Sjælden i din kælder – ikke nødvendigvis i verden.' }) + '</div>';
};
P.overlap = function (it) {
  const pr = Array.from(K.group(it, 'producer')).map(function (x) { return { k: x[0], items: x[1], regs: K.rank(x[1], 'region'), apps: new Set(x[1].filter(function (i) { return i.w.appellation; }).map(function (i) { return i.w.appellation; })).size, vys: new Set(x[1].filter(function (i) { return i.w.vineyard; }).map(function (i) { return i.w.vineyard; })).size }; });
  const multi = pr.filter(function (p) { return p.regs.length > 1; });
  const deep = pr.filter(function (p) { return p.apps + p.vys > 2; }).sort(function (a, b) { return (b.apps + b.vys) - (a.apps + a.vys); }).slice(0, 10);
  const body = '<div class="grid g2"><div><h3 style="font-size:.95rem;margin-bottom:6px">Producenter registreret i flere regioner</h3>' + (multi.length ? multi.map(function (p) { return '<div style="padding:3px 0;font-size:.88rem"><button class="link"' + U.act('producer', p.k, p.items) + '>' + e(p.k) + '</button> <span class="muted">' + p.regs.map(function (r) { return e(r.name) + ' (' + r.v + ')'; }).join(', ') + '</span></div>'; }).join('') : '<div class="faint">Ingen.</div>') + '<div class="faint" style="font-size:.78rem;margin-top:6px">»Region ikke angivet« er en manglende registrering, ikke en ekstra region.</div></div>' +
    '<div><h3 style="font-size:.95rem;margin-bottom:6px">Mark- og appellationsdybde</h3><div class="tw"><table><thead><tr><th>Producent</th><th class="r">Appellationer</th><th class="r">Marker</th><th class="r">Fl.</th></tr></thead><tbody>' + deep.map(function (p) { return '<tr class="click"' + U.act('producer', p.k, p.items) + '><td>' + e(p.k) + '</td><td class="r num">' + p.apps + '</td><td class="r num">' + p.vys + '</td><td class="r num">' + K.sum(p.items) + '</td></tr>'; }).join('') + '</tbody></table></div></div></div>';
  return '<div class="section" id="lab-overlap">' + panel('Producentoverlap og markdybde', body) + '</div>';
};

/* ================================================================ VINKORT */

P.vinkort = function () {
  const custom = A.route.items;
  const items = custom || A.view;
  const priv = ui('wl_priv', 'guest');
  const filtered = !custom && K.activeFilterCount() > 0;
  const scopeText = custom ? (A.route.title || 'Udvalgt udsnit') : filtered ? P.filterDesc() : 'Hele samlingen';
  let h = '<div class="noprint">' + head('Vinkort', 'Vintype › land og region › producent › vin, med antal flasker. Udskriv eller gem som PDF fra browseren.',
    '<button class="btn pri" data-act="print">Udskriv / gem som PDF</button>') + (A.src.mode === 'demo' ? '<div class="note" style="margin-bottom:12px">I forhåndsvisningen kan browseren ikke udskrive. Det virker i den installerede version.</div>' : '') +
    (custom ? '<div class="note" style="margin-bottom:12px">Vinkort over <b>' + e(scopeText) + '</b>. <button class="link" data-act="wl-clear">Vis hele samlingen</button></div>' :
      filtered ? '<div class="note" style="margin-bottom:12px">Vinkortet viser kun det, der passer til dine filtre: <b>' + e(scopeText) + '</b>. <button class="link" data-unf="#all">Nulstil filtrene</button> for hele samlingen.</div>' : '') +
    '<div class="toolbar">' + U.seg('wl_priv', [['guest', 'Til gæster'], ['private', 'Med pris og lokation']], priv) + '</div>' +
    (A.src.mode === 'sync' && !A.src.live ? '<div class="note warn">Synkroniseringen er ikke opdateret. Kortet er dannet fra sidste gyldige beholdning (' + K.date(A.src.status && A.src.status.lastSuccess, true) + ').</div>' : '') + '</div>';
  if (!items.length) return h + '<div class="empty">Der er ingen vine i det valgte udsnit, så der er intet vinkort at vise.</div>';
  h += P.wineList(items, { priv: priv === 'private', scope: scopeText });
  return h;
};
P.filterDesc = function () {
  const f = K.filters; const parts = [];
  Object.keys(f.dims).forEach(function (d) { const v = f.dims[d]; if (!v.vals.size) return; parts.push((v.mode === 'out' ? 'uden ' : '') + Array.from(v.vals).map(function (k) { return K.dimName(d, k); }).join(', ')); });
  if (f.vintage) parts.push('årgang ' + f.vintage.join('–'));
  if (f.price) parts.push('pris ' + K.n0(f.price[0]) + '–' + (f.price[1] > 1e8 ? '' : K.n0(f.price[1])) + ' €');
  return parts.join(' · ') || 'Hele samlingen';
};
P.wineList = function (items, opts) {
  const lines = new Map();
  items.forEach(function (i) {
    const k = i.w.id + '|' + i.ml;
    if (!lines.has(k)) lines.set(k, { w: i.w, ml: i.ml, qty: 0, price: i.price, locs: {} });
    const l = lines.get(k); l.qty += i.qty; if (i.loc) l.locs[i.loc] = (l.locs[i.loc] || 0) + i.qty;
  });
  const sec = new Map();
  lines.forEach(function (l) {
    const s = l.w.cls, c = l.w.countryDa, r = l.w.regionDa;
    if (!sec.has(s)) sec.set(s, new Map()); const cm = sec.get(s);
    if (!cm.has(c)) cm.set(c, new Map()); const rm = cm.get(c);
    if (!rm.has(r)) rm.set(r, []); rm.get(r).push(l);
  });
  const order = K.CLASS_ORDER.filter(function (s) { return sec.has(s); });
  const cmp = function (a, b) { return a.localeCompare(b, 'da'); };
  const total = items.reduce(function (a, i) { return a + i.qty; }, 0);
  const now = new Date();
  let h = '<article class="wl"><header class="wl-head"><div class="sub">Vinkort</div><h1>Kælderen</h1><div class="sub">' + e(opts.scope) + ' · ' + K.n0(total) + ' flasker · ' + now.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' }) + '</div></header>';
  h += '<nav class="wl-toc noprint">' + order.map(function (s) { return '<a href="#vinkort" data-act="wl-jump" data-to="wl-' + K.fold(s).replace(/[^a-z]/g, '') + '">' + e(K.CLASS_TITLE[s]) + '</a>'; }).join('') + '</nav>';
  order.forEach(function (s) {
    h += '<section class="wl-sec" id="wl-' + K.fold(s).replace(/[^a-z]/g, '') + '"><h2>' + e(K.CLASS_TITLE[s]) + '</h2><div class="orn">❦</div>';
    Array.from(sec.get(s).keys()).sort(cmp).forEach(function (c) {
      const rm = sec.get(s).get(c);
      Array.from(rm.keys()).sort(function (a, b) { return a === 'Ikke nærmere angivet' ? 1 : b === 'Ikke nærmere angivet' ? -1 : cmp(a, b); }).forEach(function (r) {
        h += '<div class="wl-reg"><h3>' + e(c) + (r === 'Ikke nærmere angivet' ? '' : ' <span>—</span> ' + e(r)) + '</h3>';
        const pm = new Map();
        rm.get(r).forEach(function (l) { if (!pm.has(l.w.producerRaw)) pm.set(l.w.producerRaw, []); pm.get(l.w.producerRaw).push(l); });
        Array.from(pm.keys()).sort(cmp).forEach(function (pn) {
          const ls = pm.get(pn).sort(function (a, b) { return (a.w.nv ? -1 : b.w.nv ? 1 : a.w.vintage - b.w.vintage) || cmp(a.w.label, b.w.label) || a.ml - b.ml; });
          h += '<div class="wl-prod"><h4>' + e(pn) + '</h4>' + ls.map(function (l) {
            const grape = l.w.varietal && l.w.varietal !== K.UNKNOWN ? l.w.varietal : l.w.master;
            return '<div class="wl-line' + (opts.priv ? ' priv' : '') + '"><span class="yr">' + (l.w.nv ? 'NV' : l.w.vintage) + '</span>' +
              '<span class="d">' + e(l.w.label) + (l.ml !== 750 ? '<span class="sz">' + K.sizeLabel(l.ml) + '</span>' : '') +
              (opts.priv && Object.keys(l.locs).length ? '<span class="lc">' + e(Object.keys(l.locs).map(function (k) { return k + ' ' + l.locs[k]; }).join(', ')) + '</span>' : '') + '</span>' +
              '<span class="g">' + e(grape === K.UNKNOWN ? '' : grape) + '</span>' +
              (opts.priv ? '<span class="pr">' + (l.price > 0 ? K.money(l.price) : '–') + '</span>' : '') +
              '<span class="q">' + l.qty + ' fl.</span></div>';
          }).join('') + '</div>';
        });
        h += '</div>';
      });
    });
    h += '</section>';
  });
  h += '<footer class="wl-foot">Beholdning pr. ' + (A.src.mode === 'sync' ? K.date(A.src.status && A.src.status.lastSuccess, true) : K.date(A.src.imported, true)) + ' · ' + lines.size + ' vine · ' + K.n0(total) + ' flasker</footer></article>';
  return h;
};

/* ================================================================ MAD OG VIN */

P.mad = function () {
  let h = head('Mad og vin', 'Beskriv retten eller menuen med dine egne ord. Forslagene vælges kun blandt vine i din kælder, som passer til de aktive filtre. Forslag er inspiration, ikke drikkeråd.');
  const s = K.settings();
  if (!s.syncUrl || !s.syncKey || A.src.mode !== 'sync') return h + '<div class="note">Mad og vin bruger en sprogmodel (Gemini eller Claude) via dit eget Apps Script. Sæt først synkroniseringen op under <a href="#data" data-nav="data">Data & synk</a>, og tilføj derefter en API-nøgle som scriptegenskab: <span class="mono">GEMINI_API_KEY</span> (gratis fra Google AI Studio) eller <span class="mono">ANTHROPIC_API_KEY</span> (Claude, betalt). Resten af dashboardet virker uden.</div>';
  if (!A.src.ai) return h + '<div class="note">Synkroniseringen kører, men der er ingen API-nøgle. Tilføj scriptegenskaben <span class="mono">GEMINI_API_KEY</span> (gratis) eller <span class="mono">ANTHROPIC_API_KEY</span> i dit Apps Script-projekt, og genindlæs siden.</div>';
  const chat = A.chat = A.chat || [];
  const n = U.wineRows(A.view).length;
  if (A.db.hasLoc) {
    const cur = K.filters.dims.location && K.filters.dims.location.mode === 'in' ? K.filters.dims.location.vals : new Set();
    const wkl = (K.settings().weekendLocations || []).filter(function (l) { return A.db.locations.indexOf(l) >= 0; });
    const wkOn = wkl.length && cur.size === wkl.length && wkl.every(function (l) { return cur.has(l); });
    h += '<div class="eyebrow" style="margin-bottom:6px">Hvor skal vinen komme fra?</div><div class="toolbar" style="gap:6px">' +
      '<button type="button" class="fbtn' + (cur.size ? '' : ' loc') + '" data-act="mad-loc" data-loc="*">Alle lokationer</button>' +
      (wkl.length ? '<button type="button" class="fbtn' + (wkOn ? ' loc' : '') + '" data-act="mad-loc" data-loc="#wk">Weekend</button>' : '') +
      A.db.locations.filter(Boolean).map(function (l) { return '<button type="button" class="fbtn' + (cur.has(l) ? ' loc' : '') + '" data-act="mad-loc" data-loc="' + e(l) + '" aria-pressed="' + cur.has(l) + '">' + e(l) + '</button>'; }).join('') + '</div>';
  }
  h += '<div class="note" style="margin-bottom:16px">Søger blandt <b>' + n + ' vinposter</b> (' + K.n0(K.sum(A.view)) + ' fl.) · ' + e(K.activeFilterCount() ? P.filterDesc() : 'hele samlingen') + (A.db.hasLoc ? '' : ' · lokation kendes ikke, så fysisk placering kan ikke garanteres') + '. Justér filtrene foroven for at afgrænse.</div>';
  h += '<div class="chat">' + chat.map(function (m) {
    if (m.role === 'user') return '<div class="msg u">' + e(m.text) + '</div>';
    if (m.error) return '<div class="note bad">' + e(m.error) + '</div>';
    return '<div class="msg">' + (m.note ? '<p>' + e(m.note) + '</p>' : '') + '<div class="grid" style="gap:10px">' + (m.picks || []).map(function (p) {
      const w = A.db.wines.get(p.id); if (!w) return '';
      return '<div class="pickc"><span class="role">' + e(p.role) + '</span><button class="link" style="text-align:left;font-weight:600" data-wine="' + e(w.id) + '">' + e(w.producerRaw + ' ' + w.label + ' ' + (w.nv ? 'NV' : w.vintage)) + '</button><span class="faint" style="font-size:.82rem">' + e(w.cls + ' · ' + w.master + ' · ' + w.regionDa) + ' · ' + p.qty + ' fl.' + (w.price ? ' · ' + K.money(w.price) : '') + '</span><span>' + e(p.why) + '</span>' + (p.caveat ? '<span class="muted" style="font-size:.86rem">Forbehold: ' + e(p.caveat) + '</span>' : '') + '</div>';
    }).join('') + '</div>' + (m.usage ? '<div class="faint" style="font-size:.75rem;margin-top:6px">' + e(m.usage.provider || '') + ' · ' + m.candidates + ' kandidater sendt · ' + K.n0(m.usage.input) + ' input- og ' + K.n0(m.usage.output) + ' output-tokens' + (m.rejected && m.rejected.length ? ' · ' + m.rejected.length + ' ugyldige forslag frasorteret' : '') + '</div>' : '') + '</div>';
  }).join('') + (A.chatBusy ? '<div class="muted">Sommelieren tænker …</div>' : '') + '</div>';
  h += '<div style="margin-top:18px;display:grid;gap:8px"><textarea id="mad-q" rows="3" placeholder="' + (chat.length ? 'Fx »Kun Jura«, »Hvad hvis jeg bruger rødvinssauce?«, »Kun vine jeg har mindst to af«' : 'Fx »Pighvar stegt på benet, beurre blanc med citron, grillede porrer og svampe. Gerne hvid fra Jura, ikke blandt de dyreste.«') + '"></textarea>' +
    '<div style="display:flex;gap:8px"><button class="btn pri" data-act="mad-send"' + (A.chatBusy ? ' disabled' : '') + '>' + (chat.length ? 'Send' : 'Find vin') + '</button>' + (chat.length ? '<button class="btn" data-act="mad-reset">Ny ret</button>' : '') + '</div></div>';
  return h;
};

/* ================================================================ DATA & SYNK */

P.data = function () {
  const s = K.settings(); const db = A.db;
  let h = head('Data & synkronisering', 'Du registrerer alt i CellarTracker. Dashboardet læser kun dine data og gemmer en dateret observation, hver gang beholdningen ændrer sig.');
  if (A.notice) h += '<div class="note warn" style="margin-bottom:16px">' + e(A.notice) + '</div>';
  // status
  const st = A.src.status || {};
  const lastLog = (A.log || [])[0];
  h += '<div class="grid g2">' + panel('Status', '<dl class="kv"><dt>Kilde</dt><dd>' + e({ sync: 'Automatisk synkronisering fra CellarTracker', local: 'Importeret fil i denne browser', demo: 'Forhåndsvisning (indlejret eksport)', none: 'Ingen data' }[A.src.mode]) + '</dd>' +
    (A.src.mode === 'sync' ? '<dt>Seneste vellykkede</dt><dd>' + K.date(st.lastSuccess, true) + (A.src.live ? '' : ' <span class="tag">ikke opdateret</span>') + '</dd><dt>Seneste forsøg</dt><dd>' + K.date(st.lastAttempt, true) + (lastLog && !lastLog.ok ? ' <span class="tag" style="color:var(--bad)">fejlede</span>' : '') + '</dd><dt>Næste</dt><dd>' + e(A.src.next || '') + '</dd>' : '') +
    (A.src.mode === 'local' ? '<dt>Importeret</dt><dd>' + K.date(A.src.imported, true) + '</dd>' : '') +
    '<dt>Beholdning</dt><dd>' + K.n0(K.sum(A.all)) + ' fl. · ' + db.wines.size + ' vine</dd><dt>Observationer</dt><dd>' + (A.history || []).length + (A.history && A.history.length ? ' (første ' + K.date(A.history[0].d) + ')' : '') + '</dd></dl>' +
    (A.src.mode === 'sync' ? '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" data-act="sync-now"' + (A.syncing ? ' disabled' : '') + '>' + (A.syncing ? 'Henter …' : 'Opdater nu') + '</button></div>' : '') +
    (A.syncMsg ? '<div class="note" style="margin-top:10px">' + e(A.syncMsg) + '</div>' : '') +
    (A.src.pendingList ? '<div class="note warn" style="margin-top:10px">En ny eksport med ' + (A.src.pendingList.info && A.src.pendingList.info.bottles) + ' fl. (mod ' + (A.src.pendingList.info && A.src.pendingList.info.previous) + ' fl.) venter på godkendelse, fordi faldet er usædvanligt stort. <button class="link" data-act="approve-pending">Godkend den</button></div>' : '')) +
    panel('Datakilder', P.sourceMatrix()) + '</div>';
  // staged import
  if (A.staged) h += '<div class="section">' + P.stagedView() + '</div>';
  // sync setup + upload
  h += '<div class="grid g2 section">' + panel('Automatisk synkronisering', '<p class="muted" style="margin-top:0">Et lille Google Apps Script i din egen Google-konto henter dine data fra CellarTracker hver nat og ved »Opdater nu«. Vejledningen står i <span class="mono">kaelder/README.md</span>; scriptet ligger i <span class="mono">kaelder/apps-script/Kaelder.gs</span>.</p>' +
    '<div style="display:grid;gap:8px"><label>Webapp-URL<br><input type="url" id="cfg-url" value="' + e(s.syncUrl) + '" placeholder="https://script.google.com/macros/s/…/exec" style="width:100%"></label>' +
    '<label>Nøgle<br><input type="password" id="cfg-key" value="' + e(s.syncKey) + '" placeholder="fra loggen efter setup" style="width:100%" autocomplete="off"></label>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" data-act="cfg-save">Gem og hent</button>' + (s.syncUrl ? '<button class="btn" data-act="cfg-clear">Afbryd synkronisering</button>' : '') + '</div>' +
    '<div class="faint" style="font-size:.78rem">URL og nøgle gemmes kun i denne browser. Brug samme værdier på mobilen.</div></div>') +
    panel('Importér filer manuelt', '<p class="muted" style="margin-top:0">Eksportér fra CellarTracker (My Cellar › Wines › Export › CSV) og vælg filen her. Du kan også vælge flere filer på én gang: Individual Bottles (lokation), Purchased (køb) og Consumed (forbrug). Filtypen genkendes automatisk.</p>' +
      (A.src.mode === 'sync' ? '<div class="note">Synkroniseringen er slået til, så filer herfra bruges ikke. Afbryd synkroniseringen for at bruge filer.</div>' :
        '<label class="btn"><input type="file" id="file-in" accept=".csv,text/csv" multiple hidden> Vælg CSV-filer …</label><div id="drop" style="margin-top:10px;border:1px dashed var(--line-2);border-radius:var(--r);padding:18px;text-align:center;color:var(--ink-3)">… eller slip filerne her</div>')) + '</div>';
  // settings
  h += '<div class="grid g2 section">' + panel('Indstillinger', '<div style="display:grid;gap:12px">' +
    '<div>Weekendlokationer<br>' + (db.hasLoc ? '<div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:4px">' + db.locations.filter(Boolean).map(function (l) { return '<label class="inl"><input type="checkbox" data-act="cfg-wk" value="' + e(l) + '"' + ((s.weekendLocations || []).indexOf(l) >= 0 ? ' checked' : '') + '> ' + e(l) + '</label>'; }).join('') + '</div><span class="faint" style="font-size:13px">Knappen »Weekendvine« i filterlinjen viser røde vine på de valgte lokationer.</span>' : '<span class="faint">Kræver lokationsdata fra CellarTracker (Individual Bottles).</span>') + '</div>' +
    '<label>Visningsvaluta<br>' + U.select('cfg-cur', [['EUR', 'EUR (kildens valuta)'], ['DKK', 'DKK']], s.currency, ' data-act="cfg-cur"') + (s.currency === 'DKK' ? ' kurs <input type="number" step="0.01" value="' + s.dkkRate + '" data-act="cfg-rate" style="width:90px"> kr. pr. € <span class="faint">(fast kurs du selv angiver)</span>' : '') + '</label>' +
    '</div>') +
    panel('Producentgrupper', P.aliasEditor(), { def: 'Rå navne fra CellarTracker samlet under ét gruppenavn i ranglister og analyser. Vinkortet bruger altid det oprindelige navn. Ingen automatiske sammenlægninger.' }) + '</div>';
  // log
  h += '<div class="section">' + panel('Importlog', (A.log || []).length ? '<div class="tw"><table><thead><tr><th>Tidspunkt</th><th>Resultat</th><th>Detaljer</th></tr></thead><tbody>' + A.log.slice(0, 20).map(function (l) {
    const t = l.tables ? Object.keys(l.tables).map(function (k) { const x = l.tables[k]; return k + ': ' + (x.error ? 'fejl' : x.rows + ' rækker'); }).join(' · ') : (l.files || []).map(function (f) { return f.table + ' (' + f.rows + ')'; }).join(' · ');
    return '<tr><td class="num">' + K.date(l.time, true) + '</td><td>' + (l.ok ? '<span style="color:var(--good)">OK</span>' : '<span style="color:var(--bad)">Fejl</span>') + (l.observation ? ' · ' + e(l.observation) : '') + '</td><td>' + e(t) + (l.error ? '<br><span style="color:var(--bad)">' + e(l.error) + '</span>' : '') + (l.warnings && l.warnings.length ? '<br><span class="muted">' + e(l.warnings.join(' ')) + '</span>' : '') + '</td></tr>';
  }).join('') + '</tbody></table></div>' : '<div class="faint">Ingen importer endnu.</div>') + '</div>';
  // backup + control
  h += '<div class="grid g2 section">' + panel('Sikkerhedskopi', '<p class="muted" style="margin-top:0">Gem alt, hvad denne browser har (filer, historik, grupper, indstillinger undtagen nøglen), og gendan det på en anden enhed.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="backup">Hent sikkerhedskopi</button><label class="btn"><input type="file" id="restore-in" accept=".json" hidden> Gendan …</label></div>') +
    panel('Kontroltal', P.controls()) + '</div>';
  return h;
};
P.sourceMatrix = function () {
  const db = A.db;
  const row = function (name, ok, txt, fn) { return '<tr><td>' + name + '</td><td>' + (ok ? '<span style="color:var(--good)">●</span> ' : '<span class="faint">○</span> ') + e(txt) + '</td><td class="muted">' + fn + '</td></tr>'; };
  return '<div class="tw"><table><thead><tr><th>CT-tabel</th><th>Status</th><th>Gør muligt</th></tr></thead><tbody>' +
    row('List (beholdning)', !!db.tables.List, db.tables.List ? db.tables.List + ' rækker' : 'mangler', 'Alt grundlæggende') +
    row('Inventory (flasker)', db.bottleLevel, db.bottleLevel ? db.tables.Inventory + ' flasker' : db.tables.Inventory ? 'indlæst, men stemmer ikke' : 'ikke indlæst', 'Lokation, bin, weekendvine') +
    row('Purchase (køb)', db.hasPurchases, db.hasPurchases ? db.purchases.length + ' køb' : 'ikke indlæst', 'Købshistorik og forhandlere') +
    row('Consumed (afgang)', db.hasConsumed, db.hasConsumed ? db.consumed.length + ' hændelser' : 'ikke indlæst', 'Forbrug, køb mod drukket') +
    row('Notes (smagninger)', db.notes.length > 0, db.notes.length ? db.notes.length + ' scores' : 'ingen scores', 'Egne scores (senere)') +
    '</tbody></table></div>' + (db.warnings.length ? '<div class="note warn" style="margin-top:10px">' + e(db.warnings.join(' ')) + '</div>' : '') +
    (db.hasLoc ? '' : '<div class="faint" style="font-size:.78rem;margin-top:8px">Lokationsfilteret er skjult, indtil lokationer findes i data. Der gættes ikke på placeringer.</div>');
};
P.stagedView = function () {
  const s = A.staged;
  let b = '';
  if (s.files.length) b += '<p>Genkendte filer: ' + s.files.map(function (f) { return '<b>' + e(f.name) + '</b> (' + f.table + ', ' + f.rows + ' rækker, ' + f.cols + ' kolonner)'; }).join(', ') + '</p>';
  if (s.errors.length) b += '<div class="note bad">' + s.errors.map(e).join('<br>') + '</div>';
  if (s.summary) {
    b += '<dl class="kv" style="margin:12px 0"><dt>Flasker</dt><dd class="num">' + K.n0(s.summary.bottles) + (s.prev ? ' (før: ' + K.n0(s.prev.bottles) + ')' : '') + '</dd><dt>Unikke vine</dt><dd class="num">' + s.summary.wines + '</dd><dt>Indkøbsværdi</dt><dd class="num">' + K.money(s.summary.value, 2) + '</dd><dt>Uden pris</dt><dd class="num">' + s.summary.zero + ' fl.</dd>' +
      (s.prev ? '<dt>Observeret ændring</dt><dd>+' + s.diff.up + ' / −' + s.diff.down + ' fl. · ' + s.diff.added + ' nye vine · ' + s.diff.gone + ' udgået <span class="faint">(nettoændring, ikke køb/forbrug)</span></dd>' : '') + '</dl>';
    if (s.warnings.length) b += '<div class="note warn">' + s.warnings.map(e).join('<br>') + '</div>';
    b += '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn pri" data-act="import-ok">Godkend import</button><button class="btn" data-act="import-cancel">Annullér</button></div>';
  } else b += '<button class="btn" data-act="import-cancel">Luk</button>';
  return panel('Kontrollér importen før den erstatter beholdningen', b);
};
P.aliasEditor = function () {
  const al = K.aliases();
  const raws = Array.from(new Set(A.all.map(function (i) { return i.w.producerRaw; }))).sort(function (a, b) { return a.localeCompare(b, 'da'); });
  return '<div class="tw" style="margin-bottom:10px"><table><thead><tr><th>Rå navn</th><th>Gruppe</th><th></th></tr></thead><tbody>' + Object.keys(al).map(function (k) { return '<tr><td>' + e(k) + '</td><td><b>' + e(al[k]) + '</b></td><td class="r"><button class="link" data-act="alias-del" data-k="' + e(k) + '">fjern</button></td></tr>'; }).join('') + '</tbody></table></div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap"><select id="al-raw" style="max-width:220px">' + raws.map(function (r) { return '<option>' + e(r) + '</option>'; }).join('') + '</select><input type="text" id="al-grp" placeholder="Gruppenavn" style="width:150px"><button class="btn sm" data-act="alias-add">Tilføj</button></div>';
};
P.controls = function () {
  const it = A.all; const s = K.stats(it);
  const halves = K.sum(it.filter(function (i) { return i.ml !== 750; }));
  const per = Array.from(K.group(it, function (i) { return i.w.id; }).values());
  return '<dl class="kv"><dt>Flasker (Quantity)</dt><dd class="num">' + s.bottles + '</dd><dt>Unikke iWine</dt><dd class="num">' + s.wines + '</dd><dt>Rå producentnavne / grupper</dt><dd class="num">' + K.group(it, 'producerRaw').size + ' / ' + s.producers + '</dd>' +
    '<dt>Lande / regioner</dt><dd class="num">' + s.countries + ' / ' + s.regions + '</dd><dt>Indkøbsværdi</dt><dd class="num">' + K.n2(s.value) + ' EUR</dd><dt>Med pris / nulpris</dt><dd class="num">' + s.priced + ' / ' + s.zero + '</dd>' +
    '<dt>Gns. pris (kendte)</dt><dd class="num">' + K.n2(s.avg) + ' EUR</dd><dt>Andre formater end 75 cl</dt><dd class="num">' + halves + '</dd><dt>Volumen</dt><dd class="num">' + K.n2(K.MEASURES.liters.fn(it)) + ' l</dd>' +
    '<dt>Vinposter med 1 / ≥2 fl.</dt><dd class="num">' + per.filter(function (x) { return K.sum(x) === 1; }).length + ' / ' + per.filter(function (x) { return K.sum(x) > 1; }).length + '</dd></dl>';
};

/* ================================================================ handlinger */

P.act = function (act, t, ev) {
  const s = K.settings();
  switch (act) {
    case 'back': A.goBack(); break;
    case 'tg': t.closest('tbody').classList.toggle('open'); break;
    case 'tg-all': { const tw = t.closest('.toolbar').nextElementSibling; tw.querySelectorAll('tbody.grp').forEach(function (b) { b.classList.toggle('open', t.dataset.open === '1'); }); } break;
    case 'jump': ev.preventDefault(); { const el = document.getElementById(t.dataset.to); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } break;
    case 'wl-jump': ev.preventDefault(); { const el = document.getElementById(t.dataset.to); if (el) el.scrollIntoView({ behavior: 'smooth' }); } break;
    case 'prof-filter': A.addFilter(A.route.dim, A.route.key); A.go(A.profileSection() || 'overblik'); break;
    case 'prof-wl': { const g = K.DIMS[A.route.dim].get; A.go('vinkort', { items: A.view.filter(function (i) { return g(i) === A.route.key; }), title: K.dimName(A.route.dim, A.route.key) }); } break;
    case 'csv-view': A.downloadCSV(A.view); break;
    case 'wl-view': A.go('vinkort'); break;
    case 'wl-clear': A.route = { page: 'vinkort' }; A.render(); break;
    case 'print': window.print(); break;
    case 'cmp': {
      const ns = t.dataset.ns; const boxes = document.querySelectorAll('[data-act="cmp"][data-ns="' + ns + '"]');
      const vals = []; boxes.forEach(function (b) { if (b.checked) vals.push(b.value); });
      A.ui[ns + '_cs'] = vals.slice(0, 4).join('\u0001'); A.render(); break;
    }
    case 'vu-cut': A.ui.vu_cut = t.value; A.render(); break;
    case 'sync-now': A.syncNow(); break;
    case 'approve-pending': fetch(s.syncUrl + '?action=approve&key=' + encodeURIComponent(s.syncKey)).then(function (r) { return r.json(); }).then(function (p) { if (p.ok) { K.store.set('lastPayload', p); A.usePayload(p, true); A.syncMsg = 'Eksporten er godkendt.'; } A.render(); }); break;
    case 'cfg-save': {
      const url = document.getElementById('cfg-url').value.trim(), key = document.getElementById('cfg-key').value.trim();
      if (url && !/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { A.syncMsg = 'URL\'en skal være din Apps Script-webapp (https://script.google.com/macros/s/…/exec).'; A.render(); break; }
      K.saveSettings({ syncUrl: url, syncKey: key }); A.syncMsg = '';
      A.load().then(function () { A.refresh(); }); break;
    }
    case 'cfg-clear': K.saveSettings({ syncUrl: '', syncKey: '' }); K.store.del('lastPayload'); A.load().then(function () { A.refresh(); }); break;
    case 'cfg-wk': { const v = []; document.querySelectorAll('[data-act="cfg-wk"]').forEach(function (b) { if (b.checked) v.push(b.value); }); K.saveSettings({ weekendLocations: v }); if (s.syncUrl) A.post({ action: 'settings', settings: { weekendLocations: v } }).catch(function () { }); A.renderFilters(); } break;
    case 'mad-loc': { const l = t.dataset.loc; const cur = K.filters.dims.location; const vals = cur && cur.mode === 'in' ? new Set(cur.vals) : new Set(); if (l === '*') vals.clear(); else if (l === '#wk') { vals.clear(); (K.settings().weekendLocations || []).forEach(function (x) { if (A.db.locations.indexOf(x) >= 0) vals.add(x); }); } else if (vals.has(l)) vals.delete(l); else vals.add(l); A.setFilter('location', vals, 'in'); } break;
    case 'cfg-cur': K.saveSettings({ currency: t.value }); A.refresh(); break;
    case 'cfg-rate': K.saveSettings({ dkkRate: +t.value || 7.46 }); A.refresh(); break;
    case 'alias-add': case 'alias-del': {
      const al = K.aliases();
      if (act === 'alias-add') { const r = document.getElementById('al-raw').value, g = document.getElementById('al-grp').value.trim(); if (!g) return; al[r] = g; }
      else delete al[t.dataset.k];
      K.store.set('aliases', al);
      if (s.syncUrl) A.post({ action: 'aliases', aliases: al }).catch(function () { });
      A.load().then(function () { A.refresh(); }); break;
    }
    case 'import-ok': A.approveImport(); break;
    case 'import-cancel': A.staged = null; A.render(); break;
    case 'backup': {
      const o = { app: 'min-kaelder', time: new Date().toISOString(), tables: K.store.get('tables', null), history: K.store.get('history', []), catalog: K.store.get('catalog', {}), aliases: K.store.get('aliases', null), log: K.store.get('log', []), settings: Object.assign({}, K.settings(), { syncKey: '' }) };
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(o)], { type: 'application/json' })); a.download = 'min-kaelder-backup-' + o.time.slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove(); break;
    }
    case 'mad-send': P.madSend(); break;
    case 'pr-tog': { const key = 'pr_sel_' + t.dataset.dim; const cur = (A.ui[key] || []).slice(); const k = t.dataset.k; const i = cur.indexOf(k); if (i >= 0) cur.splice(i, 1); else cur.push(k); A.ui[key] = cur; A.render(); } break;
    case 'mad-reset': A.chat = []; A.render(); break;
  }
};
P.madSend = async function () {
  const q = document.getElementById('mad-q').value.trim(); if (!q || A.chatBusy) return;
  A.chat.push({ role: 'user', text: q });
  const rows = U.wineRows(A.view); const ids = Array.from(new Set(rows.map(function (r) { return r.w.id; })));
  const qty = {}; rows.forEach(function (r) { qty[r.w.id] = (qty[r.w.id] || 0) + r.qty; });
  const history = A.chat.slice(0, -1).map(function (m) { return m.role === 'user' ? { role: 'user', text: m.text } : { role: 'assistant', text: JSON.stringify({ picks: (m.picks || []).map(function (p) { return p.id; }), note: m.note }) }; });
  const dish = A.chat.filter(function (m) { return m.role === 'user'; }).map(function (m) { return m.text; }).join('\n\nOpfølgning: ');
  A.chatBusy = true; A.render();
  try {
    const r = await A.post({ action: 'pair', dish: dish, ids: ids, qty: A.db.hasLoc ? qty : null, history: history.length > 6 ? history.slice(-6) : [] });
    if (!r.ok) A.chat.push({ role: 'assistant', error: r.error });
    else {
      // dobbelttjek mod det lokale udsnit
      r.picks = (r.picks || []).filter(function (p) { return qty[p.id] > 0; }).map(function (p) { p.qty = Math.min(p.qty, qty[p.id]); return p; });
      A.chat.push(Object.assign({ role: 'assistant' }, r));
    }
  } catch (err) { A.chat.push({ role: 'assistant', error: 'Kunne ikke kontakte AI-tjenesten: ' + (err.message || err) + '. Dashboardet virker fortsat uden.' }); }
  A.chatBusy = false; A.render();
};

/* efter hver visning: input-felter, der ikke skal gen-tegne hele siden */
P.after = function () {
  const q = document.getElementById('samling-q');
  if (q) { q.addEventListener('input', function () { A.ui.q = q.value; U.resetReg(); document.getElementById('samling-tbl').innerHTML = P.samlingTable(); }); }
  const pq = document.getElementById('pr-q');
  if (pq) { pq.addEventListener('change', function () { A.ui.pr_q = pq.value; A.render(); }); }
  const fi = document.getElementById('file-in');
  if (fi) fi.addEventListener('change', function () { if (fi.files.length) A.stageFiles(Array.from(fi.files)); });
  const drop = document.getElementById('drop');
  if (drop) {
    drop.addEventListener('dragover', function (ev) { ev.preventDefault(); drop.style.borderColor = 'var(--accent)'; });
    drop.addEventListener('dragleave', function () { drop.style.borderColor = ''; });
    drop.addEventListener('drop', function (ev) { ev.preventDefault(); if (ev.dataTransfer.files.length) A.stageFiles(Array.from(ev.dataTransfer.files)); });
  }
  const ri = document.getElementById('restore-in');
  if (ri) ri.addEventListener('change', async function () {
    try {
      const o = JSON.parse(await ri.files[0].text()); if (o.app !== 'min-kaelder') throw new Error('ikke en sikkerhedskopi fra Min kælder');
      if (o.tables) K.store.set('tables', o.tables); K.store.set('history', o.history || []); K.store.set('catalog', o.catalog || {}); if (o.aliases) K.store.set('aliases', o.aliases); K.store.set('log', o.log || []);
      if (o.settings) { const keep = K.settings().syncKey; K.saveSettings(Object.assign(o.settings, { syncKey: keep })); }
      await A.load(); A.refresh();
    } catch (err) { A.notice = 'Gendannelsen fejlede: ' + err.message; A.render(); }
  });
};
