/* Min kælder — små byggeklodser: søjler, stakke, linjer, heatmaps, tabeller. */
'use strict';

const U = window.U = {};
const esc = K.esc;

/* Registrér et udsnit af flasker, så et klik kan vise præcis dem. */
U._reg = []; U.reg = function (items, title) { U._reg.push({ items: items, title: title }); return U._reg.length - 1; };
U.resetReg = function () { U._reg = []; };

const PALETTE = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7', '--s8'];
const FIXED = {
  color: { Hvid: '--c-hvid', Rød: '--c-rod', Orange: '--c-orange', Rosé: '--c-rose' },
  cls: { Mousserende: '--c-mouss', Hvid: '--c-hvid', 'Hvid, off-dry': '--c-offdry', Orange: '--c-orange', Rosé: '--c-rose', Rød: '--c-rod', Sød: '--c-sweet', Hedvin: '--c-fort', Øvrige: '--c-other' }
};
U.color = function (dim, key, i) {
  const f = FIXED[dim] && FIXED[dim][key];
  return 'var(' + (f || PALETTE[i % PALETTE.length]) + ')';
};
U.series = function (i) { return 'var(' + PALETTE[i % PALETTE.length] + ')'; };

/* Attributter til klik: åbn profil / filtrér / vis flasker */
U.act = function (dim, key, items, title) {
  const prof = U.PROFILE_DIMS.indexOf(dim) >= 0;
  return ' data-dim="' + esc(dim) + '" data-key="' + esc(key) + '"' + (items ? ' data-reg="' + U.reg(items, title) + '"' : '') + (prof ? ' data-prof="1"' : '');
};
U.PROFILE_DIMS = ['country', 'region', 'subregion', 'appellation', 'producer', 'grape', 'color', 'cls', 'vintage', 'location', 'store', 'varietal', 'producerRaw', 'vineyard'];

U.tipAttr = function (s) { return ' data-tip="' + esc(s) + '"'; };

U.kpis = function (list) {
  return '<div class="kpis">' + list.map(function (k) {
    return '<div class="kpi"' + (k.tip ? U.tipAttr(k.tip) : '') + '><div class="v">' + k.v + '</div><div class="l">' + esc(k.l) + '</div>' + (k.s ? '<div class="s">' + k.s + '</div>' : '') + '</div>';
  }).join('') + '</div>';
};

