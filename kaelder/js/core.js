/* Min kælder — datalag: indlæsning, normalisering, filtre og beregninger. */
'use strict';

const K = window.K = {};

/* ---------------------------------------------------------------- tekst og tal */

K.num = function (v) {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim().replace(/\s/g, '');
  if (!s) return 0;
  const n = Number(s.indexOf(',') >= 0 && s.indexOf('.') < 0 ? s.replace(',', '.') : s.replace(/,/g, ''));
  return isFinite(n) ? n : 0;
};
K.fold = function (s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
};
K.esc = function (s) {
  return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
};
const nf0 = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
K.n0 = function (v) { return nf0.format(v || 0); };
K.n1 = function (v) { return nf1.format(v || 0); };
K.n2 = function (v) { return nf2.format(v || 0); };
K.pct = function (v) { return isFinite(v) ? nf1.format(v * 100) + ' %' : '–'; };
K.money = function (v, digits) {
  const s = K.settings();
  const cur = s.currency === 'DKK' && s.dkkRate ? 'DKK' : 'EUR';
  const x = cur === 'DKK' ? v * s.dkkRate : v;
  return (digits === 2 ? nf2 : nf0).format(x || 0) + ' ' + (cur === 'DKK' ? 'kr.' : '€');
};
K.date = function (iso, withTime) {
  if (!iso) return '–';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }) +
    (withTime ? ' kl. ' + d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }) : '');
};

/* ---------------------------------------------------------------- CSV */

K.parseCSV = function (text) {
  text = String(text || '').replace(/^﻿/, '');
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); f = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
};
K.csvObjects = function (text) {
  const rows = K.parseCSV(text);
  if (!rows.length) return { header: [], rows: [] };
  const h = rows[0].map(function (x) { return x.trim(); });
  return {
    header: h,
    rows: rows.slice(1).map(function (r) { const o = {}; h.forEach(function (k, i) { o[k] = r[i] === undefined ? '' : r[i]; }); return o; })
  };
};
/** Afkod en fil: UTF-8 hvis gyldig, ellers Windows-1252 (CellarTrackers standard). */
K.decode = function (buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch (e) { return new TextDecoder('windows-1252').decode(buf); }
};
K.toCSV = function (rows) {
  return rows.map(function (r) {
    return r.map(function (v) { const s = String(v === undefined || v === null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',');
  }).join('\r\n');
};
K.hash = function (str) {
  let h1 = 0x811c9dc5, h2 = 0;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = (h2 * 31 + c) >>> 0; }
  return h1.toString(16) + h2.toString(16);
};

/** Genkend hvilken CellarTracker-tabel en fil er. */
K.detectTable = function (header) {
  const has = function (n) { return header.indexOf(n) >= 0; };
  if (has('iPurchase') || (has('PurchaseDate') && !has('Barcode') && !has('iInventory'))) return 'Purchase';
  if (has('iConsumed') || has('Consumed') || has('ConsumedDate')) return 'Consumed';
  if (has('iNote') || has('TastingDate')) return 'Notes';
  if (has('Barcode') || has('iInventory') || has('BottleID')) return 'Inventory';
  if (has('iWine') && has('Quantity') && has('Wine')) return 'List';
  if (has('iWine') && has('Wine')) return 'Pending';
  return null;
};
const clean = function (v) {
  return String(v).replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); }).replace(/&amp;/g, '&').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
};
K.clean = clean;
const pick = function (o, names) {
  for (let i = 0; i < names.length; i++) if (o[names[i]] !== undefined && String(o[names[i]]).trim() !== '') return clean(o[names[i]]);
  return '';
};
K.pick = pick;
const parseDate = function (s) {
  s = String(s || '').trim(); if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{1,2})-(\d{1,2})-(\d{4})/.exec(s); // CT med dansk opsætning: DD-MM-ÅÅÅÅ
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); // amerikansk M/D/ÅÅÅÅ
  if (m) return +m[1] > 12 ? new Date(+m[3], +m[2] - 1, +m[1]) : new Date(+m[3], +m[1] - 1, +m[2]);
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(s); return isNaN(d) ? null : d;
};
K.parseDate = parseDate;

/* ---------------------------------------------------------------- navne og ordbøger */

