/**
 * @OnlyCurrentDoc
 *
 * VINHOLDET — backend til appen.
 * Scriptet ligger inde i dette regneark og kan KUN læse og skrive i netop
 * dette regneark (det sikrer linjen "@OnlyCurrentDoc" ovenfor).
 *
 * Opsætning (én gang):
 *   1. Kør funktionen "setup" (vælg den i menuen foroven og tryk ▶ Kør).
 *   2. Implementer → Ny implementering → Webapp. Kør som: Mig. Adgang: Alle.
 *   3. Kopiér webapp-URL'en og nøglen fra fanen "Opsætning" ind i appen.
 *
 * Faner:
 *   Vine       — én række pr. færdig vin: vintype, facit i kort form og
 *                alles vurderinger (1–100) i kolonnerne "Vurdering – <navn>".
 *   Gæt        — én række pr. gæt. En vin med tre gættere giver tre rækker.
 *                Du må gerne rette point og slette rækker; appens historik og
 *                dashboardet læser herfra.
 *   Opsætning  — nøglen til appen.
 *   _state     — skjult; appens igangværende runde. Rør den ikke.
 */

const STATE_SHEET = '_state';
const GUESS_SHEET = 'Gæt';
const WINE_SHEET  = 'Vine';
const SETUP_SHEET = 'Opsætning';
const MAX_SCORE   = 24;
const DEFAULT_PARTICIPANTS = ['Lars', 'Pelle', 'Martin', 'Jonathan'];
const HEAD_BG = '#3B2F1E', HEAD_FG = '#F3E3B5';

// [id, overskrift, maks point]
const CATS = [
  ['land',        'Land',                 2],
  ['region',      'Region',               3],
  ['appellation', 'Appellation',          5],
  ['drue1',       'Dominerende druesort', 8],
  ['drue2',       'Yderligere druesort',  2],
  ['type',        'Type/kvalitet',        2],
  ['aargang',     'Årgang',               2],
];

// "Gæt": A Dato · B Medbragt af · C Vin nr. · D Vinens navn · E Gættet af ·
// facit/gæt/point pr. kategori · Point i alt · Maks · Tidspunkt · Vin-ID
const FIXED = ['Dato', 'Medbragt af', 'Vin nr.', 'Vinens navn', 'Gættet af'];
const G_HEADERS = FIXED
  .concat([].concat.apply([], CATS.map(function (c) { return [c[1] + ' – facit', c[1] + ' – gæt', c[1] + ' – point']; })))
  .concat(['Point i alt', 'Maks', 'Tidspunkt', 'Vin-ID']);
const COL_TOTAL = FIXED.length + CATS.length * 3 + 1; // 1-baseret
const COL_TIME  = COL_TOTAL + 2;
const COL_ID    = COL_TOTAL + 3;
function pointCol_(j) { return FIXED.length + 3 * j + 3; }

// "Vine": faste kolonner, derefter én kolonne pr. person: "Vurdering – Lars" …
const W_HEADERS = ['Dato', 'Medbragt af', 'Vin nr.', 'Vinens navn', 'Vintype', 'Land', 'Region', 'Druesort', 'Årgang', 'Gættere', 'Vin-ID'];
const W_COL_TYPE = 5, W_COL_ID = W_HEADERS.length;
const RATE_PREFIX = 'Vurdering – ';
// Tåler bindestreg/tankestreg, mellemrum og store/små bogstaver i overskriften.
function rateName_(h) {
  const m = /^\s*vurdering\s*[-‐-―:]?\s*(.+?)\s*$/i.exec(String(h || ''));
  return m ? m[1] : '';
}
function sameName_(a, b) { return String(a).trim().toLowerCase() === String(b).trim().toLowerCase(); }

/* ------------------------------------------------------------------ opsætning */