U.seg = function (name, options, current) {
  return '<div class="seg" role="group">' + options.map(function (o) {
    return '<button type="button" data-seg="' + esc(name) + '" data-val="' + esc(o[0]) + '" class="' + (o[0] === current ? 'on' : '') + '" aria-pressed="' + (o[0] === current) + '">' + esc(o[1]) + '</button>';
  }).join('') + '</div>';
};
U.measureSeg = function (name, current, list) {
  list = list || ['bottles', 'wines', 'value', 'share'];
  const lbl = { bottles: 'Flasker', wines: 'Vine', value: 'Værdi', share: '%', avgPrice: 'Gns. pris', liters: 'Liter' };
  return U.seg(name, list.map(function (m) { return [m, lbl[m]]; }), current);
};
U.select = function (name, options, current, attrs) {
  return '<select data-sel="' + esc(name) + '"' + (attrs || '') + '>' + options.map(function (o) {
    return '<option value="' + esc(o[0]) + '"' + (o[0] === current ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
  }).join('') + '</select>';
};
U.dimOptions = function (db, extra) {
  return (extra || []).concat(K.dimsAvailable(db).map(function (k) { return [k, K.DIMS[k].label]; }));
};

/* Værdi og visning ud fra måling, hvor "share" er andel af flasker i udsnittet. */
U.mval = function (items, measure, total) {
  if (measure === 'share') return K.sum(items) / (total || 1);
  return K.MEASURES[measure].fn(items);
};
U.mfmt = function (v, measure) {
  if (measure === 'share') return K.pct(v);
  return K.MEASURES[measure].fmt(v);
};

/**
 * Vandrette søjler. rank: resultat af K.rank (bruges kun til grupperne).
 * opts: {dim, measure, total, top, title}
 */
U.bars = function (items, dim, opts) {
  opts = opts || {};
  const measure = opts.measure || 'bottles';
  const total = K.sum(items);
  const rows = Array.from(K.group(items, dim)).map(function (e) {
    return { key: e[0], name: K.dimName(dim, e[0]), items: e[1], v: U.mval(e[1], measure, total), b: K.sum(e[1]) };
  });
  const d = K.DIMS[dim];
  if (opts.natural && d.order) rows.sort(function (a, b) { return d.order.indexOf(a.key) - d.order.indexOf(b.key); });
  else rows.sort(function (a, b) { return b.v - a.v || b.b - a.b || String(a.name).localeCompare(String(b.name), 'da'); });
  if (!rows.length) return '<div class="empty">Ingen flasker i udsnittet.</div>';
  const top = opts.top || 10;
  const max = Math.max.apply(null, rows.map(function (r) { return r.v; })) || 1;
  const bar = function (r, i) {
    const tip = r.name + ' · ' + K.n0(r.b) + ' fl. · ' + K.pct(r.b / (total || 1)) + ' af ' + K.n0(total) + ' fl. · ' + K.money(K.value(r.items));
    return '<button type="button" class="bar"' + U.act(dim, r.key, r.items, K.DIMS[dim].label + ': ' + r.name) + U.tipAttr(tip) + '>' +
      '<span class="nm">' + esc(r.name) + '</span><span class="tr"><span class="fl" style="width:' + (100 * r.v / max).toFixed(2) + '%;background:' + U.color(dim, r.key, opts.colorAll ? i : 0) + '"></span></span>' +
      '<span class="vl">' + U.mfmt(r.v, measure) + '</span></button>';
  };
  let html = '<div class="bars">' + rows.slice(0, top).map(bar).join('') + '</div>';
  if (rows.length > top) {
    const rest = rows.slice(top);
    const restItems = [].concat.apply([], rest.map(function (r) { return r.items; }));
    html += '<details class="more-d"><summary class="more"><span class="link">Vis alle ' + rows.length + '</span><span class="faint">Øvrige ' + rest.length + ': ' + U.mfmt(U.mval(restItems, measure, total), measure) + '</span></summary><div class="bars" style="margin-top:4px">' + rest.map(function (r, i) { return bar(r, i + top); }).join('') + '</div></details>';
  }
  return html;
};

/** 100 %-stak med forklaring. */
U.stack = function (items, dim, opts) {
  opts = opts || {};
  const total = K.sum(items) || 1;
  const r = K.rank(items, dim, 'bottles', { natural: !!K.DIMS[dim].order });
  const seg = r.map(function (x, i) {
    return '<button type="button" style="flex:' + x.v + ';background:' + U.color(dim, x.key, i) + '"' + U.act(dim, x.key, x.items, K.DIMS[dim].label + ': ' + x.name) +
      U.tipAttr(x.name + ': ' + K.n0(x.v) + ' fl. (' + K.pct(x.v / total) + ')') + ' aria-label="' + esc(x.name) + '"></button>';
  }).join('');
  const leg = r.map(function (x, i) {
    return '<button type="button"' + U.act(dim, x.key, x.items, K.DIMS[dim].label + ': ' + x.name) + '><span class="sw" style="background:' + U.color(dim, x.key, i) + '"></span>' + esc(x.name) + ' <span class="num faint">' + K.n0(x.v) + ' · ' + K.pct(x.v / total) + '</span></button>';
  }).join('');
  return '<div class="stack">' + seg + '</div><div class="legend">' + leg + '</div>';
};

/* ---------------------------------------------------------------- SVG */

const niceMax = function (v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};
U.niceMax = niceMax;

/** Lodrette søjler, fx årgange. cols: [{label, v, act, tip, color}] */
U.columns = function (cols, opts) {
  opts = opts || {};
  const W = Math.max(320, cols.length * 34 + 50), H = opts.h || 200, L = 36, B = 26, T = 10;
  const max = niceMax(Math.max.apply(null, cols.map(function (c) { return c.v; }).concat([1])));
  const bw = (W - L - 6) / cols.length;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="min-width:' + Math.min(W, 520) + 'px;max-height:' + (H * 1.6) + 'px" role="img" aria-label="' + esc(opts.label || 'Søjlediagram') + '">';
  for (let g = 0; g <= 4; g++) {
    const y = T + (H - T - B) * (1 - g / 4);
    s += '<line class="gr" x1="' + L + '" x2="' + W + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10">' + (opts.fmt ? opts.fmt(max * g / 4) : K.n0(max * g / 4)) + '</text>';
  }
  cols.forEach(function (c, i) {
    const h = (H - T - B) * c.v / max; const x = L + 3 + i * bw;
    s += '<g ' + (c.act || '') + ' style="cursor:pointer"' + U.tipAttr(c.tip || (c.label + ': ' + c.v)) + '><rect x="' + x + '" y="' + T + '" width="' + (bw - 3) + '" height="' + (H - T - B) + '" fill="transparent"/>' +
      '<rect x="' + x + '" y="' + (H - B - h) + '" width="' + Math.max(1, bw - 3) + '" height="' + h + '" rx="1.5" fill="' + (c.color || 'var(--accent)') + '"/>' +
      (c.v ? '<text x="' + (x + (bw - 3) / 2) + '" y="' + (H - B - h - 3) + '" text-anchor="middle" font-size="9.5">' + (opts.fmt ? '' : K.n0(c.v)) + '</text>' : '') +
      '<text x="' + (x + (bw - 3) / 2) + '" y="' + (H - 9) + '" text-anchor="middle" font-size="10">' + esc(c.label) + '</text></g>';
  });
  return '<div class="chart">' + s + '</svg></div>';
};

/** Årgangshistogram med NV separat. */
U.vintages = function (items, opts) {
  opts = opts || {};
  const g = K.group(items, 'vintage');
  const ys = Array.from(g.keys()).filter(function (k) { return k !== 'NV'; }).map(Number).sort(function (a, b) { return a - b; });
  if (!ys.length && !g.has('NV')) return '<div class="empty">Ingen flasker i udsnittet.</div>';
  const cols = [];
  if (g.has('NV')) cols.push({ key: 'NV' });
  if (ys.length) for (let y = ys[0]; y <= ys[ys.length - 1]; y++) cols.push({ key: String(y) });
  const M = opts.measure || 'bottles';
  return U.columns(cols.map(function (c) {
    const it = g.get(c.key) || [];
    const v = M === 'value' ? K.value(it) : K.sum(it);
    return { label: c.key === 'NV' ? 'NV' : "'" + c.key.slice(2), v: v, act: it.length ? U.act('vintage', c.key, it, 'Årgang ' + c.key) : '',
      tip: (c.key === 'NV' ? 'Uden årgang (NV)' : 'Årgang ' + c.key) + ': ' + K.n0(K.sum(it)) + ' fl. · ' + K.money(K.value(it)), color: c.key === 'NV' ? 'var(--ink-3)' : 'var(--accent)' };
  }), { label: 'Årgange', fmt: M === 'value' ? function (v) { return K.n0(v); } : null });
};

/**
 * Linjediagram. xs: ['2021', ...]; series: [{name, color, ys:[v|null], tips:[]}]
 */
U.lines = function (xs, series, opts) {
  opts = opts || {};
  const W = Math.max(560, xs.length * 46 + 120), H = opts.h || 260, L = 50, R = 120, T = 12, B = 28;
  const all = [].concat.apply([], series.map(function (s) { return s.ys.filter(function (v) { return v !== null && v !== undefined; }); }));
  const max = opts.max || niceMax(Math.max.apply(null, all.concat([opts.pct ? 0.05 : 1])));
  const X = function (i) { return L + (xs.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (xs.length - 1)); };
  const Y = function (v) { return opts.invert ? T + (H - T - B) * (v - 1) / Math.max(1, max - 1) : T + (H - T - B) * (1 - v / max); };
  const fmt = opts.fmt || function (v) { return opts.pct ? K.n0(v * 100) + ' %' : K.n0(v); };
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="min-width:' + Math.min(W, 560) + 'px;max-height:' + (H * 1.5) + 'px" role="img" aria-label="' + esc(opts.label || 'Linjediagram') + '">';
  const lead = max / Math.pow(10, Math.floor(Math.log10(max)));
  const N = opts.invert ? 4 : (Math.abs(lead - 2.5) < 1e-9 || Math.abs(lead - 5) < 1e-9 ? 5 : 4);
  for (let g = 0; g <= N; g++) {
    const v = opts.invert ? 1 + (max - 1) * g / N : max * g / N; const y = Y(v);
    s += '<line class="gr" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10">' + (opts.invert ? '#' + Math.round(v) : fmt(v)) + '</text>';
  }
  xs.forEach(function (x, i) { s += '<text x="' + X(i) + '" y="' + (H - 9) + '" text-anchor="middle" font-size="10">' + esc(x) + '</text>'; });
  const labels = [];
  series.forEach(function (se) {
    let d = '', pen = false;
    se.ys.forEach(function (v, i) {
      if (v === null || v === undefined) { pen = false; return; }
      d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true;
    });
    s += '<path d="' + d + '" fill="none" stroke="' + se.color + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>';
    se.ys.forEach(function (v, i) {
      if (v === null || v === undefined) return;
      s += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="3.6" fill="' + se.color + '" stroke="var(--paper)" stroke-width="1.5"' + U.tipAttr(se.name + ' · ' + xs[i] + ': ' + (se.tips && se.tips[i] || fmt(v))) + (se.acts && se.acts[i] ? se.acts[i] : '') + ' style="cursor:pointer"/>';
    });
    let li = se.ys.length - 1; while (li >= 0 && (se.ys[li] === null || se.ys[li] === undefined)) li--;
    if (li >= 0) labels.push({ y: Y(se.ys[li]), x: X(li), name: se.name, color: se.color });
  });
  labels.sort(function (a, b) { return a.y - b.y; });
  for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 12) labels[i].y = labels[i - 1].y + 12;
  labels.forEach(function (l) { s += '<text x="' + (W - R + 8) + '" y="' + (l.y + 4) + '" font-size="11" style="fill:' + l.color + '">' + esc(String(l.name).slice(0, 18)) + '</text>'; });
  return '<div class="chart">' + s + '</svg></div>';
};