K.COUNTRY_DA = { France: 'Frankrig', Italy: 'Italien', Germany: 'Tyskland', Spain: 'Spanien', Austria: 'Østrig', USA: 'USA', 'New Zealand': 'New Zealand', Denmark: 'Danmark', Portugal: 'Portugal', Australia: 'Australien', 'South Africa': 'Sydafrika', Chile: 'Chile', Argentina: 'Argentina', Hungary: 'Ungarn', Greece: 'Grækenland', Switzerland: 'Schweiz', Slovenia: 'Slovenien', Croatia: 'Kroatien', Georgia: 'Georgien', England: 'England', 'United Kingdom': 'Storbritannien', Canada: 'Canada', Lebanon: 'Libanon', Czechia: 'Tjekkiet', Sweden: 'Sverige', Norway: 'Norge' };
K.REGION_DA = { Burgundy: 'Bourgogne', 'Loire Valley': 'Loire', Piedmont: 'Piemonte', Tuscany: 'Toscana', Sicily: 'Sicilien', 'Mosel Saar Ruwer': 'Mosel', 'Languedoc Roussillon': 'Languedoc-Roussillon', Sjaelland: 'Sjælland', Rhône: 'Rhône', Alsace: 'Alsace', Champagne: 'Champagne', Bordeaux: 'Bordeaux', Jura: 'Jura', Savoie: 'Savoie', Provence: 'Provence', 'Southwest France': 'Sydvestfrankrig', Beaujolais: 'Beaujolais', Veneto: 'Veneto', Campania: 'Campania', Sardinia: 'Sardinien', Lombardy: 'Lombardiet', Friuli: 'Friuli', 'Friuli-Venezia Giulia': 'Friuli-Venezia Giulia', Catalunya: 'Catalunya', 'Castilla y León': 'Castilla y León', 'La Rioja': 'La Rioja', Galicia: 'Galicien', Andalucía: 'Andalusien' };
K.COLOR_DA = { White: 'Hvid', Red: 'Rød', Rosé: 'Rosé', Orange: 'Orange', Amber: 'Orange' };
K.COLOR_ORDER = ['Hvid', 'Rød', 'Orange', 'Rosé'];
K.CLASS_ORDER = ['Mousserende', 'Hvid', 'Hvid, off-dry', 'Orange', 'Rosé', 'Rød', 'Sød', 'Hedvin', 'Øvrige'];
K.CLASS_TITLE = { Mousserende: 'Mousserende vine', Hvid: 'Hvide vine', 'Hvid, off-dry': 'Hvide vine med restsødme', Orange: 'Orange vine', Rosé: 'Rosévine', Rød: 'Røde vine', Sød: 'Søde vine', Hedvin: 'Hedvin', Øvrige: 'Øvrige' };
K.UNKNOWN = 'Ukendt';

/** Vinkort-afsnit: én regel, så hver vin står præcis ét sted. */
K.classify = function (type, category, color) {
  const t = String(type || ''), c = String(category || '');
  if (/sparkling/i.test(c) || /sparkling/i.test(t)) return 'Mousserende';
  if (/fortified/i.test(c) || /fortified/i.test(t)) return 'Hedvin';
  if (/dessert|sweet/i.test(c) || /dessert|sweet/i.test(t)) return 'Sød';
  const col = K.COLOR_DA[color] || '';
  if (col === 'Hvid' && /off-dry/i.test(t)) return 'Hvid, off-dry';
  if (col) return col;
  return 'Øvrige';
};
K.sizeMl = function (s) {
  const m = /([\d.,]+)\s*(ml|l|cl)/i.exec(String(s || ''));
  if (!m) return 750;
  const v = K.num(m[1]);
  return /^l$/i.test(m[2]) ? v * 1000 : /^cl$/i.test(m[2]) ? v * 10 : v;
};
K.sizeLabel = function (ml) {
  if (ml === 750) return '75 cl';
  if (ml >= 1000) return K.n1(ml / 1000).replace(',0', '') + ' l';
  return nf0.format(ml) + ' ml';
};
const known = function (v) { v = String(v || '').trim(); return v && !/^unknown$/i.test(v) ? v : ''; };

/* ---------------------------------------------------------------- indstillinger og lager */

