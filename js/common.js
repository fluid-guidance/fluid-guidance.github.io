// FLUID site — shared helpers (no dependencies). h(), fmtTime, bisect and the tooltip follow viz_server/public/js/util.js.
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v; else el.setAttribute(k, v);
  }
  for (const c of children.flat()) { if (c === null || c === undefined || c === false) continue; el.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return el;
}
function fmtTime(sec, frac = false) {
  if (sec === null || sec === undefined || isNaN(sec)) return '–:––';
  sec = Math.max(0, sec); const m = Math.floor(sec / 60), s = sec % 60;
  return frac ? `${m}:${s.toFixed(1).padStart(4, '0')}` : `${m}:${Math.floor(s).toString().padStart(2, '0')}`;
}
// Session time as m:ss (frac = 0) or m:ss.ss (frac = 2): the format of the timeline ruler, the readouts and the records.
function fmtClock(sec, frac = 0) {
  if (sec === null || sec === undefined || isNaN(sec)) return '–:––';
  const k = 10 ** frac, r = frac ? Math.round(Math.max(0, sec) * k) / k : Math.floor(Math.max(0, sec));
  const m = Math.floor(r / 60), s = r - m * 60;
  return `${m}:${frac ? s.toFixed(frac).padStart(3 + frac, '0') : String(s).padStart(2, '0')}`;
}
const fmtS = t => (t === null || t === undefined) ? '–' : `${Number(t).toFixed(2)} s`;
function bisect(arr, t, key) { let lo = 0, hi = arr.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (key(arr[mid]) < t) lo = mid + 1; else hi = mid; } return lo; }
async function loadJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); }
const tooltip = {
  el: null,
  show(html, x, y) { if (!this.el) { this.el = h('div', { id: 'tooltip' }); document.body.append(this.el); } this.el.innerHTML = html; this.el.hidden = false;
    const r = this.el.getBoundingClientRect(); let left = x + 14, top = y + 16; if (left + r.width > innerWidth - 8) left = x - r.width - 10; if (top + r.height > innerHeight - 8) top = y - r.height - 10; this.el.style.left = left + 'px'; this.el.style.top = top + 'px'; },
  hide() { if (this.el) this.el.hidden = true; },
};
function bindTooltip(el, htmlFn) { el.addEventListener('mouseenter', e => tooltip.show(htmlFn(), e.clientX, e.clientY)); el.addEventListener('mousemove', e => tooltip.show(htmlFn(), e.clientX, e.clientY)); el.addEventListener('mouseleave', () => tooltip.hide()); }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---- vocabularies (names as in the paper) ----
const LABEL_NAMES = { U1: 'Information request', U2: 'Verification question', U3: 'Clarification request', U4: 'Answer', U5: 'Acknowledgment / uptake', U6: 'Task narration', U7: 'Trouble report', U8: 'Affective / social talk', U9: 'Filler / hesitation', U10: 'Backchanneling', U11: 'Meta-communication',
  I1: 'Answer', I2: 'Approval', I3: 'Instruction', I4: 'Advisory', I5: 'Question to user', I6: 'Reassurance', I7: 'Pacing / closure', I8: 'Environmental repair', I9: 'Correction', I10: 'Acknowledgment', I11: 'Backchanneling', I12: 'Filler / self-repair', I13: 'Other' };
const TYPE_LABEL = { ERROR: 'Error', STEP_DONE: 'Step done', PROGRESS_OK: 'Progress OK', USER_QUERY: 'User query', USER_REPORT: 'User report', STUCK: 'Stuck', VISIBILITY: 'Visibility', UNCLEAR_STATE: 'Unclear state', RECOVERY: 'Recovery', DIALOG_OTHER: 'Dialogue', SELF: 'Self-repair', NONE: 'None' };
const POLICY_GLYPH = { NECESSARY: '✓', OPTIONAL: '◐', EXCLUDED: '✗' };
const POLICY_WORD = { NECESSARY: 'necessary', OPTIONAL: 'optional', EXCLUDED: 'excluded' };
const ANCHOR_LABEL = { es: 't_early', eo: 't_evid', r: 't_usr', lu: 't_latest' };
const ANCHOR_LONG = { es: 'early start: the earliest sign that an intervention may be needed', eo: 'evidence onset: enough evidence to intervene, the preferred time to speak', r: 'evidence onset of a reactive intervention: the user finished speaking, the preferred time to answer', lu: 'latest useful time (exclusive)' };
const SYSTEM_ORDER = ['FLUID', 'ProAssist', 'VideoLLM-online', 'JoyAI', 'Gemini'];
const OUTCOME_LABEL = { correct: 'correct', mistimed: 'mistimed', wrong: 'wrong', silent: 'silent', spoke: 'spoke', unmatched: 'not matched' };
function anchorsOf(iv) { const a = iv.anchors || {}; return (iv.side === 'reactive' ? ['r', 'lu'] : ['es', 'eo', 'lu']).filter(k => a[k] != null).map(k => ({ key: k, t: a[k], label: ANCHOR_LABEL[k], long: ANCHOR_LONG[k] })); }
function windowOf(iv) { const a = iv.anchors || {}; const start = iv.side === 'reactive' ? a.r : (a.es ?? a.eo); return (start != null && a.lu != null) ? [start, a.lu] : null; }
function fmtNum(x, d = 3) { return (x === null || x === undefined) ? '–' : Number(x).toFixed(d); }
