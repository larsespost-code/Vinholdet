/**
 * MIN KÆLDER — synkronisering fra CellarTracker til dashboardet.
 *
 * Et selvstændigt Apps Script (ikke det samme som Vinholdet-scriptet).
 * Det henter dine CellarTracker-data hver nat, gemmer dem privat i din egen
 * Google Drive og udleverer dem kun til dashboardet, når det sender din nøgle.
 *
 * OPSÆTNING (én gang, ca. 10 minutter — se også kaelder/README.md):
 *   1. Gå til https://script.google.com → Nyt projekt. Kald det "Min kælder".
 *   2. Slet indholdet i Code.gs og indsæt hele denne fil. Gem.
 *   3. Projektindstillinger (tandhjulet) → Scriptegenskaber → Tilføj:
 *        CT_USER  = dit CellarTracker-brugernavn (handle)
 *        CT_PASS  = din CellarTracker-adgangskode
 *      Valgfrit, til "Mad og vin" (én af dem):
 *        GEMINI_API_KEY     = gratis nøgle fra Google AI Studio (aistudio.google.com)
 *        ANTHROPIC_API_KEY  = betalt nøgle fra Anthropic (console.anthropic.com)
 *      Er begge sat, bruges Claude. Tving et valg med AI_PROVIDER = gemini eller claude.
 *      GEMINI_MODEL kan ændre Gemini-modellen (standard: gemini-flash-latest).
 *   4. Vælg funktionen "setup" foroven og tryk ▶ Kør. Godkend adgangen.
 *      Se loggen: den viser din dashboard-nøgle og om hentningen lykkedes.
 *   5. Implementer → Ny implementering → Type: Webapp.
 *      Kør som: Mig. Hvem har adgang: Alle. → Implementer.
 *   6. Kopiér webapp-URL'en (slutter på /exec) og nøglen ind i dashboardet
 *      under "Data & synk".
 *
 * Herefter henter scriptet automatisk data hver nat ca. kl. 6, og du kan
 * trykke "Opdater nu" i dashboardet. Du registrerer fortsat alt i CellarTracker.
 *
 * Sikkerhed: Adgangskoden ligger kun i Scriptegenskaber i din egen Google-konto
 * og sendes kun til cellartracker.com over HTTPS. Den logges aldrig. Webappen
 * svarer ikke uden den hemmelige nøgle. Data ligger i en privat Drive-mappe.
 */

const FOLDER_NAME = 'Min kælder (dashboard-data)';
const TABLES = ['List', 'Inventory', 'Purchase', 'Consumed', 'Notes', 'Pending'];
const REQUIRED = 'List';
const CT_URL = 'https://www.cellartracker.com/xlquery.asp';
const MAX_LOG = 60;
const MAX_SNAPSHOTS = 2000;
const AI_MODEL = 'claude-opus-5-5';
const GEMINI_DEFAULT = 'gemini-flash-latest';

/* ------------------------------------------------------------ opsætning */

function setup() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('DASH_KEY')) p.setProperty('DASH_KEY', Utilities.getUuid().replace(/-/g, ''));
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sync') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sync').timeBased().everyDays(1).atHour(6).inTimezone('Europe/Copenhagen').create();
  folder_();
  Logger.log('Dashboard-nøgle: ' + p.getProperty('DASH_KEY'));
  if (!p.getProperty('CT_USER') || !p.getProperty('CT_PASS')) {
    Logger.log('Mangler CT_USER og/eller CT_PASS i Scriptegenskaber. Tilføj dem og kør setup igen.');
    return;
  }
  const r = sync();
  Logger.log(JSON.stringify(r, null, 2));
}

/** Kør hvis du vil have en ny nøgle (den gamle holder op med at virke). */
function nyNoegle() {
  const k = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('DASH_KEY', k);
  Logger.log('Ny dashboard-nøgle: ' + k);
}

/* ------------------------------------------------------------ webapp */

function doGet(e) {
  const q = (e && e.parameter) || {};
  if (!authorized_(q.key)) return json_({ ok: false, error: 'Forkert eller manglende nøgle.' });
  if (q.action === 'sync') {
    const r = withLock_(function () { return syncThrottled_(); });
    return json_(Object.assign(payload_(), { sync: r }));
  }
  if (q.action === 'approve') {
    return json_(Object.assign({ approve: withLock_(approvePending_) }, payload_()));
  }
  return json_(payload_());
}