const LS = 'minkaelder.v1.';
K.store = {
  get: function (k, d) { try { const s = localStorage.getItem(LS + k); return s ? JSON.parse(s) : d; } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del: function (k) { try { localStorage.removeItem(LS + k); } catch (e) { /* */ } }
};
K.DEFAULT_ALIASES = { 'Jean-François Ganevat': 'Ganevat', 'Anne et Jean-François Ganevat': 'Ganevat' };
K.settings = function () {
  if (!K._settings) K._settings = Object.assign({ currency: 'EUR', dkkRate: 7.46, weekendLocation: '', syncUrl: '', syncKey: '' }, K.store.get('settings', {}));
  return K._settings;
};
K.saveSettings = function (patch) { Object.assign(K.settings(), patch); K.store.set('settings', K.settings()); };
K.aliases = function () { return K.store.get('aliases', null) || Object.assign({}, K.DEFAULT_ALIASES); };

/* ---------------------------------------------------------------- byg databasen */

/**
 * tables: { List, Inventory?, Purchase?, Consumed?, Notes? } som CSV-tekst.
 * Resultatet er et "faktaudsnit" af flaskeposter (items): én række pr. vin,
 * størrelse og (hvis kendt) lokation — så antal aldrig tælles dobbelt.
 */
K.build = function (tables, extras) {
  extras = extras || {};
  const aliases = extras.aliases || K.aliases();
  const db = { wines: new Map(), items: [], purchases: [], consumed: [], notes: [], warnings: [], cols: {}, tables: {} };
  const list = K.csvObjects(tables.List || '');
  db.cols.List = list.header;
  db.tables.List = list.rows.length;

  const wineFrom = function (r) {
    const id = pick(r, ['iWine']);
    if (!id) return null;
    if (db.wines.has(id)) return db.wines.get(id);
    const vint = pick(r, ['Vintage']);
    const nv = !vint || vint === '1001' || /^nv$/i.test(vint);
    const country = known(pick(r, ['Country'])) || K.UNKNOWN;
    let region = known(pick(r, ['Region']));
    const unspecified = !region || region === country;
    const color = pick(r, ['Color']);
    const prodRaw = pick(r, ['Producer']) || K.UNKNOWN;
    const name = pick(r, ['Wine']);
    const w = {
      id: id, name: name, vintage: nv ? null : +vint, nv: nv,
      producerRaw: prodRaw, producer: aliases[prodRaw] || prodRaw,
      designation: known(pick(r, ['Designation'])), vineyard: known(pick(r, ['Vineyard'])),
      country: country, countryDa: K.COUNTRY_DA[country] || country,
      region: unspecified ? '' : region,
      regionKey: country + '›' + (unspecified ? '' : region),
      regionDa: unspecified ? 'Ikke nærmere angivet' : (K.REGION_DA[region] || region),
      subregion: known(pick(r, ['SubRegion'])), appellation: known(pick(r, ['Appellation'])),
      locale: pick(r, ['Locale']),
      colorRaw: color, color: K.COLOR_DA[color] || (color || K.UNKNOWN),
      type: pick(r, ['Type']), category: pick(r, ['Category']),
      cls: K.classify(pick(r, ['Type']), pick(r, ['Category']), color),
      master: known(pick(r, ['MasterVarietal'])) || K.UNKNOWN, varietal: known(pick(r, ['Varietal'])) || K.UNKNOWN,
      likeVotes: K.num(pick(r, ['LikeVotes'])), cnotes: K.num(pick(r, ['CNotes'])),
      pscore: K.num(pick(r, ['PScore'])) || null
    };
    w.cuvee = prodRaw + '›' + name;
    w.label = name.indexOf(prodRaw) === 0 ? name.slice(prodRaw.length).trim() : name;
    if (!w.label) w.label = w.appellation || w.designation || name;
    w.search = K.fold([name, prodRaw, w.producer, w.designation, w.vineyard, w.appellation, w.region, w.regionDa, w.subregion, w.country, w.countryDa, w.master, w.varietal, w.vintage || 'NV', w.locale].join(' '));
    db.wines.set(id, w);
    return w;
  };

  const listQty = new Map();
  list.rows.forEach(function (r) {
    const w = wineFrom(r); if (!w) return;
    const qty = K.num(pick(r, ['Quantity']));
    const size = pick(r, ['Size']) || '750ml';
    const price = K.num(pick(r, ['Price']));
    const loc = pick(r, ['Location']);
    const bin = pick(r, ['Bin']);
    w.price = price; w.value = K.num(pick(r, ['Value']));
    w.pending = (w.pending || 0) + K.num(pick(r, ['Pending']));
    listQty.set(w.id, (listQty.get(w.id) || 0) + qty);
    if (qty > 0) db.items.push({ w: w, qty: qty, size: size, ml: K.sizeMl(size), price: price, loc: loc || '', bin: bin, store: '' });
  });
  db.hasLoc = db.items.some(function (i) { return i.loc; });

  // Individuelle flasker (lokation, bin, forhandler) erstatter List-antal, hvis de stemmer.
  if (tables.Inventory) {
    const inv = K.csvObjects(tables.Inventory);
    db.cols.Inventory = inv.header; db.tables.Inventory = inv.rows.length;
    const groups = new Map(); let total = 0;
    inv.rows.forEach(function (r) {
      const w = wineFrom(r); if (!w) return;
      const size = pick(r, ['Size']) || '750ml';
      const loc = pick(r, ['Location']) || '';
      const store = known(pick(r, ['StoreName', 'Store']));
      const price = K.num(pick(r, ['Price', 'BottleCost', 'Cost'])) || w.price || 0;
      const q = K.num(pick(r, ['Quantity'])) || 1;
      const key = w.id + '|' + size + '|' + loc + '|' + store + '|' + price;
      if (!groups.has(key)) groups.set(key, { w: w, qty: 0, size: size, ml: K.sizeMl(size), price: price, loc: loc, bin: pick(r, ['Bin']), store: store, pdate: parseDate(pick(r, ['PurchaseDate'])) });
      groups.get(key).qty += q; total += q;
    });
    const listTotal = db.items.reduce(function (s, i) { return s + i.qty; }, 0);
    if (groups.size && total === listTotal) {
      db.items = Array.from(groups.values());
      db.hasLoc = db.items.some(function (i) { return i.loc; });
      db.hasStore = db.items.some(function (i) { return i.store; });
      db.bottleLevel = true;
    } else if (groups.size) {
      db.warnings.push('Individuelle flasker summerer til ' + total + ' fl., mens beholdningen (List) har ' + listTotal + ' fl. Flaskefilen bruges ikke, før de to eksporter er fra samme tidspunkt.');
    }
  }

  // Køb
  if (tables.Purchase) {
    const pu = K.csvObjects(tables.Purchase);
    db.cols.Purchase = pu.header; db.tables.Purchase = pu.rows.length;
    pu.rows.forEach(function (r) {
      const w = wineFrom(r); const d = parseDate(pick(r, ['PurchaseDate', 'Date', 'DeliveryDate']));
      if (!w || !d) return;
      db.purchases.push({ w: w, date: d, qty: K.num(pick(r, ['Quantity', 'BottlesPurchased', 'Bottles'])) || 1,
        price: K.num(pick(r, ['Price', 'BottleCost'])), store: known(pick(r, ['StoreName', 'Store'])), delivered: pick(r, ['Delivered']), rem: pick(r, ['Remaining']) === '' ? null : K.num(pick(r, ['Remaining'])) });
    });
  }
  // Forbrug / afgang
  if (tables.Consumed) {
    const co = K.csvObjects(tables.Consumed);
    db.cols.Consumed = co.header; db.tables.Consumed = co.rows.length;
    co.rows.forEach(function (r) {
      const w = wineFrom(r); const d = parseDate(pick(r, ['Consumed', 'ConsumedDate', 'Date']));
      if (!w || !d) return;
      const reason = pick(r, ['ShortType', 'ConsumptionType', 'ConsumedType', 'Reason']) || 'Ukendt';
      db.consumed.push({ w: w, date: d, qty: K.num(pick(r, ['Quantity'])) || 1, reason: reason, drunk: /drank|drunk|drukket|consumed/i.test(reason) || reason === 'Ukendt' });
    });
  }
  if (tables.Notes) {
    const no = K.csvObjects(tables.Notes);
    db.cols.Notes = no.header; db.tables.Notes = no.rows.length;
    no.rows.forEach(function (r) {
      const w = wineFrom(r); if (!w) return;
      const sc = K.num(pick(r, ['Rating', 'Score', 'PScore']));
      if (sc) db.notes.push({ w: w, date: parseDate(pick(r, ['TastingDate', 'Date'])), score: sc });
    });
  }
  db.hasPurchases = db.purchases.length > 0;
  db.hasConsumed = db.consumed.length > 0;
  db.hasStore = db.hasStore || db.purchases.some(function (p) { return p.store; });
  db.locations = Array.from(new Set(db.items.map(function (i) { return i.loc || ''; }))).sort();
  return db;
};

/** Kompakt observation af beholdningen til historik (samme format som Apps Script). */
K.snapshotRows = function (db) {
  const m = new Map();
  db.items.forEach(function (i) {
    const k = i.w.id + '|' + i.size;
    if (!m.has(k)) m.set(k, [i.w.id, i.size, 0, i.w.price || i.price || 0]);
    m.get(k)[2] += i.qty;
  });
  return Array.from(m.keys()).sort().map(function (k) { return m.get(k); });
};
K.catalogFrom = function (db) {
  const c = {};
  db.wines.forEach(function (w) {
    c[w.id] = { Wine: w.name, Vintage: w.nv ? '1001' : String(w.vintage), Producer: w.producerRaw, Country: w.country, Region: w.region || w.country,
      SubRegion: w.subregion, Appellation: w.appellation, Color: w.colorRaw, Type: w.type, Category: w.category, MasterVarietal: w.master, Varietal: w.varietal };
  });
  return c;
};

/* ---------------------------------------------------------------- dimensioner */

const regionLabel = function (key) {
  const p = key.split('›'); const c = K.COUNTRY_DA[p[0]] || p[0];
  return p[1] ? (K.REGION_DA[p[1]] || p[1]) : c + ' – region ikke angivet';
};
const PRICE_BANDS = [[0, 0, 'Ingen pris'], [0.01, 20, 'Under 20 €'], [20, 30, '20–30 €'], [30, 45, '30–45 €'], [45, 60, '45–60 €'], [60, 90, '60–90 €'], [90, 150, '90–150 €'], [150, 1e9, 'Over 150 €']];
K.priceBand = function (p) {
  if (!(p > 0)) return PRICE_BANDS[0][2];
  for (let i = 1; i < PRICE_BANDS.length; i++) if (p < PRICE_BANDS[i][1]) return PRICE_BANDS[i][2];
  return PRICE_BANDS[PRICE_BANDS.length - 1][2];
};

K.DIMS = {
  country: { label: 'Land', get: function (i) { return i.w.country; }, name: function (k) { return K.COUNTRY_DA[k] || k; } },
  region: { label: 'Region', get: function (i) { return i.w.regionKey; }, name: regionLabel },
  subregion: { label: 'Underområde', get: function (i) { return i.w.subregion || K.UNKNOWN; } },
  appellation: { label: 'Appellation', get: function (i) { return i.w.appellation || K.UNKNOWN; } },
  vineyard: { label: 'Mark', get: function (i) { return i.w.vineyard || K.UNKNOWN; } },
  producer: { label: 'Producent', get: function (i) { return i.w.producer; } },
  producerRaw: { label: 'Producent (rå navn)', get: function (i) { return i.w.producerRaw; } },
  cuvee: { label: 'Cuvée', get: function (i) { return i.w.cuvee; }, name: function (k) { return k.split('›')[1] || k; } },
  grape: { label: 'Drue', get: function (i) { return i.w.master; } },
  varietal: { label: 'Drue (detaljeret)', get: function (i) { return i.w.varietal; } },
  color: { label: 'Farve', get: function (i) { return i.w.color; }, order: K.COLOR_ORDER },
  cls: { label: 'Vintype', get: function (i) { return i.w.cls; }, order: K.CLASS_ORDER },
  type: { label: 'CT-type', get: function (i) { return i.w.type || K.UNKNOWN; } },
  vintage: { label: 'Årgang', get: function (i) { return i.w.nv ? 'NV' : String(i.w.vintage); }, numeric: true },
  size: { label: 'Flaskestørrelse', get: function (i) { return K.sizeLabel(i.ml); } },
  priceBand: { label: 'Prisinterval', get: function (i) { return K.priceBand(i.price); }, order: PRICE_BANDS.map(function (b) { return b[2]; }) },
  location: { label: 'Lokation', get: function (i) { return i.loc || 'Ukendt lokation'; }, needs: 'hasLoc' },
  store: { label: 'Forhandler', get: function (i) { return i.store || 'Ukendt forhandler'; }, needs: 'hasStore' }
};
K.dimName = function (dim, key) { const d = K.DIMS[dim]; return d && d.name ? d.name(key) : key; };
K.dimsAvailable = function (db) {
  return Object.keys(K.DIMS).filter(function (k) { const n = K.DIMS[k].needs; return !n || db[n]; });
};

/* ---------------------------------------------------------------- målinger */

K.MEASURES = {
  bottles: { label: 'Flasker', short: 'fl.', fn: function (it) { let s = 0; for (let i = 0; i < it.length; i++) s += it[i].qty; return s; }, fmt: function (v) { return K.n0(v); } },
  wines: { label: 'Unikke vine (iWine)', short: 'vine', fn: function (it) { const s = new Set(); it.forEach(function (i) { s.add(i.w.id); }); return s.size; }, fmt: function (v) { return K.n0(v); } },
  value: { label: 'Indkøbsværdi', short: '', fn: function (it) { let s = 0; it.forEach(function (i) { s += i.qty * i.price; }); return s; }, fmt: function (v) { return K.money(v); } },
  avgPrice: { label: 'Gns. pris pr. flaske', short: '', fn: function (it) { let s = 0, n = 0; it.forEach(function (i) { if (i.price > 0) { s += i.qty * i.price; n += i.qty; } }); return n ? s / n : 0; }, fmt: function (v) { return v ? K.money(v) : '–'; }, noShare: true },
  producers: { label: 'Producenter', short: 'prod.', fn: function (it) { const s = new Set(); it.forEach(function (i) { s.add(i.w.producer); }); return s.size; }, fmt: function (v) { return K.n0(v); }, noShare: true },
  liters: { label: 'Volumen (liter)', short: 'l', fn: function (it) { let s = 0; it.forEach(function (i) { s += i.qty * i.ml / 1000; }); return s; }, fmt: function (v) { return K.n1(v) + ' l'; } }
};
K.sum = K.MEASURES.bottles.fn;
K.value = K.MEASURES.value.fn;

K.group = function (items, dim) {
  const get = typeof dim === 'function' ? dim : K.DIMS[dim].get;
  const m = new Map();
  items.forEach(function (i) { const k = get(i); if (!m.has(k)) m.set(k, []); m.get(k).push(i); });
  return m;
};
/** Rangliste: [{key, name, items, v}] sorteret efter målingen. */
K.rank = function (items, dim, measure, opts) {
  opts = opts || {};
  const M = K.MEASURES[measure || 'bottles'];
  const d = K.DIMS[dim];
  const arr = Array.from(K.group(items, dim)).map(function (e) {
    return { key: e[0], name: K.dimName(dim, e[0]), items: e[1], v: M.fn(e[1]), b: K.sum(e[1]) };
  });
  if (opts.natural && d && d.order) arr.sort(function (a, b) { return idx(d.order, a.key) - idx(d.order, b.key); });
  else if (opts.natural && d && d.numeric) arr.sort(function (a, b) { return (a.key === 'NV' ? -1 : +a.key) - (b.key === 'NV' ? -1 : +b.key); });
  else arr.sort(function (a, b) { return b.v - a.v || b.b - a.b || String(a.name).localeCompare(String(b.name), 'da'); });
  return arr;
};
const idx = function (arr, k) { const i = arr.indexOf(k); return i < 0 ? 999 : i; };
K.median = function (items) {
  const ps = items.filter(function (i) { return i.price > 0; }).map(function (i) { return [i.price, i.qty]; }).sort(function (a, b) { return a[0] - b[0]; });
  const n = ps.reduce(function (s, p) { return s + p[1]; }, 0); if (!n) return 0;
  let c = 0; for (let i = 0; i < ps.length; i++) { c += ps[i][1]; if (c >= n / 2) return ps[i][0]; }
  return 0;
};
K.priceCoverage = function (items) {
  let p = 0, z = 0; items.forEach(function (i) { if (i.price > 0) p += i.qty; else z += i.qty; });
  return { priced: p, zero: z };
};
K.stats = function (items) {
  const s = new Set(), cu = new Set(), pr = new Set(), co = new Set(), re = new Set(), vi = new Set();
  items.forEach(function (i) { s.add(i.w.id); cu.add(i.w.cuvee); pr.add(i.w.producer); co.add(i.w.country); re.add(i.w.regionKey); if (!i.w.nv) vi.add(i.w.vintage); });
  const cov = K.priceCoverage(items);
  return { bottles: K.sum(items), wines: s.size, cuvees: cu.size, producers: pr.size, countries: co.size, regions: re.size, vintages: vi.size,
    value: K.value(items), avg: K.MEASURES.avgPrice.fn(items), median: K.median(items), priced: cov.priced, zero: cov.zero };
};
/** Shannon-entropi, effektivt antal kategorier og HHI over flaskefordelingen. */
K.diversity = function (items, dim) {
  const r = K.rank(items, dim, 'bottles'); const tot = K.sum(items) || 1;
  let H = 0, HHI = 0; const ps = r.map(function (x) { return x.v / tot; });
  ps.forEach(function (p) { if (p > 0) { H -= p * Math.log(p); HHI += p * p; } });
  const cover = function (t) { let c = 0; for (let i = 0; i < ps.length; i++) { c += ps[i]; if (c >= t - 1e-9) return i + 1; } return ps.length; };
  const top = function (n) { return ps.slice(0, n).reduce(function (a, b) { return a + b; }, 0); };
  return { n: r.length, H: H, eff: Math.exp(H), HHI: HHI, c25: cover(0.25), c50: cover(0.5), c75: cover(0.75), c90: cover(0.9), t1: top(1), t3: top(3), t5: top(5), t10: top(10), rank: r };
};

/* ---------------------------------------------------------------- filtre */

K.filters = { dims: {}, vintage: null, nv: true, price: null, zeroPrice: true };
K.blankFilters = function () { return { dims: {}, vintage: null, nv: true, price: null, zeroPrice: true }; };
K.filterFn = function (f) {
  const dims = Object.keys(f.dims).filter(function (k) { return f.dims[k] && f.dims[k].vals.size; });
  return function (i) {
    for (let j = 0; j < dims.length; j++) {
      const d = f.dims[dims[j]]; const v = K.DIMS[dims[j]].get(i);
      const hit = d.vals.has(v);
      if (d.mode === 'out' ? hit : !hit) return false;
    }
    if (i.w.nv) { if (!f.nv) return false; }
    else if (f.vintage && (i.w.vintage < f.vintage[0] || i.w.vintage > f.vintage[1])) return false;
    if (i.price <= 0) { if (!f.zeroPrice) return false; }
    else if (f.price && (i.price < f.price[0] || i.price > f.price[1])) return false;
    return true;
  };
};
K.apply = function (items, f) { return items.filter(K.filterFn(f || K.filters)); };
K.activeFilterCount = function (f) {
  f = f || K.filters;
  let n = Object.keys(f.dims).filter(function (k) { return f.dims[k].vals.size; }).length;
  if (f.vintage) n++; if (!f.nv) n++; if (f.price) n++; if (!f.zeroPrice) n++;
  return n;
};
K.cloneFilters = function (f) {
  const o = { dims: {}, vintage: f.vintage ? f.vintage.slice() : null, nv: f.nv, price: f.price ? f.price.slice() : null, zeroPrice: f.zeroPrice };
  Object.keys(f.dims).forEach(function (k) { o.dims[k] = { mode: f.dims[k].mode, vals: new Set(f.dims[k].vals) }; });
  return o;
};
/** Tidsbaserede hændelser (køb/forbrug) filtreres på vinens egenskaber, ikke lokation. */
K.eventFilter = function (f) {
  const g = K.cloneFilters(f); delete g.dims.location; delete g.dims.store;
  const fn = K.filterFn(g);
  return function (e) { return fn({ w: e.w, qty: e.qty, price: e.price || e.w.price || 0, ml: 750, loc: '', store: e.store || '' }); };
};

/* ---------------------------------------------------------------- historik */

/** Byg observerede beholdningsrækker (items) ud fra et snapshot. */
K.snapshotItems = function (snap, db, catalog) {
  const out = [];
  (snap.r || []).forEach(function (r) {
    let w = db.wines.get(r[0]);
    if (!w && catalog && catalog[r[0]]) {
      const c = Object.assign({ iWine: r[0] }, catalog[r[0]]);
      const tmp = K.build({ List: K.toCSV([Object.keys(c), Object.values(c)]) });
      w = tmp.wines.get(r[0]);
      if (w) db.wines.set(r[0], Object.assign(w, { gone: true }));
    }
    if (!w) return;
    out.push({ w: w, qty: r[2], size: r[1], ml: K.sizeMl(r[1]), price: r[3] || 0, loc: '', store: '' });
  });
  return out;
};
