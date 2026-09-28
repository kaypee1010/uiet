/**
 * RPE live-poll backend for "The Machine That Writes Papers" (K.P. Singh, RS-9003).
 * Google Apps Script web app bound to a Google Sheet.
 *
 * SET-UP (5 minutes)
 *  1. Create a blank Google Sheet. Extensions -> Apps Script. Replace the default code with this file.
 *  2. Change PRESENTER_PIN below (4-8 characters). The same PIN goes in the deck's LIVE config.
 *  3. Deploy -> New deployment -> type "Web app" -> Execute as: Me -> Who has access: Anyone -> Deploy.
 *     Copy the ".../exec" URL into LIVE.api in RPE_Machine_slides.html.
 *  4. Open the deck once with ?pin=YOURPIN (or paste it when asked). Press "Reset session" on slide 2
 *     before the talk starts. Tabs (Players, Answers, State) are created automatically.
 *
 * ENDPOINTS (all JSON)
 *  GET  ?action=state                       -> live state + per-question counts + joined count
 *  GET  ?action=leaderboard                 -> top players
 *  POST {action:"join", name}               -> {id, name}
 *  POST {action:"answer", id, name, q, choice} -> {accepted}
 *  POST {action:"control", pin, cmd, q}     -> cmd = open | close | reveal | final | reset
 *
 * The answer key lives here (QUESTIONS). Points: quiz questions 100 for a correct answer + up to 50 speed bonus
 * (bonus falls to 0 over 25 s). Opinion polls: 10 points for taking part. One answer per player per question.
 */

var PRESENTER_PIN = 'rpe2026';          // <-- change this

var QUESTIONS = {
  // kind: 'quiz' (has a correct option index) or 'poll' (opinion, participation points only)
  q1: { kind: 'quiz', ans: 2 },   // "bosom peril"  = breast cancer
  q2: { kind: 'quiz', ans: 1 },   // "profound neural organization" = deep neural network
  q3: { kind: 'quiz', ans: 3 },   // "flag to clamor" = signal to noise
  q4: { kind: 'quiz', ans: 1 },   // sign of a paper-mill product
  q5: { kind: 'poll' },           // human or machine (opinion; the reveal is on the slide)
  q6: { kind: 'poll' },           // can ChatGPT be a co-author (opinion, then reveal)
  q7: { kind: 'quiz', ans: 2 },   // who qualifies as an author
  q8: { kind: 'poll' }            // where do you draw the line
};

var QUIZ_POINTS = 100, SPEED_BONUS = 50, SPEED_WINDOW_MS = 25000, POLL_POINTS = 10;

// ---------- sheet helpers ----------
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function sheet_(name, header) {
  var s = ss_().getSheetByName(name);
  if (!s) { s = ss_().insertSheet(name); s.appendRow(header); s.setFrozenRows(1); }
  return s;
}
function players_() { return sheet_('Players', ['id', 'name', 'joinedAt']); }
function answers_() { return sheet_('Answers', ['ts', 'id', 'name', 'q', 'choice', 'correct', 'points', 'ms']); }
function stateSheet_() { return sheet_('State', ['key', 'value']); }

function getState_() {
  var cache = CacheService.getScriptCache();
  var raw = cache.get('state');
  if (raw) return JSON.parse(raw);
  var st = { open: '', openedAt: 0, reveal: false, session: 1 };
  var rows = stateSheet_().getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var k = rows[i][0], v = rows[i][1];
    if (k === 'open') st.open = String(v || '');
    if (k === 'openedAt') st.openedAt = Number(v) || 0;
    if (k === 'reveal') st.reveal = String(v) === 'true';
    if (k === 'session') st.session = Number(v) || 1;
  }
  cache.put('state', JSON.stringify(st), 600);
  return st;
}
function setState_(st) {
  var s = stateSheet_();
  s.getRange(2, 1, 4, 2).setValues([['open', st.open], ['openedAt', st.openedAt], ['reveal', String(st.reveal)], ['session', st.session]]);
  CacheService.getScriptCache().put('state', JSON.stringify(st), 600);
}

function counts_() {
  // counts per question per choice, from the Answers sheet (session-scoped via reset = clear)
  var rows = answers_().getDataRange().getValues(), out = {};
  for (var i = 1; i < rows.length; i++) {
    var q = String(rows[i][3]), c = String(rows[i][4]);
    if (!q) continue;
    out[q] = out[q] || {};
    out[q][c] = (out[q][c] || 0) + 1;
  }
  return out;
}