function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents || '{}'); } catch (err) { return json_({ ok: false, error: 'Ugyldig forespørgsel.' }); }
  if (!authorized_(req.key)) return json_({ ok: false, error: 'Forkert eller manglende nøgle.' });
  try {
    if (req.action === 'pair') return json_(pair_(req));
    if (req.action === 'aliases') { saveJson_('aliases.json', req.aliases || {}); return json_({ ok: true }); }
    if (req.action === 'settings') { saveJson_('settings.json', req.settings || {}); return json_({ ok: true }); }
    return json_({ ok: false, error: 'Ukendt handling.' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function authorized_(key) {
  const k = PropertiesService.getScriptProperties().getProperty('DASH_KEY');
  return !!k && !!key && String(key) === k;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return { ok: false, error: 'En anden opdatering kører allerede. Prøv igen om lidt.' };
  try { return fn(); } finally { lock.releaseLock(); }
}

function payload_() {
  const tables = {};
  TABLES.forEach(function (t) { const s = readText_(t + '.csv'); if (s) tables[t] = s; });
  const pending = readText_('List.pending.csv');
  return {
    ok: true,
    app: 'min-kaelder',
    tables: tables,
    pendingList: pending ? { bytes: pending.length, info: readJson_('pending.json', null) } : null,
    status: readJson_('status.json', {}),
    history: readJson_('history.json', []),
    catalog: readJson_('catalog.json', {}),
    aliases: readJson_('aliases.json', null),
    settings: readJson_('settings.json', {}),
    log: readJson_('log.json', []),
    ai: aiProvider_(),
    nextSync: 'dagligt ca. kl. 06 (dansk tid)'
  };
}

/* ------------------------------------------------------------ synkronisering */

function syncThrottled_() {
  const st = readJson_('status.json', {});
  if (st.lastAttempt && Date.now() - Date.parse(st.lastAttempt) < 90 * 1000) {
    return { ok: true, skipped: true, message: 'Der blev hentet for under 1½ minut siden. Viser seneste data.' };
  }
  return sync();
}

function sync() {
  const p = PropertiesService.getScriptProperties();
  const user = p.getProperty('CT_USER'), pass = p.getProperty('CT_PASS');
  const now = new Date().toISOString();
  const st = readJson_('status.json', {});
  st.lastAttempt = now;
  const entry = { time: now, tables: {}, warnings: [] };
  if (!user || !pass) {
    entry.ok = false; entry.error = 'CT_USER/CT_PASS mangler i Scriptegenskaber.';
    finish_(st, entry); return entry;
  }

  const fetched = {};
  TABLES.forEach(function (t) {
    try {
      const r = fetchTable_(t, user, pass);
      fetched[t] = r;
      entry.tables[t] = r.ok ? { rows: r.rows, cols: r.cols } : { error: r.error };
    } catch (err) {
      fetched[t] = { ok: false, error: String(err && err.message || err) };
      entry.tables[t] = { error: fetched[t].error };
    }
  });

  const list = fetched[REQUIRED];
  if (!list || !list.ok) {
    entry.ok = false;
    entry.error = 'Kunne ikke hente beholdningen (List): ' + (list && list.error || 'ukendt fejl') + '. Seneste gode data er bevaret.';
    finish_(st, entry); return entry;
  }

  // Beskyt mod delvise/tomme eksporter: et stort fald kræver godkendelse.
  const prevText = readText_('List.csv');
  const prevBottles = prevText ? bottles_(prevText) : 0;
  const newBottles = bottles_(list.text);
  if (prevBottles > 20 && newBottles < prevBottles * 0.5) {
    writeText_('List.pending.csv', list.text);
    saveJson_('pending.json', { time: now, bottles: newBottles, previous: prevBottles });
    entry.ok = false;
    entry.warnings.push('Ny eksport har ' + newBottles + ' flasker mod ' + prevBottles + ' sidst. Den er lagt til godkendelse og har ikke erstattet beholdningen.');
    entry.error = 'Mistænkeligt stort fald i beholdningen — afventer godkendelse.';
    finish_(st, entry); return entry;
  }

  TABLES.forEach(function (t) {
    const r = fetched[t];
    if (r && r.ok) writeText_(t + '.csv', r.text);
    else if (t !== REQUIRED) entry.warnings.push(t + ': ' + (r && r.error || 'ikke hentet') + ' (tidligere data bevaret, hvis de findes).');
  });
  commitList_(list.text, now, entry);
  entry.ok = true;
  entry.bottles = newBottles;
  st.lastSuccess = now;
  finish_(st, entry);
  return entry;
}

function approvePending_() {
  const txt = readText_('List.pending.csv');
  if (!txt) return { ok: false, error: 'Der er ingen eksport til godkendelse.' };
  const now = new Date().toISOString();
  const entry = { time: now, ok: true, tables: { List: { rows: csv_(txt).length - 1 } }, warnings: ['Godkendt manuelt efter stort fald.'] };
  writeText_('List.csv', txt);
  commitList_(txt, now, entry);
  deleteFile_('List.pending.csv'); deleteFile_('pending.json');
  const st = readJson_('status.json', {}); st.lastSuccess = now;
  finish_(st, entry);
  return { ok: true };
}

function finish_(st, entry) {
  saveJson_('status.json', st);
  const log = readJson_('log.json', []);
  log.unshift(entry);
  saveJson_('log.json', log.slice(0, MAX_LOG));
}

function fetchTable_(table, user, pass) {
  const url = CT_URL + '?User=' + encodeURIComponent(user) + '&Password=' + encodeURIComponent(pass) +
    '&Format=csv&Table=' + table + (table === 'List' ? '&Location=1' : '');
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  const code = res.getResponseCode();
  if (code !== 200) return { ok: false, error: 'HTTP ' + code };
  let text = res.getContentText('windows-1252');
  if (/Ã[\u0080-ÿ]/.test(text)) text = res.getContentText('UTF-8');
  text = text.replace(/^﻿/, '');
  const head = text.slice(0, 400).toLowerCase();
  if (head.indexOf('<html') >= 0 || head.indexOf('<!doctype') >= 0 || head.indexOf('<head') >= 0) {
    return { ok: false, error: 'CellarTracker svarede med en webside i stedet for data (forkert login eller tabellen findes ikke).' };
  }
  const rows = csv_(text);
  if (!rows.length) return { ok: true, text: text, rows: 0, cols: 0 };
  if (table === 'List' && (rows[0].indexOf('iWine') < 0 || rows[0].indexOf('Quantity') < 0)) {
    return { ok: false, error: 'Uventet format: kolonnerne iWine/Quantity mangler.' };
  }
  return { ok: true, text: text, rows: rows.length - 1, cols: rows[0].length };
}

/** Gemmer en observation af beholdningen, når den har ændret sig. */
function commitList_(text, now, entry) {
  const rows = csv_(text);
  const h = rows[0];
  const ix = function (n) { return h.indexOf(n); };
  const iW = ix('iWine'), iQ = ix('Quantity'), iS = ix('Size'), iP = ix('Price');
  const map = {};
  const catalog = readJson_('catalog.json', {});
  const keep = ['Wine', 'Vintage', 'Producer', 'Country', 'Region', 'SubRegion', 'Appellation', 'Color', 'Type', 'Category', 'MasterVarietal', 'Varietal', 'Size', 'Designation', 'Vineyard', 'Locale'];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const id = row[iW]; if (!id) continue;
    const q = num_(row[iQ]); const size = row[iS] || '';
    const k = id + '|' + size;
    if (!map[k]) map[k] = [id, size, 0, num_(row[iP])];
    map[k][2] += q;
    const c = {}; keep.forEach(function (n) { if (ix(n) >= 0) c[n] = row[ix(n)]; });
    catalog[id] = c;
  }
  saveJson_('catalog.json', catalog);
  const snap = Object.keys(map).sort().map(function (k) { return map[k]; }).filter(function (r) { return r[2] > 0; });
  const hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(snap)));
  const hist = readJson_('history.json', []);
  const last = hist[hist.length - 1];
  if (last && last.h === hash) {
    last.seen = now;
    entry.observation = 'uændret';
  } else {
    hist.push({ d: now, seen: now, h: hash, r: snap });
    entry.observation = 'ny observation';
  }
  saveJson_('history.json', hist.slice(-MAX_SNAPSHOTS));
}

