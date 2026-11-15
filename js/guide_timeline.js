// FLUID site — GuideTimeline: the four-layer timeline of the title-block demo and of the case browser, drawn with the
// notation of the paper's overview figure. Four rows on one pixel-scaled time axis (opts.pps pixels per second):
//   User Utterance (Layer 1) · Action & State (Layer 2) · Evidence Onset & Intervention Window (Layers 3 and 4) ·
//   Instructor Utterance (Layer 1).
// Every block is its bar: the released annotation verbatim (utterance text, action or state description) inside the span
// of time it occupies, wrapped onto up to three lines; nothing is paraphrased, and the dataset labels (taxonomy, validity,
// attributes) are in the record that a hover or keyboard focus opens, not on the track. When a text is wider than its
// bar even on three lines, the box grows past the bar (class 'over': an outlined box whose filled part is the bar).
// Blocks are packed into up to four lanes by the room their boxes take, so boxes never collide.
// Each scored intervention is drawn as a window bar with its anchors as flag pins (t_early yellow; t_evid and t_usr,
// the evidence onset, green; t_latest red; named in the legend) and its Layer 3 labels, and is tied to its evidence and to the instructor's
// turn by green trigger links read from the trigger row (events[].id and the target utterance), never from proximity.
// Playback, seeking and hovering focus one intervention: its evidence, window, instructor turn and links. Clicking any
// block seeks the video and names the intervention it belongs to (opts.onSelect). Times are session seconds as released;
// the clip's own time is session time minus range[0].
// The track is exactly as long as the clip: the clips start at a complete block (build_showcase.py), so only a step-long
// action or window can be cut, at the end; a box that would run past the clip's end is laid out to the left of its bar's
// end instead (class 'edge'), so nothing spills.
'use strict';
const GuideTimeline = (() => {
  // Metrics at the page's scale of the evening of 2026-10-26 (0.85 of the earlier ones, with the 14 px block text): a change
  // of the block type must change CH, PADH, blockH, the lane and window metrics and PPS (home.js) together.
  const LANE = { ruler: 26, win: 58, sys: 50 };
  const WIN = { bar: 24, barH: 6, pinH: 15, chipTop: 32, chipH: 18 };   // vertical layout inside a window lane: 9 px above the pins for the arrowheads, the chips 2 px under the bar, 8 px under the chips for the links to the instructor
  const PAD = 2;                   // vertical padding of a block inside its lane
  const CH = 7.15, CHT = 7.8;      // average advance of a 13 px medium (text) and 12 px bold (chip) Noto Sans character
  const LINES = 2, PADH = 20;      // a text wraps onto up to two lines inside its bar (three until late 2026-10-26); the horizontal padding and border of a box
  const blockH = n => 6 + n * 16;              // height of a block whose text takes n lines (16 px lines, 3 px above and below)
  const laneFor = n => blockH(n) + 2 * PAD;    // lane height for a row whose longest text needs n lines
  const ROW = { user: 'User Utterance', act: 'Action & State', win: 'Evidence Onset & Intervention Window', instr: 'Instructor Utterance' };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const clock = t => fmtClock(t, 2);
  const span2 = (t0, t1) => `${clock(t0)} – ${clock(t1)}`;
  const up = s => String(s || '').toUpperCase();
  const ANAME = { es: ['t', 'early'], eo: ['t', 'evid'], r: ['t', 'usr'], lu: ['t', 'latest'] };
  const anchorName = k => `<i>t</i><sub>${ANAME[k][1]}</sub>`;
  function scored(iv) { return !!(iv && iv.target && (iv.policy === 'NECESSARY' || iv.policy === 'OPTIONAL') && (iv.side === 'reactive' || iv.side === 'proactive')); }
  function windowOf(iv) { const a = iv.anchors || {}; const w0 = iv.side === 'reactive' ? a.r : (a.es ?? a.eo); return (w0 != null && a.lu != null && a.lu > w0) ? [w0, a.lu] : null; }
  // A short reading of an evidence event for prose (the case cards); the timeline itself shows the full text.
  function shortEvidence(e) {
    if (e.kind === 'utterance') return `“${e.text}”`;
    let t = String(e.text || '').trim();
    t = t.replace(/^(the|a)\s+(user|person)('s)?\s+/i, '').replace(/^user('s)?\s+/i, '');
    t = t.replace(/,?\s+(with|using)\s+(both|their|his|her|the|one)\s+(left |right |other )?hands?\b/gi, '');
    t = t.replace(/[.。]\s*$/, '');
    if (e.kind === 'state_event' && e.state_label) t = e.state_label.toLowerCase().replace(/_/g, ' ') + ': ' + t;
    return t;
  }
  // The stretch of the clip during which an intervention is the current one: from its first evidence (or its window)
  // to the end of the instructor's turn. Long-running actions (whole-step blocks) do not pull the span back.
  function spanOf(iv) {
    const a = iv.anchors || {}, w = windowOf(iv);
    const starts = (iv.events || []).filter(e => e.t0 != null && (e.t1 - e.t0) < 15).map(e => e.t0);
    if (w) starts.push(w[0]); if (a.eo != null) starts.push(a.eo);
    const s0 = starts.length ? Math.min(...starts) : iv.target.t0;
    return [s0 - 0.2, Math.max(iv.target.t1, w ? w[1] : 0) + 0.5];
  }
  // How a text fits its bar: the fewest lines (up to LINES) on which it fits inside the bar. When it does not fit even on
  // LINES lines the box is wider than the bar (over) and as narrow as the wrap allows (a word never breaks). Returns the
  // lines, the pixel extent of the box, and alt, the narrower three-line layout used when the box has to end with the bar.
  function fit(text, bar) {
    const s = String(text || ''), words = s.split(/\s+/).filter(Boolean).map(w => Math.ceil(w.length * CH)), sp = Math.ceil(CH);
    const tp = words.reduce((x, y) => x + y, 0) + sp * Math.max(0, words.length - 1), longest = Math.max(1, ...words);
    // the words wrap greedily, a word never breaks: the lines a width gives, and the narrowest width for n lines
    const linesAt = w => { let n = 1, x = 0; for (const ww of words) { if (x === 0) x = ww; else if (x + sp + ww <= w) x += sp + ww; else { n++; x = ww; } } return n; };
    const widthFor = n => { if (n <= 1) return tp; let lo = longest, hi = tp; while (lo < hi) { const mid = (lo + hi) >> 1; if (linesAt(mid) <= n) hi = mid; else lo = mid + 1; } return lo; };
    const inner = bar - PADH;
    let lines = [1, 2, 3].find(n => widthFor(n) <= inner);
    const over = !lines;
    if (over) lines = widthFor(3) < widthFor(2) ? 3 : widthFor(2) < widthFor(1) ? 2 : 1;
    const extFor = n => Math.max(bar, widthFor(n) + PADH);
    return { lines, ext: extFor(lines), alt: over && lines < 3 && widthFor(3) < widthFor(lines) ? { lines: 3, ext: extFor(3) } : null };
  }
  // Where a block's box goes: from its bar's start, unless the box would run past the track's end (W), in which case the
  // box ends with the bar and the text is laid out to the left of it (class 'edge'); bx is the bar's offset in the box.
  function place(x0, bar, f, W) {
    if (x0 + f.ext <= W) return { x0, ext: f.ext, bx: 0, edge: false, lines: f.lines };
    const v = f.alt || f, ext = Math.min(v.ext, W), end = Math.min(W, Math.floor(x0 + bar)), left = Math.max(0, end - ext);
    return { x0: left, ext: end - left, bx: x0 - left, edge: true, lines: v.lines };
  }
  const shortName = s => String(s || '').replace(/\s*\/.*$/, '');
  // Lane packing by pixel extent: an item occupies [px0, px0 + ext) (px0 defaults to x0) and goes into the first lane that is free there.
  function pack(items, maxLanes) {
    const ends = [], out = [], L = it => it.px0 ?? it.x0;
    for (const it of [...items].sort((a, b) => L(a) - L(b) || b.ext - a.ext)) {
      let k = ends.findIndex(e => e <= L(it) + 2);
      if (k < 0) { if (ends.length < maxLanes) { k = ends.length; ends.push(0); } else { k = ends.indexOf(Math.min(...ends)); } }
      ends[k] = Math.max(ends[k], L(it) + it.ext); out.push({ ...it, lane: k });
    }
    return { items: out, n: Math.max(1, ends.length) };
  }
  const attrText = u => u && u.attributes ? Object.entries(u.attributes).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
  const typeText = iv => `Trigger Type: ${up(iv.type)}`;
  const policyText = iv => up(iv.policy);
  // One record (the hover / focus details) as escaped HTML lines: only what the track itself does not show (the label of
  // the utterance taxonomy with its attribute, a state's label, an action's task effects); windows have none (user request,
  // 2026-10-26 late: nothing visible on the track or in the cards is repeated here).
  const rec = (head, ...lines) => `<b>${esc(head)}</b>` + lines.filter(Boolean).map(l => `<br>${l}`).join('');
  const quote = s => `<q>${esc(s)}</q>`;
  const sess = (t0, t1) => `<span class="rec-s">${t0.toFixed(2)}–${t1.toFixed(2)} s of the session</span>`;
  let seq = 0;

  // data: a showcase case {range, utterances, actions, interventions}
  // opts: {pps, onSeek(t), onHover(rid|null), onSelect(rid): a block or window of that intervention was clicked,
  //        legend: show the legend (default true),
  //        userAll / actAll / instructorAll: show every turn or event in the clip, not only the evidence (default true),
  //        systems: [{name, label, utterances}] extra rows}
  function render(mount, data, opts = {}) {
    const pps = opts.pps || 96; const [r0, r1] = data.range, span = Math.max(0.1, r1 - r0);
    const PADX = 8, W = Math.ceil(span * pps) + 2 * PADX;   // the track: the clip plus an inset at both ends, so a pin or the playhead at the clip's bounds stays whole
    const X = t => clamp(PADX + (t - r0) * pps, PADX, W - PADX);
    const inRange = t => t >= r0 && t <= r1;
    const seek = t => { follow = true; manualUntil = 0; if (opts.onSeek) opts.onSeek(clamp(t, r0, r1)); };
    const ivs = (data.interventions || []).filter(scored).sort((a, b) => a.target.t0 - b.target.t0);
    const byRid = new Map(ivs.map(iv => [iv.rid, iv]));
    const ridOfUid = new Map(ivs.map(iv => [iv.uid, iv.rid]));
    // the trigger rows name a state event as 's:<aid>' in some rows and 'a:<aid>' in others: both are the action row's 'a:<aid>'
    const norm = id => (id[0] === 'u' || id[0] === 'i') ? id : 'a:' + id.slice(2);
    const evRids = new Map();   // event id -> rids of the interventions it is evidence of
    for (const iv of ivs) for (const e of iv.events || []) { const k = norm(e.id); if (!evRids.has(k)) evRids.set(k, []); evRids.get(k).push(iv.rid); }
    const ivLine = r => { const iv = byRid.get(r); return `${esc(r)}: ${esc(typeText(iv))} · ${esc(policyText(iv))} · ${iv.side}`; };
    const uid = ++seq;

    // ---- items ----
    const userItems = (data.utterances || []).filter(u => u.speaker === 'user' && u.t1 > r0 && u.t0 < r1 && (opts.userAll !== false || evRids.has('u:' + u.uid))).map(u => {
      const rids = evRids.get('u:' + u.uid) || []; const full = `${u.intent} ${LABEL_NAMES[u.intent] || ''}`.trim(), tag = `${u.intent} ${shortName(LABEL_NAMES[u.intent])}`.trim(), text = u.text;
      const bar = Math.max(6, X(u.t1) - X(u.t0)), f = fit(text, bar);
      return { kind: 'user', eid: 'u:' + u.uid, t0: u.t0, t1: u.t1, ...place(X(u.t0), bar, f, W), bar, tag, text, rids,
        rec: rec('User utterance', `${esc(full)}${attrText(u) ? ' · ' + esc(attrText(u)) : ''}`) };
    });
    const evMap = new Map();
    for (const iv of ivs) for (const e of iv.events || []) if (e.kind !== 'utterance' && e.t0 != null) evMap.set(norm(e.id), { ...e, id: norm(e.id) });
    // every item is keyed 'a:<aid>', the convention of the trigger rows' event ids for actions and state events alike
    const acts = opts.actAll !== false && data.actions ? data.actions.map(a => ({ id: 'a:' + a.aid, kind: a.kind, aid: a.aid, t0: a.t0, t1: a.t1, text: a.description, validity: a.validity, state_label: a.state_label, task_effects: a.task_effects })) : [...evMap.values()];
    for (const e of evMap.values()) if (!acts.some(a => a.id === e.id)) acts.push(e);
    const actItems = acts.filter(e => e.t0 != null && e.t1 > r0 && e.t0 < r1).map(e => {
      const st = e.kind === 'state_event'; const rids = evRids.get(e.id) || [];
      const tag = st ? `State: ${up(e.state_label || 'STATE')}` : `Validity: ${up(e.validity || 'UNKNOWN')}`; const text = e.text;
      const effects = e.task_effects && e.task_effects.length ? `Task effect: ${e.task_effects.map(up).join(', ')}` : '';
      const bar = Math.max(6, X(e.t1) - X(e.t0)), f = fit(text, bar);
      return { kind: 'act', eid: e.id, t0: e.t0, t1: e.t1, ...place(X(e.t0), bar, f, W), bar, tag, text, rids,
        rec: rec(st ? 'State' : 'Action', st ? esc(up(e.state_label || 'STATE')) : esc(effects)) };
    });
    const winItems = ivs.map(iv => ({ iv, w: windowOf(iv) })).filter(x => x.w && x.w[1] > r0 && x.w[0] < r1).map(x => {
      const [w0, lu] = x.w, iv = x.iv, a = iv.anchors || {}; const chips = [typeText(iv), policyText(iv)];
      const chipsPx = chips.reduce((s, c) => s + Math.ceil(c.length * CHT) + 22, 0) + 6;
      const anchors = iv.side === 'reactive' ? `${anchorName('r')} ${clock(a.r)} · ${anchorName('lu')} ${clock(a.lu)}` : `${anchorName('es')} ${clock(a.es ?? a.eo)} · ${anchorName('eo')} ${clock(a.eo ?? a.es)} · ${anchorName('lu')} ${clock(a.lu)}`;
      const ev = (iv.events || []).map(e => e.kind === 'utterance' ? quote(e.text) : esc(e.text)).join('; ');
      // the chips hang past the end of a short bar: the next window in the lane keeps clear of them; chips that would run
      // past the track's end are laid out to the left of the bar's end instead (edge), and the lane packing uses that box (px0)
      const x0 = X(w0), bar = Math.max(4, X(lu) - X(w0)), ext = Math.min(W, Math.max(X(lu) - X(w0), chipsPx)), edge = x0 + ext > W;
      return { iv, w: x.w, t0: w0, t1: lu, x0, bar, ext, px0: edge ? Math.max(0, x0 + bar - ext) : x0, edge, chips, chipsPx,
        rec: '' };
    });
    const instrItems = (data.utterances || []).filter(u => u.speaker === 'instructor' && u.t1 > r0 && u.t0 < r1 && (opts.instructorAll !== false || ridOfUid.has(u.uid))).map(u => {
      const rid = ridOfUid.get(u.uid), iv = rid ? byRid.get(rid) : null; const excl = !iv ? (data.interventions || []).find(x => x.uid === u.uid) : null;
      const full = `${u.intent} ${u.category || LABEL_NAMES[u.intent] || ''}`.trim(), tag = `${u.intent} ${shortName(u.category || LABEL_NAMES[u.intent])}`.trim(), text = u.text;
      const bar = Math.max(6, X(u.t1) - X(u.t0)), f = fit(text, bar);
      return { kind: 'instr' + (iv ? '' : ' unlinked'), eid: 'i:' + u.uid, t0: u.t0, t1: u.t1, ...place(X(u.t0), bar, f, W), bar, tag, text, rids: iv ? [iv.rid] : [],
        rec: rec('Instructor utterance', `${esc(full)}${attrText(u) ? ' · ' + esc(attrText(u)) : ''}`) };
    });
    const sysRows = (opts.systems || []).map(s => ({ s, items: (s.utterances || []).filter(u => (u.t_end ?? u.t + 1.5) > r0 && u.t < r1).map(u => {
      const t1 = u.t_end ?? u.t + 1.5, m = u.match || null, word = m ? m.word : 'unmatched';
      const bar = Math.max(6, X(t1) - X(u.t)), f = fit(u.text, bar);
      return { kind: 'sysblk ' + word, eid: 'sys:' + s.name + ':' + u.t, t0: u.t, t1, ...place(X(u.t), bar, f, W), bar, tag: up(word), text: u.text, rids: m ? [m.rid] : [],
        rec: rec(`${s.label || s.name} · ${span2(u.t, t1)}`, quote(u.text), m ? `${esc(word)} for ${esc(m.rid)}` : 'Not matched to an annotated intervention') }; }) }));

    // ---- rows and lanes: each block row is as tall as its lanes. The two utterance rows share one lane height (the longest
    // text of either row), so User Utterance and Instructor Utterance match; in Action & State each lane is as tall as its own
    // longest text, so a lane of short labels stays thin ----
    const winLane = LANE.win;
    const packed = { user: pack(userItems, 4), act: pack(actItems, 4), win: pack(winItems, 4), instr: pack(instrItems, 4) };
    const linesOf = items => Math.max(1, ...items.map(it => it.lines || 1));
    const lanesOf = (p, n) => Array.from({ length: p.n }, (_, k) => laneFor(n ?? linesOf(p.items.filter(it => it.lane === k))));
    const utt = Math.max(linesOf(userItems), linesOf(instrItems));
    const rows = [{ id: 'ruler', cls: 'ruler', lanes: [LANE.ruler] }];
    rows.push({ id: 'user', cls: 'user', lanes: lanesOf(packed.user, utt) });
    rows.push({ id: 'act', cls: 'act', lanes: lanesOf(packed.act) });
    rows.push({ id: 'win', cls: 'win', lanes: Array(packed.win.n).fill(winLane) });
    rows.push({ id: 'instr', cls: 'instr', lanes: lanesOf(packed.instr, utt) });
    for (const sr of sysRows) { sr.packed = pack(sr.items, 2); rows.push({ id: 'sys:' + sr.s.name, cls: 'sys', label: sr.s.label || sr.s.name, lanes: Array(sr.packed.n).fill(LANE.sys) }); }
    const labels = h('div', { class: 'gtl-labels' }), tracks = h('div', { class: 'gtl-tracks', style: `width:${W}px` });
    const rowEl = {}, rowTop = {}, laneHs = {}, laneTop = {}; let y = 0;   // per row: its top, its lane heights and the top of each lane within it
    for (const r of rows) {
      const hh = r.lanes.reduce((a, b) => a + b, 0); rowTop[r.id] = y; y += hh;
      laneHs[r.id] = r.lanes; laneTop[r.id] = r.lanes.map((_, k) => r.lanes.slice(0, k).reduce((a, b) => a + b, 0));
      const lab = h('div', { class: 'gtl-lab ' + r.cls, style: `height:${hh}px` });
      if (r.id === 'ruler') lab.append(h('span', { class: 'nm', text: 'Session time' }));
      else lab.append(h('span', { class: 'nm', text: ROW[r.id] || r.label }));
      labels.append(lab);
      const el = h('div', { class: 'gtl-row ' + r.cls, style: `height:${hh}px` }); tracks.append(el); rowEl[r.id] = el;
    }
    const H = y;

    // ---- blocks ----
    const timed = [], focusable = [], geom = new Map();   // event id -> the bar's rectangle in track coordinates
    let hoverRid = null, activeRid = null;
    const popover = (el, html) => { if (!html) return;
      el.addEventListener('mouseenter', e => tooltip.show(html, e.clientX, e.clientY)); el.addEventListener('mousemove', e => tooltip.show(html, e.clientX, e.clientY)); el.addEventListener('mouseleave', () => tooltip.hide());
      el.addEventListener('focus', () => { const b = el.getBoundingClientRect(); tooltip.show(html, b.left + 8, b.bottom - 8); }); el.addEventListener('blur', () => tooltip.hide());
    };
    function addBlock(row, it, seekT) {
      const cut = (it.t0 < r0 ? ' cut-l' : '') + (it.t1 > r1 ? ' cut-r' : '');
      // every box of a lane is as tall as the lane, its text centred; a text may wrap onto all the lines that height holds
      const laneH = laneHs[row][it.lane], top = laneTop[row][it.lane] + PAD, hh = laneH - 2 * PAD, rowLines = Math.max(1, Math.floor((hh - 6) / 16)), over = it.ext > it.bar + 0.5;
      const el = h('button', { type: 'button', class: 'gblk ' + it.kind + cut + (it.edge ? ' edge' : '') + (over ? ' over' : ''), style: `left:${it.x0}px;width:${it.ext}px;top:${top}px;height:${hh}px`, 'aria-label': `${it.tag}: ${it.text}` },
        h('i', { class: 'dur', style: `left:${it.bx}px;width:${it.bar}px` }), h('span', { class: 'tx' }, h('span', { class: 'tt', style: `-webkit-line-clamp:${rowLines}`, text: it.text })));
      if (it.rids.length) { el.dataset.rids = it.rids.join(' '); focusable.push(el); }
      geom.set(it.eid, { x0: it.x0 + it.bx, x1: it.x0 + it.bx + it.bar, y0: rowTop[row] + top, y1: rowTop[row] + top + hh, lane: it.lane });
      el.addEventListener('click', () => { seek(seekT ?? Math.max(r0, it.t0 - 0.25)); if (opts.onSelect && it.rids.length) opts.onSelect(it.rids[0]); });
      el.addEventListener('mouseenter', () => hover(it.rids[0])); el.addEventListener('mouseleave', () => hover(null));
      el.addEventListener('focus', () => hover(it.rids[0])); el.addEventListener('blur', () => hover(null));
      popover(el, it.rec);
      rowEl[row].append(el); timed.push({ el, t0: it.t0, t1: it.t1 }); return el;
    }
    // ruler: a tick every second, a label every 5 s as m:ss, minutes emphasised; click or drag to scrub
    { for (let t = Math.ceil(r0); t <= r1 + 1e-6; t += 1) { const major = t % 5 === 0, minute = t % 60 === 0; rowEl.ruler.append(h('div', { class: 'gtick' + (major ? ' major' : '') + (minute ? ' minute' : '') + (major && W - X(t) < 44 ? ' end' : ''), style: `left:${X(t)}px` }, major ? h('span', { text: fmtClock(t) }) : null)); }
      const at = e => { const b = rowEl.ruler.getBoundingClientRect(); return r0 + clamp((e.clientX - b.left - PADX) / (W - 2 * PADX), 0, 1) * span; };
      let scrub = false;
      rowEl.ruler.addEventListener('pointerdown', e => { scrub = true; rowEl.ruler.setPointerCapture(e.pointerId); seek(at(e)); });
      rowEl.ruler.addEventListener('pointermove', e => { if (scrub) seek(at(e)); });
      rowEl.ruler.addEventListener('pointerup', () => { scrub = false; }); rowEl.ruler.addEventListener('pointercancel', () => { scrub = false; }); }
    for (const it of packed.user.items) addBlock('user', it);
    for (const it of packed.act.items) addBlock('act', it);
    for (const it of packed.instr.items) addBlock('instr', it, it.t0);
    for (const sr of sysRows) for (const it of sr.packed.items) addBlock('sys:' + sr.s.name, it, it.t0);

    // ---- windows: a bar from the window start to t_latest, flag pins at the anchors, the Layer 3 labels beneath ----
    const winGeom = new Map();   // rid -> geometry of the window bar and its label chips
    const windows = [];
    for (const w of packed.win.items) {
      const iv = w.iv, a = iv.anchors || {}, [w0, lu] = w.w, optional = iv.policy === 'OPTIONAL';
      const cut = (w0 < r0 ? ' cut-l' : '') + (lu > r1 ? ' cut-r' : '');
      const laneTop = rowTop.win + w.lane * winLane, barTop = w.lane * winLane + WIN.bar;
      const el = h('button', { type: 'button', class: 'gwin ' + (optional ? 'optional' : 'necessary') + cut + (w.edge ? ' edge' : ''), style: `left:${w.x0}px;width:${w.bar}px;top:${barTop}px;height:${WIN.barH}px`, 'aria-label': `Intervention window ${iv.rid}, ${typeText(iv)}, ${policyText(iv)}`, dataset: { rids: iv.rid } });
      const pos = t => `${clamp((X(t) - w.x0), 0, w.bar)}px`;
      const pins = iv.side === 'reactive' ? [['r', a.r], ['lu', a.lu]] : [['es', a.es], ['eo', a.eo], ['lu', a.lu]];
      for (const [k, t] of pins) if (t != null && inRange(t)) el.append(h('i', { class: 'pin ' + k, style: `left:${pos(t)}`, 'aria-hidden': 'true' }));
      el.append(h('span', { class: 'wl', style: `width:${w.edge ? w.ext - 4 : w.ext}px` }, h('span', { class: 'wli' }, h('span', { class: 'k type', text: w.chips[0] }), h('span', { class: 'k pol ' + iv.policy.toLowerCase(), text: w.chips[1] }))));
      el.addEventListener('click', () => { seek(Math.max(r0, w0 - 0.4)); if (opts.onSelect) opts.onSelect(iv.rid); });
      el.addEventListener('mouseenter', () => hover(iv.rid)); el.addEventListener('mouseleave', () => hover(null)); el.addEventListener('focus', () => hover(iv.rid)); el.addEventListener('blur', () => hover(null));
      popover(el, w.rec);
      rowEl.win.append(el); timed.push({ el, t0: w0, t1: lu }); focusable.push(el); windows.push({ el, iv, w0, lu });
      winGeom.set(iv.rid, { x0: w.x0, x1: w.x0 + w.bar, barY0: laneTop + WIN.bar, barY1: laneTop + WIN.bar + WIN.barH, pinTop: laneTop + WIN.bar + WIN.barH / 2 - WIN.pinH, laneTop, laneBottom: laneTop + winLane, chipX1: w.edge ? w.x0 + w.bar : w.x0 + w.chipsPx, chipY1: laneTop + WIN.chipTop + WIN.chipH, pinX: t => clamp(X(t), w.x0, w.x0 + w.bar) });
    }

    // ---- trigger links (Layer 3): evidence → window → instructor, from the trigger row ----
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'gtl-links'); svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('aria-hidden', 'true');
    const defs = document.createElementNS(NS, 'defs'); const mk = document.createElementNS(NS, 'marker');
    // the arrowhead points along the path (a marker's x axis follows the path's direction), so it points down at the end of a vertical segment
    mk.setAttribute('id', `gtl-arrow-${uid}`); mk.setAttribute('viewBox', '0 0 10 10'); mk.setAttribute('refX', '9.5'); mk.setAttribute('refY', '5'); mk.setAttribute('markerWidth', '9'); mk.setAttribute('markerHeight', '9'); mk.setAttribute('markerUnits', 'userSpaceOnUse'); mk.setAttribute('orient', 'auto');
    const mp = document.createElementNS(NS, 'path'); mp.setAttribute('d', 'M0 0 L10 5 L0 10 z'); mp.setAttribute('class', 'lk-head'); mk.append(mp); defs.append(mk); svg.append(defs);
    const linkGroups = [];
    const path = (g, d, cls, arrow) => { const halo = document.createElementNS(NS, 'path'); halo.setAttribute('d', d); halo.setAttribute('class', 'lk-halo'); g.append(halo); const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', 'lk ' + cls); if (arrow) p.setAttribute('marker-end', `url(#gtl-arrow-${uid})`); g.append(p); };
    const dot = (g, x, y) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 4); c.setAttribute('class', 'lk-dot'); g.append(c); };
    const elbow = (x0, y0, ym, x1, y1) => Math.abs(x0 - x1) < 1 ? `M${x0} ${y0} V${y1}` : `M${x0} ${y0} V${ym} H${x1} V${y1}`;
    for (const { iv } of windows) {
      const wg = winGeom.get(iv.rid); if (!wg) continue;
      const a = iv.anchors || {}, cls = iv.policy === 'OPTIONAL' ? 'optional' : '';
      const g = document.createElementNS(NS, 'g'); g.dataset.rids = iv.rid; linkGroups.push(g);
      const prefT = iv.side === 'reactive' ? a.r : (a.eo ?? a.es);
      // evidence → the pin of the preferred anchor (t_usr for reactive, t_evid for proactive): down from the block, across just
      // under the row border, and down onto the pin with an arrowhead (every link ends in a vertical segment, so the heads point down)
      for (const e of iv.events || []) {
        const eg = geom.get(norm(e.id)); if (!eg) continue;   // the trigger row may name a state event 's:<aid>'
        const xe = e.kind === 'utterance' ? clamp(X(e.t1) - 5, eg.x0 + 5, Math.max(eg.x0 + 5, eg.x1 - 5)) : clamp(X(prefT ?? e.t1), eg.x0 + 6, Math.max(eg.x0 + 6, eg.x1 - 6));
        const xp = prefT != null && inRange(prefT) ? wg.pinX(prefT) : wg.x0;
        const yTop = eg.y1, yEnd = wg.pinTop - 1;
        dot(g, xe, yTop);
        path(g, elbow(xe, yTop, wg.laneTop + 1, xp, yEnd), cls, true);
      }
      // window → the instructor's turn
      const tg = iv.target && geom.get('i:' + iv.uid);
      if (tg) {
        const xi = clamp(X(iv.target.t0) + 6, wg.x0, wg.x1), xt = clamp(X(iv.target.t0) + 6, tg.x0 + 4, Math.max(tg.x0 + 4, tg.x1 - 4));
        const y0 = xi <= wg.chipX1 + 2 ? wg.chipY1 + 1 : wg.barY1 + 1;
        path(g, elbow(xi, y0, wg.laneBottom - 8, xt, tg.y0 - 2), cls, true);
      }
      svg.append(g);
    }
    tracks.append(svg);
    const playhead = h('div', { class: 'gtl-playhead', style: 'left:0px' }); tracks.append(playhead);

    // ---- legend ----
    const legend = opts.legend === false ? null : h('div', { class: 'gtl-legend' },
      h('span', { class: 'lg' }, h('i', { class: 'pin es' }), h('span', { html: anchorName('es') }), h('small', { text: 'early start' })),
      h('span', { class: 'lg' }, h('i', { class: 'pin eo' }), h('span', { html: `${anchorName('eo')} · ${anchorName('r')}` }), h('small', { text: 'evidence onset' })),
      h('span', { class: 'lg' }, h('i', { class: 'pin lu' }), h('span', { html: anchorName('lu') }), h('small', { text: 'latest useful' })),
      h('span', { class: 'lg' }, h('span', { class: 'lg-link', html: '<svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true"><path d="M1 6h20" stroke="#38761d" stroke-width="2.5" stroke-linecap="round"/><path d="M19 1l7 5-7 5z" fill="#38761d"/></svg>' }), h('span', { text: 'Trigger link' }), h('small', { text: 'evidence → instruction' })),
      h('span', { class: 'lg' }, h('i', { class: 'lg-bar' }), h('span', { text: 'NECESSARY' }), h('i', { class: 'lg-bar optional' }), h('span', { text: 'OPTIONAL' })));
    const scroll = h('div', { class: 'gtl-scroll' }, h('div', { class: 'gtl-inner' }, labels, tracks));
    const root = h('div', { class: 'gtl', role: 'group', 'aria-label': 'User utterances, actions and states, intervention windows and instructor utterances on one time axis' }, legend, scroll);
    mount.replaceChildren(root);

    // following: while the video plays the view moves continuously so the playhead stays about a third of the way in
    // (the clip glides under a fixed playhead); a seek glides the view to the new time; a manual scroll (wheel, touch,
    // scrollbar) pauses following for a few seconds. Reduced-motion users get instant moves.
    const smoothOK = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let follow = true, lastSet = -1, manualUntil = 0, gliding = false, glideRaf = 0;
    const viewW = () => scroll.clientWidth - labels.offsetWidth;
    const targetFor = x => clamp(x - viewW() * 0.3, 0, Math.max(0, W - viewW()));
    scroll.addEventListener('scroll', () => { if (gliding) return; if (lastSet >= 0 && Math.abs(scroll.scrollLeft - lastSet) > 2) manualUntil = Date.now() + 3000; });
    scroll.addEventListener('wheel', () => { manualUntil = Date.now() + 3000; }, { passive: true });
    scroll.addEventListener('touchmove', () => { manualUntil = Date.now() + 3000; }, { passive: true });
    // an eased glide driven by rAF, so the end of the move is known exactly and never mistaken for a manual scroll
    function glideTo(target) {
      target = Math.round(target); cancelAnimationFrame(glideRaf); lastSet = target;
      const from = scroll.scrollLeft, d = target - from;
      if (Math.abs(d) < 1) { gliding = false; return; }
      if (!smoothOK) { gliding = false; scroll.scrollLeft = target; return; }
      gliding = true; const dur = clamp(Math.abs(d) * 0.3, 200, 480), t0 = performance.now();
      const step = now => { const p = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 3); scroll.scrollLeft = from + d * e; if (p < 1) glideRaf = requestAnimationFrame(step); else { scroll.scrollLeft = target; lastSet = target; gliding = false; } };
      glideRaf = requestAnimationFrame(step);
    }
    function reveal(t, playing) {
      if (viewW() <= 0) return;
      const x = X(t);
      if (playing) { if (follow && Date.now() > manualUntil && !gliding) { const target = targetFor(x); if (Math.abs(target - scroll.scrollLeft) > 0.5) { lastSet = target; scroll.scrollLeft = target; } } }
      else if (Date.now() > manualUntil) { const left = scroll.scrollLeft, vw = viewW(); if (x < left + 4 || x > left + vw - 8) glideTo(targetFor(x)); }
    }
    // focus: the hovered intervention wins over the one at the playhead
    function applyFocus() {
      const rid = hoverRid || activeRid;
      root.classList.toggle('has-focus', !!rid);
      const on = el => !!rid && (el.dataset.rids || '').split(' ').includes(rid);
      for (const el of focusable) el.classList.toggle('focus', on(el));
      for (const g of linkGroups) g.classList.toggle('focus', on(g));
    }
    function highlight(rid) { hoverRid = rid || null; applyFocus(); }
    function hover(rid) { highlight(rid); if (opts.onHover) opts.onHover(rid || null); }
    const spans = ivs.map(iv => ({ iv, s: spanOf(iv) }));
    function setTime(t, playing) {
      playhead.style.left = X(t) + 'px';
      for (const b of timed) b.el.classList.toggle('now', t >= b.t0 && t < b.t1);
      for (const w of windows) w.el.classList.toggle('open', t >= w.w0 && t < w.lu);
      reveal(t, !!playing);
      const now = { t, active: null, user: null, instructor: null, open: null };
      for (const x of spans) if (t >= x.s[0] && t < x.s[1]) now.active = x.iv;   // the latest-starting span wins
      for (const w of windows) if (t >= w.w0 && t < w.lu) now.open = w.iv;
      for (const u of data.utterances || []) if (t >= u.t0 && t < u.t1) { if (u.speaker === 'user') now.user = u; else if (u.speaker === 'instructor') now.instructor = u; }
      const rid = now.active ? now.active.rid : null;
      if (rid !== activeRid) { activeRid = rid; applyFocus(); }
      return now;
    }
    setTime(r0, false);
    return { el: root, setTime, highlight, ivs, destroy() { tooltip.hide(); mount.replaceChildren(); } };
  }
  return { render, scored, windowOf, shortEvidence, spanOf };
})();