function leaderboard_() {
  var rows = answers_().getDataRange().getValues(), by = {};
  for (var i = 1; i < rows.length; i++) {
    var id = String(rows[i][1]), name = String(rows[i][2]), pts = Number(rows[i][6]) || 0;
    if (!id) continue;
    if (!by[id]) by[id] = { name: name, pts: 0, n: 0, correct: 0 };
    by[id].pts += pts; by[id].n += 1; if (String(rows[i][5]) === 'true') by[id].correct += 1;
  }
  var list = Object.keys(by).map(function (k) { return by[k]; });
  list.sort(function (a, b) { return b.pts - a.pts || b.correct - a.correct || a.name.localeCompare(b.name); });
  return list.slice(0, 15);
}

// ---------- HTTP ----------
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'state';
  try {
    if (action === 'state') {
      var st = getState_();
      return json_({ ok: true, open: st.open, openedAt: st.openedAt, reveal: st.reveal, session: st.session,
        counts: counts_(), joined: Math.max(0, players_().getLastRow() - 1), serverNow: Date.now() });
    }
    if (action === 'leaderboard') return json_({ ok: true, top: leaderboard_() });
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) { return json_({ ok: false, error: String(err) }); }
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (err) { return json_({ ok: false, error: 'bad json' }); }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(8000);
    if (body.action === 'join') return json_(join_(body));
    if (body.action === 'answer') return json_(answer_(body));
    if (body.action === 'control') return json_(control_(body));
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) { return json_({ ok: false, error: String(err) }); }
  finally { try { lock.releaseLock(); } catch (e2) {} }
}

function clean_(s, max) { return String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max || 40); }

function join_(b) {
  var name = clean_(b.name, 24);
  if (!name) return { ok: false, error: 'name required' };
  var id = clean_(b.id, 32) || Utilities.getUuid().slice(0, 8);
  var p = players_(), rows = p.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) if (String(rows[i][0]) === id) return { ok: true, id: id, name: String(rows[i][1]) };
  p.appendRow([id, name, new Date()]);
  return { ok: true, id: id, name: name };
}

function answer_(b) {
  var st = getState_();
  var q = clean_(b.q, 8), choice = Number(b.choice), id = clean_(b.id, 32), name = clean_(b.name, 24);
  if (!id || !q || isNaN(choice)) return { ok: false, error: 'bad answer' };
  if (st.open !== q) return { ok: true, accepted: false, reason: 'closed' };
  var a = answers_(), rows = a.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) if (String(rows[i][1]) === id && String(rows[i][3]) === q) return { ok: true, accepted: false, reason: 'already' };
  var def = QUESTIONS[q] || { kind: 'poll' }, now = Date.now(), ms = Math.max(0, now - st.openedAt);
  var correct = def.kind === 'quiz' && def.ans === choice, pts = 0;
  if (def.kind === 'quiz') { if (correct) pts = QUIZ_POINTS + Math.round(SPEED_BONUS * Math.max(0, 1 - ms / SPEED_WINDOW_MS)); }
  else pts = POLL_POINTS;
  a.appendRow([new Date(now), id, name, q, choice, String(correct), pts, ms]);
  return { ok: true, accepted: true };
}

function control_(b) {
  if (String(b.pin) !== PRESENTER_PIN) return { ok: false, error: 'bad pin' };
  var st = getState_(), cmd = String(b.cmd || '');
  if (cmd === 'open') { st.open = clean_(b.q, 8); st.openedAt = Date.now(); st.reveal = false; }
  else if (cmd === 'close') { st.open = ''; }
  else if (cmd === 'reveal') { st.open = ''; st.reveal = true; }
  else if (cmd === 'final') { st.open = 'final'; st.reveal = false; }   // phones show the final standings
  else if (cmd === 'reset') {
    var a = answers_(), p = players_();
    if (a.getLastRow() > 1) a.deleteRows(2, a.getLastRow() - 1);
    if (p.getLastRow() > 1) p.deleteRows(2, p.getLastRow() - 1);
    st = { open: '', openedAt: 0, reveal: false, session: (st.session || 1) + 1 };
  }
  else return { ok: false, error: 'unknown cmd' };
  setState_(st);
  return { ok: true, state: st };
}