function bottles_(text) {
  const rows = csv_(text); if (!rows.length) return 0;
  const iQ = rows[0].indexOf('Quantity'); if (iQ < 0) return 0;
  let s = 0; for (let r = 1; r < rows.length; r++) s += num_(rows[r][iQ]);
  return s;
}

function num_(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}

function csv_(text) {
  try { return Utilities.parseCsv(text); } catch (e) { return []; }
}

/* ------------------------------------------------------------ Drive-lager */

function folder_() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* oprettes igen */ } }
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  const f = it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
  p.setProperty('FOLDER_ID', f.getId());
  return f;
}
function file_(name) { const it = folder_().getFilesByName(name); return it.hasNext() ? it.next() : null; }
function readText_(name) { const f = file_(name); return f ? f.getBlob().getDataAsString('UTF-8') : ''; }
function writeText_(name, text) {
  const f = file_(name);
  if (f) f.setContent(text); else folder_().createFile(name, text, 'text/plain');
}
function deleteFile_(name) { const f = file_(name); if (f) f.setTrashed(true); }
function readJson_(name, dflt) { const s = readText_(name); if (!s) return dflt; try { return JSON.parse(s); } catch (e) { return dflt; } }
function saveJson_(name, obj) { writeText_(name, JSON.stringify(obj)); }