function setup() {
  const ss = SpreadsheetApp.getActive();

  const wine = ss.getSheetByName(WINE_SHEET) || ss.insertSheet(WINE_SHEET, 0);
  head_(wine.getRange(1, 1, 1, W_HEADERS.length).setValues([W_HEADERS]));
  wine.setFrozenRows(1);
  wine.setFrozenColumns(1);
  wine.getRange(2, 1, 999, 1).setNumberFormat('yyyy-mm-dd');
  ratingCols_(wine, participants_());

  const gs = ss.getSheetByName(GUESS_SHEET) || ss.insertSheet(GUESS_SHEET, 1);
  head_(gs.getRange(1, 1, 1, G_HEADERS.length).setValues([G_HEADERS]));
  gs.setFrozenRows(1);
  gs.setFrozenColumns(1);
  gs.getRange(2, COL_TOTAL, 999, 1).setFontWeight('bold');
  gs.getRange(2, COL_TIME, 999, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  gs.getRange(2, 1, 999, 1).setNumberFormat('yyyy-mm-dd');

  const st = ss.getSheetByName(STATE_SHEET) || ss.insertSheet(STATE_SHEET);
  if (st.getLastRow() === 0) st.getRange(1, 1, 1, 3).setValues([['sti', 'json', 'opdateret']]);
  st.hideSheet();

  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('KEY');
  if (!key) { key = Utilities.getUuid().replace(/-/g, '').slice(0, 24); props.setProperty('KEY', key); }

  const su = ss.getSheetByName(SETUP_SHEET) || ss.insertSheet(SETUP_SHEET);
  su.clear();
  su.getRange(1, 1, 6, 2).setValues([
    ['Vinholdet — opsætning', ''],
    ['Nøgle til appen', key],
    ['', ''],
    ['Næste skridt', 'Implementer → Ny implementering → Webapp (Kør som: Mig · Adgang: Alle). Kopiér webapp-URL\'en.'],
    ['', 'Åbn appen, indsæt webapp-URL og nøgle, og tryk "Forbind".'],
    ['', 'Send derefter appens link til holdet (knappen "Send link til holdet" i appen).'],
  ]);
  su.getRange('A1').setFontWeight('bold').setFontSize(14);
  su.getRange('A2:A6').setFontWeight('bold');
  su.getRange('B2').setFontFamily('Courier New').setFontWeight('bold');
  su.setColumnWidth(1, 160); su.setColumnWidth(2, 620);

  // fjern et tomt standardark ("Ark1"/"Sheet1"), hvis det findes
  ss.getSheets().forEach(function (sh) {
    const n = sh.getName();
    if ([WINE_SHEET, GUESS_SHEET, STATE_SHEET, SETUP_SHEET].indexOf(n) === -1 && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  Logger.log('Klar. Nøgle til appen: ' + key);
  try { ss.toast('Fanerne "Vine", "Gæt" og "Opsætning" er oprettet. Nøglen står i "Opsætning".', 'Sat op ✔', 8); } catch (e) {}
}

/** Menuen "Vinholdet" i regnearket (kommer frem, når arket genindlæses). */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Vinholdet').addItem('Opsæt regnearket', 'setup').addToUi();
}

function head_(range) {
  return range.setFontWeight('bold').setBackground(HEAD_BG).setFontColor(HEAD_FG).setWrap(true).setVerticalAlignment('middle');
}

/* ------------------------------------------------------------------ web-app */

function doGet() { return json_({ ok: true, app: 'vinholdet' }); }

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, err: 'bad_request' }); }
  const key = PropertiesService.getScriptProperties().getProperty('KEY');
  if (!key || req.k !== key) return json_({ ok: false, err: 'denied' });
  try {
    return json_(Object.assign({ ok: true }, handle_(req)));
  } catch (err) {
    return json_({ ok: false, err: String((err && err.message) || err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function handle_(req) {
  switch (req.op) {
    case 'ping':   return {};
    case 'sync':   return sync_(req);
    case 'set':    return withLock_(function () { return writeDoc_(req.path, req.data, false); });
    case 'update': return withLock_(function () { return writeDoc_(req.path, req.data, true); });
    case 'delete': return withLock_(function () { return deleteDoc_(req.path); });
  }
  throw new Error('unknown_op');
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ------------------------------------------------------------------ dokumentlager (_state) */

function readState_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(STATE_SHEET);
  const n = sh.getLastRow();
  const map = {};
  if (n >= 2) {
    sh.getRange(2, 1, n - 1, 3).getValues().forEach(function (r, i) {
      if (!r[0]) return;
      try { map[r[0]] = { row: i + 2, data: JSON.parse(r[1]), at: r[2] }; } catch (e) {}
    });
  }
  return { sh: sh, map: map };
}

function isObj_(v) { return v && typeof v === 'object' && !Array.isArray(v); }
// Fletter et delvist dokument ind — tre telefoner kan skrive i samme runde
// (hver sit bud) uden at overskrive hinanden.
function deepMerge_(target, patch) {
  const out = JSON.parse(JSON.stringify(target || {}));
  Object.keys(patch).forEach(function (k) {
    const v = patch[k];
    out[k] = (isObj_(v) && isObj_(out[k])) ? deepMerge_(out[k], v) : JSON.parse(JSON.stringify(v === undefined ? null : v));
  });
  return out;
}

function writeDoc_(path, data, merge) {
  const st = readState_();
  const cur = st.map[path] ? st.map[path].data : null;
  if (merge && !cur) throw new Error('invalid_argument: document missing');
  const next = merge ? deepMerge_(cur, data) : JSON.parse(JSON.stringify(data));

  // En færdig vin skrives i "Vine" og "Gæt" — præcis én gang.
  if (path.indexOf('rounds/') === 0 && next.phase === 'result') {
    if (!next.exported) { appendWine_(next); next.exported = true; }
    else updateWineExtras_(next); // vurderinger der kommer ind efter resultatet
  }

  const row = st.map[path] ? st.map[path].row : st.sh.getLastRow() + 1;
  st.sh.getRange(row, 1, 1, 3).setValues([[path, JSON.stringify(next), new Date()]]);

  if (path === 'state/active' && next.roundId) pruneRounds_(st, next.roundId);
  return {};
}

function deleteDoc_(path) {
  const st = readState_();
  if (st.map[path]) st.sh.deleteRow(st.map[path].row);
  if (path.indexOf('rounds/') === 0) deleteWine_(path.slice(7));
  return {};
}

// Gamle, afsluttede runder i _state ryddes op (historikken ligger i arket).
function pruneRounds_(st, keepId) {
  const cutoff = Date.now() - 12 * 3600 * 1000;
  const rows = [];
  Object.keys(st.map).forEach(function (p) {
    if (p.indexOf('rounds/') !== 0 || p === 'rounds/' + keepId) return;
    const at = isDate_(st.map[p].at) ? st.map[p].at.getTime() : 0;
    if (at && at < cutoff) rows.push(st.map[p].row);
  });
  rows.sort(function (a, b) { return b - a; }).forEach(function (r) { st.sh.deleteRow(r); });
}

/* ------------------------------------------------------------------ fanerne "Vine" og "Gæt" */

function safe_(v) {
  const s = v == null ? '' : String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s; // tekst må aldrig blive til en formel
}
function colLetter_(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function guessersOf_(r) { return (Array.isArray(r.guessers) ? r.guessers : []).filter(function (n) { return n; }); }

function appendWine_(r) {
  const ss = SpreadsheetApp.getActive();
  const gs = ss.getSheetByName(GUESS_SHEET), ws = ss.getSheetByName(WINE_SHEET);
  const guessers = guessersOf_(r);
  const truth = r.truth || {};
  let n = gs.getLastRow();
  guessers.forEach(function (g) {
    n++;
    const guess = (r.guesses || {})[g] || {}, judged = (r.judged || {})[g] || {};
    const row = [r.date || '', safe_(r.ownerName), r.ownerIndex || '', safe_(r.wineNote), safe_(g)];
    CATS.forEach(function (c) {
      const gv = String(guess[c[0]] || '').trim();
      const j = judged[c[0]];
      const pts = !gv ? 0 : j === 'good' ? c[2] : j === 'mid' ? 1 : 0;
      row.push(safe_(truth[c[0]]), safe_(gv), pts);
    });
    const sum = CATS.map(function (c, j) { return colLetter_(pointCol_(j)) + n; }).join(',');
    row.push('=SUM(' + sum + ')', MAX_SCORE, new Date(r.createdAt || Date.now()), r.id);
    gs.getRange(n, 1, 1, row.length).setValues([row]);
  });
  const wn = ws.getLastRow() + 1;
  ws.getRange(wn, 1, 1, W_HEADERS.length).setValues([[
    r.date || '', safe_(r.ownerName), r.ownerIndex || '', safe_(r.wineNote), safe_(r.wineType || ''),
    safe_(truth.land), safe_(truth.region), safe_(truth.drue1), safe_(truth.aargang), safe_(guessers.join(', ')), r.id]]);
  writeRatings_(ws, wn, r);
}

// Deltagerne (fra appens indstillinger) — én vurderingskolonne pr. person.
function participants_() {
  if (!SpreadsheetApp.getActive().getSheetByName(STATE_SHEET)) return DEFAULT_PARTICIPANTS.slice();
  const c = readState_().map['config/main'];
  const list = (c && c.data && Array.isArray(c.data.participants)) ? c.data.participants.filter(String) : [];
  return list.length ? list : DEFAULT_PARTICIPANTS.slice();
}

// Finder (og laver om nødvendigt) kolonnen "Vurdering – <navn>" for hver person.
function ratingCols_(sh, names) {
  const width = Math.max(sh.getLastColumn(), W_COL_ID);
  const hdr = sh.getRange(1, 1, 1, width).getValues()[0].map(String);
  const map = {};
  names.forEach(function (name) {
    if (!name) return;
    let i = hdr.findIndex(function (h) { return sameName_(rateName_(h), name); });
    if (i < 0) {
      for (let k = W_COL_ID; k < hdr.length; k++) { if (hdr[k] === '') { i = k; break; } } // genbrug en tom overskrift
      if (i < 0) { i = hdr.length; hdr.push(''); }
      hdr[i] = RATE_PREFIX + name;
      head_(sh.getRange(1, i + 1, 1, 1).setValues([[hdr[i]]]));
    }
    map[name] = i + 1;
  });
  return map;
}

function writeRatings_(sh, rowNo, r) {
  const rt = r.ratings || {};
  const names = participants_();
  [r.ownerName].concat(guessersOf_(r), Object.keys(rt)).forEach(function (n) {
    if (n && !names.some(function (p) { return sameName_(p, n); })) names.push(n);
  });
  const map = ratingCols_(sh, names);
  Object.keys(rt).forEach(function (name) {
    const v = rt[name];
    const col = map[name] || map[names.filter(function (p) { return sameName_(p, name); })[0]];
    if (col && v !== undefined && v !== null && v !== '') sh.getRange(rowNo, col, 1, 1).setValues([[Math.round(Number(v))]]);
  });
}

function findRows_(sh, col, id) {
  const n = sh.getLastRow();
  if (n < 2) return [];
  const ids = sh.getRange(2, col, n - 1, 1).getValues();
  const out = [];
  ids.forEach(function (v, i) { if (String(v[0]) === id) out.push(i + 2); });
  return out;
}

function updateWineExtras_(r) {
  const ws = SpreadsheetApp.getActive().getSheetByName(WINE_SHEET);
  const rows = findRows_(ws, W_COL_ID, r.id);
  if (!rows.length) return; // rækken er slettet i arket
  const rowNo = rows[rows.length - 1];
  ws.getRange(rowNo, W_COL_TYPE, 1, 1).setValues([[safe_(r.wineType || '')]]);
  writeRatings_(ws, rowNo, r);
}

function deleteWine_(id) {
  const ss = SpreadsheetApp.getActive();
  const gs = ss.getSheetByName(GUESS_SHEET), ws = ss.getSheetByName(WINE_SHEET);
  const m = /^row(\d+)$/.exec(id); // en gæt-række du selv har tilføjet uden Vin-ID
  if (m) { const r = +m[1]; if (r >= 2 && r <= gs.getLastRow()) gs.deleteRow(r); return; }
  findRows_(gs, COL_ID, id).reverse().forEach(function (r) { gs.deleteRow(r); });
  findRows_(ws, W_COL_ID, id).reverse().forEach(function (r) { ws.deleteRow(r); });
}

function isDate_(v) { return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()); }
function cell_(v) {
  if (isDate_(v)) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v == null ? '' : String(v).trim();
}

// Vintype og vurderinger pr. vin (fra "Vine"), slået op på Vin-ID.
function readWineExtras_() {
  const ws = SpreadsheetApp.getActive().getSheetByName(WINE_SHEET);
  const out = {};
  const n = ws.getLastRow();
  if (n < 2) return out;
  const width = Math.max(ws.getLastColumn(), W_HEADERS.length);
  const hdr = ws.getRange(1, 1, 1, width).getValues()[0].map(String);
  const names = participants_();
  const rateCols = [];
  hdr.forEach(function (h, k) {
    if (k < W_COL_ID) return;
    const nm = rateName_(h); if (!nm) return;
    const known = names.filter(function (p) { return sameName_(p, nm); })[0];
    rateCols.push([known || nm, k]);
  });
  ws.getRange(2, 1, n - 1, width).getValues().forEach(function (r) {
    const id = cell_(r[W_COL_ID - 1]); if (!id) return;
    const ratings = {};
    rateCols.forEach(function (rc) { const v = r[rc[1]]; if (v !== '' && v !== null && !isNaN(Number(v))) ratings[rc[0]] = Number(v); });
    out[id] = { wineType: cell_(r[W_COL_TYPE - 1]), ratings: ratings };
  });
  return out;
}

// Læser "Gæt" (én række pr. gæt) som appens historik. Rettelser i arket slår igennem.
function readWines_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(GUESS_SHEET);
  const n = sh.getLastRow();
  if (n < 2) return [];
  const extras = readWineExtras_();
  const out = [];
  const width = Math.max(sh.getLastColumn(), G_HEADERS.length);
  sh.getRange(2, 1, n - 1, width).getValues().forEach(function (r, i) {
    if (!cell_(r[1]) && !cell_(r[4])) return; // tom række
    const truth = {}, guess = {}, judged = {};
    let sum = 0;
    CATS.forEach(function (c, j) {
      const base = FIXED.length + 3 * j;
      truth[c[0]] = cell_(r[base]);
      guess[c[0]] = cell_(r[base + 1]);
      const p = Number(r[base + 2]) || 0;
      sum += p;
      judged[c[0]] = p >= c[2] ? 'good' : (p > 0 ? 'mid' : 'bad');
    });
    const total = Number(r[COL_TOTAL - 1]);
    const t = isDate_(r[COL_TIME - 1]) ? r[COL_TIME - 1].getTime()
            : (isDate_(r[0]) ? r[0].getTime() : 0);
    const wineId = cell_(r[COL_ID - 1]) || ('row' + (i + 2));
    const guesser = cell_(r[4]);
    const x = extras[wineId] || { wineType: '', ratings: {} };
    out.push({
      id: cell_(r[COL_ID - 1]) ? wineId + '|' + guesser : wineId,
      wineId: wineId,
      phase: 'result',
      date: cell_(r[0]),
      ownerName: cell_(r[1]),
      ownerIndex: Number(r[2]) || '',
      wineNote: cell_(r[3]),
      guesserName: guesser,
      truth: truth, guess: guess, judged: judged,
      score: isNaN(total) || r[COL_TOTAL - 1] === '' ? sum : total,
      wineType: x.wineType,
      ratings: x.ratings,
      createdAt: t,
    });
  });
  out.sort(function (a, b) { return b.createdAt - a.createdAt; });
  return out;
}

/* ------------------------------------------------------------------ synkronisering */

// Ét kald henter alt, appen lytter på: de ønskede dokumenter + historikken
// (historikken sendes kun, når den har ændret sig siden sidst).
function sync_(req) {
  const st = readState_();
  const docs = {};
  (req.paths || []).forEach(function (p) { docs[p] = st.map[p] ? st.map[p].data : null; });
  const out = { docs: docs };
  if (req.hist !== undefined && req.hist !== null) {
    const list = readWines_();
    const hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(list)));
    out.histHash = hash;
    if (hash !== req.hist) out.history = list;
  }
  return out;
}