/** 100 %-stablede søjler pr. periode. groups: [{x, parts:[{key,name,v,act}]}] */
U.stackCols = function (groups, keys, opts) {
  opts = opts || {};
  const W = Math.max(480, groups.length * 46 + 60), H = 230, L = 40, T = 10, B = 26;
  const bw = (W - L - 6) / Math.max(1, groups.length);
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="min-width:' + Math.min(W, 480) + 'px;max-height:' + (H * 1.5) + 'px" role="img" aria-label="Andel pr. periode">';
  [0, .25, .5, .75, 1].forEach(function (g) { const y = T + (H - T - B) * (1 - g); s += '<line class="gr" x1="' + L + '" x2="' + W + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10">' + (g * 100) + ' %</text>'; });
  groups.forEach(function (gr, i) {
    const tot = gr.parts.reduce(function (a, p) { return a + p.v; }, 0); const x = L + 3 + i * bw; let y = H - B;
    if (tot) keys.forEach(function (k, ki) {
      const p = gr.parts.find(function (pp) { return pp.key === k; }); if (!p || !p.v) return;
      const h = (H - T - B) * p.v / tot; y -= h;
      s += '<rect x="' + x + '" y="' + y + '" width="' + (bw - 4) + '" height="' + h + '" fill="' + (opts.color ? opts.color(k, ki) : U.series(ki)) + '"' + U.tipAttr(gr.x + ' · ' + p.name + ': ' + K.n0(p.v) + ' (' + K.pct(p.v / tot) + ')') + (p.act || '') + ' style="cursor:pointer"/>';
    });
    s += '<text x="' + (x + (bw - 4) / 2) + '" y="' + (H - 9) + '" text-anchor="middle" font-size="10">' + esc(gr.x) + '</text>';
  });
  return '<div class="chart">' + s + '</svg></div>';
};

/**
 * Heatmap/krydstabel. mode: abs | row | col | total
 */
U.heat = function (items, rdim, cdim, opts) {
  opts = opts || {};
  const measure = opts.measure || 'bottles';
  const mode = opts.mode || 'abs';
  const rr = K.rank(items, rdim, measure === 'avgPrice' ? 'bottles' : measure, { natural: !!K.DIMS[rdim].order || K.DIMS[rdim].numeric });
  const cc = K.rank(items, cdim, measure === 'avgPrice' ? 'bottles' : measure, { natural: !!K.DIMS[cdim].order || K.DIMS[cdim].numeric });
  const rN = opts.topR || 15, cN = opts.topC || 10;
  const rows = rr.slice(0, rN), cols = cc.slice(0, cN);
  const rOther = rr.length > rN, cOther = cc.length > cN;
  const rset = new Set(rows.map(function (r) { return r.key; })), cset = new Set(cols.map(function (c) { return c.key; }));
  const rg = K.DIMS[rdim].get, cg = K.DIMS[cdim].get;
  const cell = {}; const rowT = {}, colT = {}; let grand = [];
  items.forEach(function (i) {
    const r = rset.has(rg(i)) ? rg(i) : '…', c = cset.has(cg(i)) ? cg(i) : '…';
    const k = r + '\u0000' + c; (cell[k] = cell[k] || []).push(i);
    (rowT[r] = rowT[r] || []).push(i); (colT[c] = colT[c] || []).push(i); grand.push(i);
  });
  const M = function (it) { return it && it.length ? U.mval(it, measure === 'share' ? 'bottles' : measure, 1) : 0; };
  const rkeys = rows.map(function (r) { return r.key; }).concat(rOther ? ['…'] : []);
  const ckeys = cols.map(function (c) { return c.key; }).concat(cOther ? ['…'] : []);
  let max = 0; const vals = {};
  rkeys.forEach(function (r) { ckeys.forEach(function (c) {
    const it = cell[r + '\u0000' + c]; let v = M(it);
    if (mode === 'row') v = v / (M(rowT[r]) || 1); else if (mode === 'col') v = v / (M(colT[c]) || 1); else if (mode === 'total') v = v / (M(grand) || 1);
    vals[r + '\u0000' + c] = v; if (r !== '…' && c !== '…') max = Math.max(max, v);
  }); });
  const fmt = function (v) { return mode === 'abs' ? (measure === 'value' || measure === 'avgPrice' ? K.n0(v) : K.n0(v)) : K.n0(v * 100) + '%'; };
  const nm = function (dim, k) { return k === '…' ? 'Øvrige' : K.dimName(dim, k); };
  let h = '<div class="tw hm"><table><thead><tr><th class="rowh">' + esc(K.DIMS[rdim].label) + ' \\ ' + esc(K.DIMS[cdim].label) + '</th>' +
    ckeys.map(function (c) { return '<th class="r">' + esc(nm(cdim, c)) + '</th>'; }).join('') + '<th class="r">I alt</th></tr></thead><tbody>';
  rkeys.forEach(function (r) {
    h += '<tr><td class="rowh">' + (r === '…' ? 'Øvrige' : '<button class="link" type="button"' + U.act(rdim, r, rowT[r], K.DIMS[rdim].label + ': ' + nm(rdim, r)) + '>' + esc(nm(rdim, r)) + '</button>') + '</td>';
    ckeys.forEach(function (c) {
      const it = cell[r + '\u0000' + c]; const v = vals[r + '\u0000' + c];
      if (!it || !it.length) { h += '<td class="c z">·</td>'; return; }
      const a = max ? Math.min(1, v / max) : 0;
      const title = nm(rdim, r) + ' × ' + nm(cdim, c);
      h += '<td class="c" data-reg="' + U.reg(it, title) + '" style="background:color-mix(in srgb, var(--accent) ' + Math.round(a * 70) + '%, transparent);' + (a > .55 ? 'color:var(--paper)' : '') + '"' +
        U.tipAttr(title + ': ' + K.n0(K.sum(it)) + ' fl. · ' + K.money(K.value(it)) + (mode !== 'abs' ? ' · ' + K.pct(v) + (mode === 'row' ? ' af rækken' : mode === 'col' ? ' af kolonnen' : ' af alt') : '')) + '>' + fmt(v) + '</td>';
    });
    h += '<td class="c r" style="font-weight:600">' + (mode === 'abs' ? fmt(M(rowT[r])) : mode === 'row' ? '100%' : K.n0(M(rowT[r]) / (M(grand) || 1) * 100) + '%') + '</td></tr>';
  });
  h += '</tbody></table></div>';
  const lbl = { abs: 'absolutte tal', row: 'rækkeprocent (andel af rækkens ' + (measure === 'value' ? 'værdi' : 'flasker') + ')', col: 'kolonneprocent (andel af kolonnens ' + (measure === 'value' ? 'værdi' : 'flasker') + ')', total: 'andel af hele udsnittet' };
  h += '<div class="faint" style="font-size:.78rem;margin-top:6px">Celler: ' + esc(measure === 'share' ? 'flasker' : K.MEASURES[measure].label.toLowerCase()) + ', ' + lbl[mode] + (rOther || cOther ? '. »Øvrige« samler resten, så totaler stemmer.' : '.') + ' Klik en celle for at se vinene.</div>';
  return h;
};


/** Lagkage (donut) med forklaring. parts: [{name, v, color, act}] */
U.pie = function (parts, opts) {
  opts = opts || {};
  const tot = parts.reduce(function (a, p) { return a + p.v; }, 0);
  if (!tot) return '<div class="empty">Ingen flasker.</div>';
  const R = 92, r = 54, c = 100;
  let a0 = -Math.PI / 2, s = '<svg viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="' + esc(opts.label || 'Fordeling') + '" style="flex:none;max-width:100%">';
  parts.forEach(function (p) {
    if (!p.v) return;
    const a1 = a0 + 2 * Math.PI * p.v / tot;
    const tip = U.tipAttr(p.name + ': ' + K.n0(p.v) + ' fl. (' + K.pct(p.v / tot) + ')');
    if (p.v === tot) {
      s += '<circle cx="' + c + '" cy="' + c + '" r="' + ((R + r) / 2) + '" fill="none" stroke="' + p.color + '" stroke-width="' + (R - r) + '"' + tip + '/>';
    } else {
      const big = a1 - a0 > Math.PI ? 1 : 0;
      const P = function (rad, a) { return (c + rad * Math.cos(a)).toFixed(2) + ' ' + (c + rad * Math.sin(a)).toFixed(2); };
      s += '<path d="M' + P(R, a0) + ' A' + R + ' ' + R + ' 0 ' + big + ' 1 ' + P(R, a1) + ' L' + P(r, a1) + ' A' + r + ' ' + r + ' 0 ' + big + ' 0 ' + P(r, a0) + 'Z" fill="' + p.color + '" stroke="var(--paper)" stroke-width="1.5"' + tip + (p.act || '') + (p.act ? ' style="cursor:pointer"' : '') + '/>';
    }
    a0 = a1;
  });
  s += '<text x="100" y="98" text-anchor="middle" font-size="22" font-weight="800" style="fill:var(--ink);font-family:var(--f-display)">' + K.n0(tot) + '</text><text x="100" y="118" text-anchor="middle" font-size="11">' + esc(opts.unit || 'flasker') + '</text></svg>';
  const leg = '<div style="display:flex;flex-direction:column;gap:6px;min-width:0;flex:1">' + parts.filter(function (p) { return p.v; }).map(function (p) {
    return '<div style="display:grid;grid-template-columns:12px minmax(0,1fr) auto auto;gap:8px;align-items:center;font-size:14px"><span class="sw" style="background:' + p.color + '"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600">' + esc(p.name) + '</span><span class="num faint">' + K.n0(p.v) + '</span><span class="num" style="min-width:52px;text-align:right">' + K.pct(p.v / tot) + '</span></div>';
  }).join('') + '</div>';
  return '<div style="display:flex;flex-wrap:wrap;gap:20px;align-items:center">' + s + leg + '</div>';
};

/* ---------------------------------------------------------------- vinlister */

U.wineRows = function (items) {
  const m = new Map();
  items.forEach(function (i) {
    const k = i.w.id + '|' + i.size;
    if (!m.has(k)) m.set(k, { w: i.w, size: i.size, ml: i.ml, qty: 0, price: i.price, locs: {} });
    const r = m.get(k); r.qty += i.qty; if (i.loc) r.locs[i.loc] = (r.locs[i.loc] || 0) + i.qty;
  });
  return Array.from(m.values());
};
U.wineTable = function (items, opts) {
  opts = opts || {};
  const rows = U.wineRows(items);
  const sort = opts.sort || 'producer';
  const showLoc = rows.some(function (r) { return Object.keys(r.locs).length; });
  const byLabel = function (a, b) { return a.w.producerRaw.localeCompare(b.w.producerRaw, 'da') || a.w.label.localeCompare(b.w.label, 'da') || (a.w.nv ? -1 : b.w.nv ? 1 : a.w.vintage - b.w.vintage) || a.ml - b.ml; };
  const within = {
    producer: byLabel, vintage: function (a, b) { return (a.w.vintage || 0) - (b.w.vintage || 0) || byLabel(a, b); },
    qty: function (a, b) { return b.qty - a.qty || byLabel(a, b); }, price: function (a, b) { return b.price - a.price || byLabel(a, b); },
    value: function (a, b) { return b.price * b.qty - a.price * a.qty || byLabel(a, b); }
  };
  // Én linje pr. producent(gruppe), som kan foldes ud til vinene.
  const gm = new Map();
  rows.forEach(function (r) { const k = r.w.producer; if (!gm.has(k)) gm.set(k, []); gm.get(k).push(r); });
  const groups = Array.from(gm).map(function (g) {
    const rs = g[1].sort(within[sort] || byLabel);
    let q = 0, v = 0, pq = 0; rs.forEach(function (r) { q += r.qty; if (r.price > 0) { v += r.qty * r.price; pq += r.qty; } });
    return { name: g[0], rows: rs, qty: q, value: v, avg: pq ? v / pq : 0, maxPrice: Math.max.apply(null, rs.map(function (r) { return r.price; })),
      minV: Math.min.apply(null, rs.map(function (r) { return r.w.nv ? 9999 : r.w.vintage; })), raws: new Set(rs.map(function (r) { return r.w.producerRaw; })).size };
  });
  const gs = {
    producer: function (a, b) { return a.name.localeCompare(b.name, 'da'); }, qty: function (a, b) { return b.qty - a.qty || a.name.localeCompare(b.name, 'da'); },
    value: function (a, b) { return b.value - a.value; }, price: function (a, b) { return b.maxPrice - a.maxPrice; }, vintage: function (a, b) { return a.minV - b.minV; }
  };
  groups.sort(gs[sort] || gs.producer);
  const single = groups.length === 1;
  const open = single || opts.open;
  const uniq = function (arr) { return Array.from(new Set(arr)); };
  const vrange = function (rs) {
    const ys = rs.filter(function (r) { return !r.w.nv; }).map(function (r) { return r.w.vintage; });
    const nv = rs.some(function (r) { return r.w.nv; });
    if (!ys.length) return 'NV';
    const lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
    return (lo === hi ? lo : lo + '–' + String(hi).slice(2)) + (nv ? ', NV' : '');
  };
  const short = function (list, n) { return list.length > n ? list.slice(0, n).join(', ') + ' +' + (list.length - n) : list.join(', '); };
  const limit = opts.limit || 300;
  let h = '';
  if (!single && groups.length > 1) h += '<div class="toolbar" style="margin-bottom:8px"><span class="faint">' + groups.length + ' producenter · ' + rows.length + ' vinposter</span><button class="link" data-act="tg-all" data-open="1">Fold alle ud</button><button class="link" data-act="tg-all" data-open="0">Fold alle sammen</button></div>';
  h += '<div class="tw"><table class="wt"><thead><tr><th>' + (single ? 'Vin' : 'Producent / vin') + '</th><th class="r">Årgang</th><th class="r">Antal</th><th class="xm">Type</th><th class="xm">Drue</th><th class="xm">Oprindelse</th>' + (showLoc ? '<th class="xm">Lokation</th>' : '') + '<th class="r xm">Pris/fl.</th></tr></thead>';
  groups.slice(0, limit).forEach(function (g) {
    h += '<tbody class="grp' + (open ? ' open' : '') + '">';
    if (!single) {
      const locs = {}; g.rows.forEach(function (r) { Object.keys(r.locs).forEach(function (l) { locs[l] = (locs[l] || 0) + r.locs[l]; }); });
      const cls = uniq(g.rows.map(function (r) { return r.w.cls; }));
      const gGr = short(uniq(g.rows.map(function (r) { return r.w.master; })), 2), gRe = short(uniq(g.rows.map(function (r) { return r.w.region ? r.w.regionDa : r.w.countryDa; })), 3);
      h += '<tr class="gh" data-act="tg"><td><span class="chev" aria-hidden="true"></span><b>' + esc(g.name) + '</b> <span class="faint">' + g.rows.length + (g.rows.length === 1 ? ' vin' : ' vine') + '</span><div class="sm">' + esc(gGr + ' · ' + gRe) + '</div></td>' +
        '<td class="r num">' + vrange(g.rows) + '</td><td class="r num"><b>' + g.qty + '</b></td>' +
        '<td class="xm">' + cls.map(function (c) { return '<span class="dot" title="' + esc(c) + '" style="background:' + U.color('cls', c) + '"></span>'; }).join('') + (cls.length === 1 ? esc(cls[0]) : '') + '</td>' +
        '<td class="xm">' + esc(gGr) + '</td>' +
        '<td class="xm">' + esc(gRe) + '</td>' +
        (showLoc ? '<td class="xm">' + esc(Object.keys(locs).map(function (l) { return l + ' (' + locs[l] + ')'; }).join(', ')) + '</td>' : '') +
        '<td class="r num xm">' + (g.avg ? (g.rows.length > 1 ? '<span class="faint">gns.</span> ' : '') + K.money(g.avg, 2) : '<span class="faint">ukendt</span>') + '</td></tr>';
    }
    g.rows.forEach(function (r) {
      const lbl = single || g.raws > 1 ? (single ? '<b>' + esc(r.w.producerRaw) + '</b> ' : esc(r.w.producerRaw) + ' ') + '<span class="muted">' + esc(r.w.label) + '</span>' : esc(r.w.label);
      h += '<tr class="click gd" data-wine="' + esc(r.w.id) + '"><td>' + lbl + (r.ml !== 750 ? ' <span class="tag">' + K.sizeLabel(r.ml) + '</span>' : '') + '<div class="sm">' + esc(r.w.master) + (r.price > 0 ? ' · ' + K.money(r.price) : '') + '</div></td>' +
        '<td class="r num">' + (r.w.nv ? 'NV' : r.w.vintage) + '</td><td class="r num">' + r.qty + '</td><td class="xm"><span class="dot" style="background:' + U.color('cls', r.w.cls) + '"></span>' + esc(r.w.cls) + '</td>' +
        '<td class="xm">' + esc(r.w.master) + '</td><td class="xm">' + esc(r.w.countryDa) + ', ' + esc(r.w.regionDa) + (r.w.appellation && r.w.appellation !== r.w.region ? ' · <span class="muted">' + esc(r.w.appellation) + '</span>' : '') + '</td>' +
        (showLoc ? '<td class="xm">' + esc(Object.keys(r.locs).map(function (l) { return l + ' (' + r.locs[l] + ')'; }).join(', ')) + '</td>' : '') +
        '<td class="r num xm">' + (r.price > 0 ? K.money(r.price, 2) : '<span class="faint">ukendt</span>') + '</td></tr>';
    });
    h += '</tbody>';
  });
  h += '</table></div>';
  if (groups.length > limit) h += '<div class="faint" style="margin-top:6px">Viser ' + limit + ' af ' + groups.length + ' producenter.</div>';
  return h;
};

/* ---------------------------------------------------------------- værktøjstip */

(function () {
  let tip;
  document.addEventListener('mouseover', function (e) {
    const t = e.target.closest && e.target.closest('[data-tip]');
    tip = tip || document.getElementById('tip');
    if (!tip) return;
    if (!t) { tip.style.display = 'none'; return; }
    tip.textContent = t.getAttribute('data-tip'); tip.style.display = 'block';
  });
  document.addEventListener('mousemove', function (e) {
    if (!tip || tip.style.display !== 'block') return;
    const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    const y = e.clientY + 18 + tip.offsetHeight > window.innerHeight ? e.clientY - tip.offsetHeight - 10 : e.clientY + 18;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });
  document.addEventListener('scroll', function () { if (tip) tip.style.display = 'none'; }, true);
})();