/* ------------------------------------------------------------ Mad og vin (valgfri) */

/**
 * Madmatch via Claude. Dashboardet sender retten og de vin-ID'er, der er
 * tilladt efter de aktive filtre. Scriptet slår vinene op i den seneste
 * beholdning, sender kun de nødvendige vindata til modellen, og godkender
 * kun svar, hvor ID'et findes i det udleverede udsnit med flasker tilbage.
 */
function pair_(req) {
  const provider = aiProvider_();
  if (!provider) return { ok: false, error: 'Mad og vin er ikke slået til: GEMINI_API_KEY eller ANTHROPIC_API_KEY mangler i Scriptegenskaber.' };
  const dish = String(req.dish || '').slice(0, 4000).trim();
  if (!dish) return { ok: false, error: 'Skriv retten eller menuen først.' };

  const text = readText_('List.csv');
  if (!text) return { ok: false, error: 'Der er endnu ingen beholdning hentet.' };
  const rows = csv_(text); const h = rows[0];
  const ix = function (n) { return h.indexOf(n); };
  const allowed = req.ids && req.ids.length ? new Set(req.ids.map(String)) : null;
  const qtyOverride = req.qty || {}; // lokationsfiltrerede antal fra dashboardet
  const cands = {};
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]; const id = row[ix('iWine')];
    if (!id || (allowed && !allowed.has(id))) continue;
    const q = num_(row[ix('Quantity')]); if (q <= 0) continue;
    if (!cands[id]) cands[id] = { id: id, wine: row[ix('Wine')], vintage: row[ix('Vintage')] === '1001' ? 'NV' : row[ix('Vintage')],
      producer: row[ix('Producer')], type: row[ix('Type')], grape: row[ix('Varietal')], origin: row[ix('Locale')], qty: 0, size: row[ix('Size')] };
    cands[id].qty += q;
  }
  Object.keys(qtyOverride).forEach(function (id) { if (cands[id]) cands[id].qty = Math.min(cands[id].qty, num_(qtyOverride[id])); });
  const list = Object.keys(cands).map(function (k) { return cands[k]; }).filter(function (c) { return c.qty > 0; });
  if (!list.length) return { ok: true, picks: [], note: 'Ingen vine i beholdningen matcher de valgte filtre.' };

  const lines = list.map(function (c) {
    return [c.id, c.producer, c.wine, c.vintage, c.type, c.grape, c.origin, c.qty + ' fl.', c.size].join(' | ');
  }).join('\n');

  const system = 'Du er en erfaren dansk sommelier, der vælger vin fra en privat kælder til en konkret ret. ' +
    'Du må KUN vælge vine fra listen, og du skal angive deres ID præcist som i listen. ' +
    'Begrund kort og fagligt på dansk, med udgangspunkt i rettens afgørende elementer (råvare, tilberedning, sauce, syre, fedme, krydring). ' +
    'Påstå ikke specifik vinifikation, fadlagring, modenhed, drikkevindue eller blendprocenter, som ikke fremgår af data; nævn i stedet usikkerheden som forbehold. ' +
    'Ingen matchprocenter. Vælg 3-5 vine, gerne et klassisk, et alternativt og et mere utraditionelt valg, hvis kælderen rummer dem. ' +
    'Hvis kun få eller ingen vine passer, så sig det ærligt og vælg færre.';
  const messages = [];
  (req.history || []).slice(-8).forEach(function (m) {
    if (m && (m.role === 'user' || m.role === 'assistant') && m.text) messages.push({ role: m.role, content: String(m.text).slice(0, 4000) });
  });
  messages.push({ role: 'user', content: 'Ret/ønsker:\n' + dish + '\n\nVine i kælderen (ID | producent | vin | årgang | type | drue | oprindelse | antal | størrelse):\n' + lines });

  const r = provider === 'gemini' ? callGemini_(system, messages) : callClaude_(system, messages);
  if (!r.ok) return r;
  const out = r.out;

  const valid = [], rejected = [];
  (out.picks || []).forEach(function (p) {
    const c = cands[String(p.id)];
    if (c && c.qty > 0 && !valid.some(function (v) { return v.id === c.id; })) valid.push({ id: c.id, role: p.role, why: p.why, caveat: p.caveat, qty: c.qty });
    else rejected.push(String(p.id));
  });
  return { ok: true, picks: valid.slice(0, 6), rejected: rejected, note: out.note || '', candidates: list.length, usage: r.usage };
}

