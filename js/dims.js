// FLUID site — the four decision dimensions of one annotated intervention, read from its trigger row:
// WHY (the grounded evidence), WHETHER (necessary or optional), WHEN (the evidence-derived window), WHAT (the instructor act).
// Each returns a short form (a few words, for cards) and a long form (one sentence, for the inspector). The wording describes
// the case at hand; the status rule of the protocol (Appendix B) is kept separately for the details view.
'use strict';
const Dims = (() => {
  const secs = t => fmtClock(t, 2);   // session time as m:ss.ss, the format of the timeline ruler and the anchor chips
  const lower = s => String(s || '').toLowerCase();
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const trunc = (s, n) => { s = String(s || ''); if (s.length <= n) return s; const cut = s.slice(0, n - 1); return cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 12)) + '…'; };
  const typeWord = t => lower(TYPE_LABEL[t] || t).replace('progress ok', 'progress-OK');
  const act = u => (LABEL_NAMES[u.intent] || u.intent || '').replace(/ \/ .*$/, '');
  const attrWord = u => u && u.attributes ? Object.values(u.attributes).join(', ').replace(/_/g, ' ') : '';
  const userEvents = iv => (iv.events || []).filter(e => !(e.kind === 'utterance' && e.speaker === 'instructor') && e.t0 != null);

  // the event after "Trigger event:": the user's words, or the action or state with its label in parentheses
  function evidenceSentence(e) {
    if (e.kind === 'utterance') return `the user says “${e.text}”`;
    let t = GuideTimeline.shortEvidence(e);
    if (e.kind === 'state_event') { const lab = (e.state_label || 'state').toLowerCase().replace(/_/g, ' '); t = t.replace(new RegExp('^' + lab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\s*', 'i'), ''); return `${t} (${lab})`; }
    return e.validity === 'DEVIATION' ? `${t} (deviating action)` : t;
  }
  function why(iv) {
    const ev = userEvents(iv);
    if (!ev.length) return { short: 'no linked evidence', long: 'No user utterance, action or state is linked to this turn.' };
    const first = ev[0];
    const short = first.kind === 'utterance' ? `“${trunc(first.text, 56)}”` : trunc(GuideTimeline.shortEvidence(first), 56);
    const more = iv.types && iv.types.length > 1 ? ` and ${iv.types.filter(t => t !== iv.type).map(typeWord).join(', ')}` : '';
    return { short, long: `${ev.map(evidenceSentence).join('; ')}.`, typeText: `${typeWord(iv.type)}${more}`, kind: first.kind };
  }
  const NEED = {
    ERROR: 'if left uncorrected, the user would carry on with the error',
    STUCK: 'without help, the user could not proceed',
    USER_QUERY: 'without an answer, the user would lack the information they asked for',
    VISIBILITY: 'without a repair of the camera view, the instructor could not see the task well enough to guide it',
    UNCLEAR_STATE: 'without asking, the instructor could not tell whether the task is on track',
    STEP_DONE: 'without the next instruction, the user would not know what comes next',
    PROGRESS_OK: 'without the instruction, the user would not know an amount or a method that the step needs',
    RECOVERY: 'without guidance, the user could not complete the repair',
    USER_REPORT: 'the user’s report calls for an answer or a correction; without it, the user would go on wrongly',
  };
  function whether(iv) {
    if (iv.policy === 'OPTIONAL') return { short: 'optional', long: 'Optional: the user proceeds correctly either way, so speaking and staying silent are both acceptable.' };
    if (iv.policy === 'NECESSARY') { const r = NEED[iv.type] || 'without it, the user would make a mistake, get stuck or lack needed information'; return { short: 'necessary', long: `Necessary: ${r}.` }; }
    if (iv.policy === 'EXCLUDED') return { short: 'excluded', long: 'Excluded: not a task-guidance intervention, or it relies on knowledge outside the shared view, the dialogue and the task knowledge.' };
    return { short: lower(iv.policy), long: '' };
  }
  // the WHEN sentence is returned as parts (strings and {k: anchor} tokens) so the page can set the anchors as chips
  // with their times; long is the same sentence with the anchor names in place
  const partsText = parts => parts.map(p => typeof p === 'string' ? p : ANCHOR_LABEL[p.k]).join('');
  function when(iv) {
    const a = iv.anchors || {}, t0 = iv.target ? iv.target.t0 : null;
    if (iv.side === 'reactive' && a.r != null && a.lu != null) {
      const rel = t0 == null ? '' : t0 < a.r ? ', before the user had finished' : t0 >= a.lu ? ', after the window had closed' : (t0 - a.r) < 0.3 ? ', right as the turn ends' : `, ${(t0 - a.r).toFixed(1)} s into the window`;
      const parts = ['Reactive. Useful from the evidence onset, the end of the user\'s turn (', { k: 'r' }, '), until the latest useful time (', { k: 'lu' }, `); the instructor starts at ${secs(t0)}${rel}.`];
      return { short: `reactive · ${(a.lu - a.r).toFixed(1)} s window`, long: partsText(parts), parts, start: a.r, end: a.lu, pref: a.r };
    }
    if (iv.side === 'proactive' && a.lu != null && (a.es != null || a.eo != null)) {
      const es = a.es ?? a.eo, eo = a.eo ?? a.es;
      const rel = t0 == null ? '' : t0 < es ? ', before any sign of it' : t0 < eo ? ', before the evidence onset' : t0 >= a.lu ? ', after the window had closed' : (t0 - eo) < 0.3 ? ', right at the evidence onset' : `, ${(t0 - eo).toFixed(1)} s after the evidence onset`;
      const parts = ['Proactive. Early start at ', { k: 'es' }, ', evidence onset at ', { k: 'eo' }, ' (the preferred time), latest useful time ', { k: 'lu' }, `; the instructor starts at ${secs(t0)}${rel}.`];
      return { short: `proactive · ${(a.lu - es).toFixed(1)} s window`, long: partsText(parts), parts, start: es, end: a.lu, pref: eo };
    }
    const parts = ['No intervention window is annotated for this turn.'];
    return { short: 'no window', long: partsText(parts), parts };
  }
  function what(iv) {
    const u = iv.target; if (!u) return { short: 'no instructor turn', long: '' };
    const attr = attrWord(u);
    return { short: `${act(u)}: “${trunc(u.text, 48)}”`, long: `${u.intent} ${LABEL_NAMES[u.intent] || ''}: “${u.text}” (${secs(u.t0)} – ${secs(u.t1)}).`, attr };
  }
  // The status rule of the protocol (Appendix B, Table "Rules for intervention status") applied to this row, for the details view.
  const ALWAYS = ['USER_QUERY', 'ERROR', 'UNCLEAR_STATE', 'VISIBILITY', 'STUCK'], COND = ['STEP_DONE', 'PROGRESS_OK', 'RECOVERY', 'USER_REPORT'];
  function rule(iv) {
    const types = iv.types || []; const ui = userEvents(iv).filter(e => e.kind === 'utterance').map(e => e.intent); const ii = iv.target && iv.target.intent;
    const t = types.find(x => ALWAYS.includes(x)); if (t) return { pred: 'NECESSARY', why: `trigger type ${typeWord(t)} is necessary by rule` };
    const u = ui.find(x => ['U1', 'U2', 'U3', 'U7'].includes(x)); if (u) return { pred: 'NECESSARY', why: `the linked user turn is ${u} ${lower(LABEL_NAMES[u])}` };
    const c = types.find(x => COND.includes(x));
    if (c) return ['I1', 'I3', 'I8', 'I9'].includes(ii) ? { pred: 'NECESSARY', why: `after ${typeWord(c)}, an ${lower(LABEL_NAMES[ii] || 'instructor turn')} (${ii}) is necessary` } : { pred: 'OPTIONAL', why: `after ${typeWord(c)}, a ${lower(LABEL_NAMES[ii] || 'turn')} (${ii}) is optional` };
    if (types.includes('DIALOG_OTHER')) return { pred: 'OPTIONAL', why: 'dialogue outside the task is optional' };
    return { pred: 'EXCLUDED', why: 'no task-guidance trigger' };
  }
  function all(iv) { return { why: why(iv), whether: whether(iv), when: when(iv), what: what(iv) }; }
  return { why, whether, when, what, rule, all, trunc, typeWord, act, attrWord, evidenceSentence };
})();
