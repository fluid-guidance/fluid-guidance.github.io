// FLUID site — homepage: the title-block demo (one real minute with the four-layer timeline), the case browser of the
// Modeling section (every annotated WTaG moment with its four layers on one clock, filtered by guidance, trigger type
// and necessity, explained as WHY / WHETHER / WHEN / WHAT), and the main table.
// Every clip, label, time and number is read from data/showcase.json and data/tables.json;
// the only hand-typed values on the page are the paper's own (in index.html, with their source).
'use strict';
(async function () {
  const [show, tables] = await Promise.all(['data/showcase.json', 'data/tables.json'].map(loadJSON));
  const byId = Object.fromEntries(show.cases.map(c => [c.id, c]));
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const polChip = iv => h('span', { class: 'chip pol ' + iv.policy.toLowerCase(), text: iv.policy });
  const typeChip = iv => h('span', { class: 'chip type', text: `Trigger Type: ${iv.type}` });
  const sideChip = iv => h('span', { class: 'chip side', text: iv.side });
  const ANCHOR_SUB = { es: 'early', eo: 'evid', r: 'usr', lu: 'latest' };
  const anchorChip = (k, t) => h('span', { class: 'anc-chip ' + k, title: ANCHOR_LONG[k] }, h('i', { class: 'pin ' + k, 'aria-hidden': 'true' }), h('b', { html: `<i>t</i><sub>${ANCHOR_SUB[k]}</sub>` }), ' ', h('span', { class: 'num', text: fmtClock(t, 2) }));
  const clockEl = (id) => h('span', { class: 'clock' }, h('b', { class: 'num', id, text: '0:00' }));
  const focalOf = c => (c.interventions || []).find(x => x.rid === c.focal_rid) || null;
  const scoredOf = c => (c.interventions || []).filter(GuideTimeline.scored).sort((a, b) => a.target.t0 - b.target.t0);
  const stepAt = (c, t) => (c.steps || []).find(x => t >= x.t0 && t < x.t1 && x.kind !== 'marker');
  // Pixels per second of both timelines (the demo and the case browser): one scale, at which every utterance, action and
  // state of the 17 cases reads inside its own bar on at most three lines, bar two brief blocks with long descriptions
  // that get an outlined box (measured over the released annotations on 2026-10-26, guide_timeline.js; re-checked at the
  // 14 px block text). The clips scroll; the track follows the playhead.
  const PPS = 130;   // 150 at the 16.5 px block text; the bars scale with the text so the same texts fit inside them

  function setSource(v, c) {
    v.replaceChildren(); v.poster = c.poster; v.src = c.clip; v.muted = !c.has_audio;
    if (c.captions) v.append(h('track', { kind: 'captions', srclang: 'en', label: 'Transcript', src: c.captions, default: '' }));
    v.load();
  }
  // One video driven by one timeline: seek on block click, playhead and caption on playback. load(c) swaps the clip and
  // redraws the timeline; tlOpts.pps may be a function of the case.
  // c.intro: seconds of film cut in front of the clip (the title block); the timeline follows the clip part only
  function player(v, mount, tlOpts, onTick) {
    let c = null, tl = null, raf = 0;
    const intro = () => (c && c.intro) || 0;
    const inIntro = () => v.currentTime < intro() - 0.05;
    const st = () => Math.max(c.range[0], v.currentTime - intro() + c.range[0]);
    const tick = () => { if (!tl) return; onTick(tl.setTime(st(), !v.paused && !v.ended && !inIntro()), c); };
    const seek = t => { v.currentTime = Math.max(0, t - c.range[0] + intro()); if (v.paused) tick(); };
    const loop = () => { tick(); if (!v.paused && !v.ended) raf = requestAnimationFrame(loop); };
    v.addEventListener('play', () => { cancelAnimationFrame(raf); loop(); }); v.addEventListener('pause', () => { cancelAnimationFrame(raf); tick(); });
    v.addEventListener('seeked', tick); v.addEventListener('loadedmetadata', tick); v.addEventListener('ended', tick);
    v.addEventListener('timeupdate', tick);   // keeps the playhead and the readout right when the tab is in the background and animation frames pause
    const p = { seek, tick, inIntro, get tl() { return tl; },
      load(cs) {
        cancelAnimationFrame(raf); v.pause(); c = cs; setSource(v, c);
        const o = { ...tlOpts, onSeek: seek }; if (typeof o.pps === 'function') o.pps = o.pps(c);
        tl = GuideTimeline.render(mount, c, o); tick(); return tl;
      } };
    return p;
  }
  // The line under a video: what is happening at the playhead. In the demo (explain) an intervention in progress shows
  // its labels and its reading; in the case browser, whose side column carries the reading, the line names the current
  // turn, action or state, with the labels of the window that is open.
  function caption(x, c, n, explain) {
    const iv = n.active, caps = c.moment_captions || {}, step = stepAt(c, n.t);
    const act = !explain && !n.instructor && !n.user ? (c.actions || []).find(a => n.t >= a.t0 && n.t < a.t1) : null;
    const key = [explain ? (iv ? iv.rid : '') : (n.open ? n.open.rid : ''), n.instructor ? 'i' + n.instructor.uid : n.user ? 'u' + n.user.uid : act ? 'a' + act.aid : 's' + (step ? step.name : '')].join('|');
    if (x.dataset.key === key) return; x.dataset.key = key; x.className = 'x';
    if (explain && iv) { const ed = iv.rid === c.focal_rid && c.dims; x.replaceChildren(polChip(iv), typeChip(iv), sideChip(iv), ' ', h('span', { text: caps[iv.rid] || (ed ? `${ed.why} ${ed.whether}` : cap(Dims.why(iv).long) + ' ' + Dims.whether(iv).long) })); return; }
    const lead = !explain && n.open ? [polChip(n.open), typeChip(n.open), ' '] : [];
    if (n.instructor) x.replaceChildren(...lead, h('b', { text: 'Instructor: ' }), h('q', { text: n.instructor.text }));
    else if (n.user) x.replaceChildren(...lead, h('b', { text: 'User: ' }), h('q', { text: n.user.text }));
    else if (act) x.replaceChildren(...lead, h('b', { text: act.kind === 'state_event' ? 'State: ' : 'Action: ' }), h('span', { text: act.description }));
    else { x.className = 'x' + (lead.length ? '' : ' muted'); x.replaceChildren(...lead, h('span', { text: step ? `Step: ${step.name}.` : 'The user continues with the task.' })); }
  }

  // ---- the demo ----
  // One video: the title-block film (one moment, five timings; build/render_timing_demo.py) cut in front of the minute,
  // when it has been rendered; the timeline under the player follows the minute. Without the film, the minute alone.
  async function initTeaser(c) {
    let cc = c;
    try { const f = await loadJSON('media/timing/timing_demo_full.json'); if (f && f.intro_s) cc = { ...c, clip: f.clip, poster: f.poster || c.poster, captions: f.captions || null, intro: f.intro_s }; } catch (e) { /* no film built: the minute alone */ }
    const now = $('.tnow');
    const p = player($('#tv'), $('#ttl'), { pps: PPS }, (n, cs) => {
      now.classList.toggle('off', p.inIntro());   // the clock and the line appear when the minute begins
      $('#now-t').textContent = fmtClock(n.t); caption($('#now-x'), cs, n, true); });
    p.load(cc);
  }

  // ---- the case browser: every annotated WTaG moment, one at a time ----
  const TYPES = ['USER_QUERY', 'USER_REPORT', 'ERROR', 'STUCK', 'UNCLEAR_STATE', 'VISIBILITY', 'PROGRESS_OK', 'STEP_DONE', 'RECOVERY', 'DIALOG_OTHER'];
  const SIDES = [['reactive', 'Reactive guidance'], ['proactive', 'Proactive guidance']];   // the two tabs of the browser
  // editorial order: the worked example of the paper first, then the trigger types, the two step-completion decisions and
  // the minute of the title block; cases missing from this list follow in the order of the showcase
  const ORDER = ['wtag_t2_error', 'wtag_t11_error_speech', 'wtag_t5_query', 'wtag_t16_report', 'wtag_t31_stuck', 'wtag_t48_stuck_speech', 'wtag_t36_unclear', 'wtag_t37_visibility',
    'wtag_t15_progress', 'wtag_t14_progress_mixed', 'wtag_t18_stepdone', 'wtag_t42_stepdone_speech', 'wtag_t48_step_necessary', 'wtag_t8_step_optional', 'wtag_t34_recovery', 'wtag_t45_dialogue', 'wtag_t30_hero'];
  function initCases(all) {
    const rank = c => { const i = ORDER.indexOf(c.id); return i < 0 ? ORDER.length : i; };
    const cases = all.filter(c => c.dataset === 'wtag' && c.group !== 'agent' && GuideTimeline.scored(focalOf(c))).sort((a, b) => rank(a) - rank(b));
    const facet = { side: c => focalOf(c).side, type: c => focalOf(c).type };
    // one tab per kind of guidance; inside it the trigger type is the only filter. Necessity is each case's own label, shown beside its title.
    const state = { side: 'reactive', type: 'all', id: null };
    const matches = (c, s = state) => facet.side(c) === s.side && (s.type === 'all' || facet.type(c) === s.type);
    const typesOf = side => TYPES.filter(t => cases.some(c => facet.side(c) === side && facet.type(c) === t));

    const root = $('#cases');
    const tabs = h('div', { class: 'case-tabs', role: 'tablist', 'aria-label': 'Kind of guidance' });
    const line = h('p', { class: 'case-line' }), pol = h('span', { class: 'case-pol' }), nav = h('div', { class: 'case-nav' }), filters = h('div', { class: 'case-filters' });
    const v = h('video', { controls: '', playsinline: '', preload: 'metadata' });
    const now = h('div', { class: 'tnow case-now' }, clockEl('case-now-t'), h('span', { class: 'x muted' }));
    const tlMount = h('div', { class: 'case-tl' }), side = h('aside', { class: 'case-side', 'aria-label': 'Why, whether, when and what' });
    // the clip and its live line on the left, the four dimensions beside them at the same height, the timeline under both
    root.replaceChildren(tabs, h('div', { class: 'case-head' }, line, pol, nav), filters, h('div', { class: 'case-body' }, h('div', { class: 'vframe case-video' }, v), now, h('div', { class: 'case-side-wrap' }, side), tlMount));

    let cur = null, shown = null, visible = [];
    const dim = (k, name, hint, body) => h('div', { class: 'dim ' + k }, h('div', { class: 'dim-h' }, h('b', { text: name }), h('span', { text: hint })), h('div', { class: 'dim-b' }, ...(Array.isArray(body) ? body : [body])));
    // the label words of the four layers (trigger types, status, side, the utterance taxonomy and its attributes, state
    // labels, validity) are set in bold wherever a card's sentence uses them
    const VOCAB = (() => {
      const words = new Set(['necessary', 'optional', 'excluded', 'proactive', 'reactive', 'deviating action', 'deviation', 'valid', 'progress-OK', 'early start', 'evidence onset', 'latest useful', 'trigger type', 'trigger event']);
      for (const t of Object.values(TYPE_LABEL)) words.add(t.toLowerCase());
      for (const n of Object.values(LABEL_NAMES)) for (const part of n.split(' / ')) words.add(part.toLowerCase());
      for (const c of show.cases) {
        for (const u of c.utterances || []) { if (u.category) for (const part of u.category.split(' / ')) words.add(part.toLowerCase()); for (const v of Object.values(u.attributes || {})) words.add(String(v).replace(/_/g, ' ').toLowerCase()); }
        for (const a of c.actions || []) if (a.state_label) words.add(a.state_label.replace(/_/g, ' ').toLowerCase());
      }
      for (const w of ['other', 'none']) words.delete(w);
      return [...words].filter(w => w.length > 2).sort((a, b) => b.length - a.length);
    })();
    const VOCAB_RE = new RegExp('(^|[^A-Za-z-])(' + VOCAB.map(w => w.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')).join('|') + ')(?![A-Za-z-])', 'gi');
    const lcFirst = s => s ? s[0].toLowerCase() + s.slice(1) : s;
    const mark = text => { text = String(text); const out = []; let last = 0;
      for (const m of text.matchAll(VOCAB_RE)) { const start = m.index + m[1].length; if (start > last) out.push(text.slice(last, start)); out.push(h('b', { class: 'kw', text: m[2] })); last = start + m[2].length; }
      if (last < text.length) out.push(text.slice(last)); return out; };
    // WHEN as rows: the anchors as chips with their times and a word each, then where the instructor's turn fell
    const whenBody = iv => {
      const a = iv.anchors || {}, t0 = iv.target ? iv.target.t0 : null, rows = [], reactive = iv.side === 'reactive';
      const row = (k, words) => { if (a[k] != null) rows.push(h('div', { class: 'wr' }, anchorChip(k, a[k]), h('span', { text: words }))); };
      if (reactive) { row('r', 'the user’s turn ends · preferred'); row('lu', 'latest useful'); } else { row('es', 'early start'); row('eo', 'evidence onset · preferred'); row('lu', 'latest useful'); }
      const first = reactive ? a.r : (a.es ?? a.eo), pref = reactive ? a.r : (a.eo ?? a.es), lu = a.lu;
      if (t0 != null && pref != null && lu != null) {
        const at = reactive ? 'the turn ends' : 'the onset';   // the preferred time: the end of the user's turn, or the evidence onset
        const rel = t0 >= lu ? 'after the window closed' : t0 < first ? (reactive ? 'before the turn ends' : 'before the early start') : t0 < pref ? 'before the evidence onset' : Math.abs(t0 - pref) < 0.3 ? `right as ${at}` : `${(t0 - pref).toFixed(1)} s after ${at}`;
        rows.push(h('div', { class: 'wr ins' }, h('b', { class: 'num', title: 'the human instructor of the recording: the ground truth', text: `GT instructor at ${fmtClock(t0, 2)}` }), h('span', { text: rel })));
      }
      return [h('div', { class: 'when-rows' }, ...rows)];   // the side (reactive / proactive) is the live line's chip
    };
    // the four dimensions of one intervention: the case's own wording for its focal intervention, else the trigger row's
    function renderSide(c, iv) {
      shown = iv; const d = Dims.all(iv), ed = (iv.rid === c.focal_rid && c.dims) || {}, list = scoredOf(c), i = list.findIndex(x => x.rid === iv.rid);
      side.replaceChildren(...[
        list.length > 1 ? h('p', { class: 'side-k num', text: `Intervention ${i + 1} of ${list.length} in this clip` }) : null,
        dim('why', 'WHY', 'the grounded evidence', [h('div', { class: 'why-type' }, ...mark(`Trigger type: ${d.why.typeText || Dims.typeWord(iv.type)}`)), h('div', {}, ...mark('Trigger event: ' + lcFirst(ed.why || d.why.long)))]),
        dim('whether', 'WHETHER', 'necessary or optional', mark(ed.whether || d.whether.long)),
        dim('when', 'WHEN', 'when it is useful', whenBody(iv)),
        dim('what', 'WHAT', 'what the instructor says', mark(ed.what || `${iv.target.category || Dims.act(iv.target)}: “${iv.target.text}”`))].filter(Boolean));
      $$('.dim', side).forEach(el => { el.addEventListener('mouseenter', () => p.tl && p.tl.highlight(iv.rid)); el.addEventListener('mouseleave', () => p.tl && p.tl.highlight(null)); });
      side.scrollTop = 0;
    }
    const p = player(v, tlMount, {
      pps: PPS,
      onSelect: rid => { const iv = cur && cur.interventions.find(x => x.rid === rid); if (iv && GuideTimeline.scored(iv)) renderSide(cur, iv); },
    }, (n, c) => { $('#case-now-t').textContent = fmtClock(n.t); caption($('.x', now), c, n, false); if (n.active && (!shown || n.active.rid !== shown.rid)) renderSide(c, n.active); });

    function renderNav() {
      const i = visible.findIndex(x => x.id === state.id);
      nav.replaceChildren(h('button', { type: 'button', 'aria-label': 'Previous case', title: 'Previous case', onclick: () => step(-1) }, '‹'), h('span', { class: 'num', text: `${i + 1} / ${visible.length}` }), h('button', { type: 'button', 'aria-label': 'Next case', title: 'Next case', onclick: () => step(1) }, '›'));
    }
    function renderTabs() {
      tabs.replaceChildren(...SIDES.map(([id, name]) => h('button', { type: 'button', role: 'tab', class: 'ctab' + (state.side === id ? ' on' : ''), 'aria-selected': String(state.side === id), onclick: () => pickSide(id) }, name)));
    }
    // the trigger types present on this tab (every chip has at least one case)
    function renderFilters() {
      const items = [['all', 'All'], ...typesOf(state.side).map(t => [t, TYPE_LABEL[t] || t])];
      filters.replaceChildren(h('div', { class: 'cf' }, h('span', { class: 'cf-label', text: 'Trigger type' }), h('div', { class: 'cf-items', role: 'group', 'aria-label': 'Trigger type' }, ...items.map(([id, name]) =>
        h('button', { type: 'button', class: 'xf' + (state.type === id ? ' on' : ''), 'aria-pressed': String(state.type === id), onclick: () => pickType(id) }, name)))));
    }
    function load(c) {
      cur = c; shown = null;
      line.replaceChildren(h('span', { class: 'k', text: 'Case: ' }), h('b', { text: c.title.replace(/\.?$/, '') }));
      pol.replaceChildren(polChip(focalOf(c)));   // necessity: the case's own label, not a filter
      renderSide(c, focalOf(c));
      p.load(c);
    }
    function refresh() {
      visible = cases.filter(c => matches(c));
      if (!visible.some(c => c.id === state.id)) state.id = visible[0].id;
      renderTabs(); renderFilters(); renderNav();
      const c = cases.find(x => x.id === state.id); if (c !== cur) load(c);
    }
    function pickSide(id) { state.side = id; if (!typesOf(id).includes(state.type)) state.type = 'all'; refresh(); }
    function pickType(id) { state.type = id; refresh(); }
    function step(d) { const i = visible.findIndex(x => x.id === state.id); state.id = visible[(i + d + visible.length) % visible.length].id; refresh(); }
    function showCase(id) { const c = cases.find(x => x.id === id); if (!c) return false; state.id = id; state.side = facet.side(c); if (!matches(c)) state.type = 'all'; refresh(); return true; }

    refresh();   // opens the first case of the first tab
    // #case=<id> opens that case (deep links)
    const fromHash = scroll => { const q = Object.fromEntries(location.hash.slice(1).split('&').filter(Boolean).map(kv => kv.split('=').map(decodeURIComponent))); if (q.case && showCase(q.case) && scroll) $('#modeling').scrollIntoView(); };
    fromHash(true); window.addEventListener('hashchange', () => fromHash(false));
    return { showCase };
  }

  const browser = initCases(show.cases);
  initTeaser(byId.wtag_t30_hero);
  $('#t1').replaceChildren(renderTable1Wide(tables));
  $('#copybib').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#bibtex').textContent); $('#copybib').textContent = 'Copied'; } catch { $('#copybib').textContent = 'Select and copy'; } });
})();