function aiProvider_() {
  const p = PropertiesService.getScriptProperties();
  const force = String(p.getProperty('AI_PROVIDER') || '').toLowerCase();
  const hasC = !!p.getProperty('ANTHROPIC_API_KEY'), hasG = !!p.getProperty('GEMINI_API_KEY');
  if (force === 'gemini' && hasG) return 'gemini';
  if (force === 'claude' && hasC) return 'claude';
  return hasC ? 'claude' : hasG ? 'gemini' : '';
}

const PICK_SCHEMA = {
  type: 'object',
  properties: {
    picks: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' },
      role: { type: 'string', enum: ['klassisk', 'alternativ', 'utraditionel', 'andet'] },
      why: { type: 'string' },
      caveat: { type: 'string' }
    }, required: ['id', 'role', 'why', 'caveat'], additionalProperties: false } },
    note: { type: 'string' }
  },
  required: ['picks', 'note'],
  additionalProperties: false
};

function parseJson_(txt) {
  txt = String(txt || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(txt); } catch (e) {
    const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(txt.slice(a, b + 1)); } catch (e2) { /* */ } }
    return null;
  }
}

function callClaude_(system, messages) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  const body = {
    model: AI_MODEL, max_tokens: 16000, system: system, messages: messages, fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: PICK_SCHEMA } }
  };
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2026-10-21', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
    payload: JSON.stringify(body)
  });
  const code = res.getResponseCode();
  let data; try { data = JSON.parse(res.getContentText()); } catch (e) { data = {}; }
  if (code !== 200) return { ok: false, error: 'Claude svarede med fejl ' + code + (data.error && data.error.message ? ': ' + data.error.message : '') + '. Prøv igen senere.' };
  if (data.stop_reason === 'refusal') return { ok: false, error: 'AI-tjenesten afviste forespørgslen. Prøv at formulere retten anderledes.' };
  const out = parseJson_((data.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join(''));
  if (!out) return { ok: false, error: 'AI-svaret kunne ikke læses. Prøv igen.' };
  const u = data.usage || {};
  return { ok: true, out: out, usage: { input: u.input_tokens || 0, output: u.output_tokens || 0, model: data.model || AI_MODEL, provider: 'Claude' } };
}

/** Gemini via Google AI Studio. Gratisudgaven har dagskvoter og kan ændres af Google uden varsel. */
function callGemini_(system, messages) {
  const p = PropertiesService.getScriptProperties();
  const apiKey = p.getProperty('GEMINI_API_KEY');
  const model = p.getProperty('GEMINI_MODEL') || GEMINI_DEFAULT;
  const body = {
    systemInstruction: { parts: [{ text: system + ' Svar KUN med JSON på formen {"picks":[{"id":"…","role":"klassisk|alternativ|utraditionel|andet","why":"…","caveat":"…"}],"note":"…"}.' }] },
    contents: messages.map(function (m) { return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }; }),
    generationConfig: { responseMimeType: 'application/json', temperature: 0.4 }
  };
  const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-goog-api-key': apiKey }, payload: JSON.stringify(body)
  });
  const code = res.getResponseCode();
  let data; try { data = JSON.parse(res.getContentText()); } catch (e) { data = {}; }
  if (code === 429) return { ok: false, error: 'Geminis gratiskvote er brugt op for nu. Prøv igen senere (kvoten nulstilles dagligt).' };
  if (code !== 200) return { ok: false, error: 'Gemini svarede med fejl ' + code + (data.error && data.error.message ? ': ' + data.error.message : '') + '. Tjek GEMINI_API_KEY og GEMINI_MODEL.' };
  const cand = (data.candidates || [])[0];
  if (!cand || !cand.content) return { ok: false, error: 'Gemini returnerede intet svar' + (data.promptFeedback && data.promptFeedback.blockReason ? ' (' + data.promptFeedback.blockReason + ')' : '') + '. Prøv igen.' };
  const out = parseJson_((cand.content.parts || []).map(function (x) { return x.text || ''; }).join(''));
  if (!out) return { ok: false, error: 'Gemini-svaret kunne ikke læses. Prøv igen.' };
  const u = data.usageMetadata || {};
  return { ok: true, out: out, usage: { input: u.promptTokenCount || 0, output: u.candidatesTokenCount || 0, model: data.modelVersion || model, provider: 'Gemini' } };
}
