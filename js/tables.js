// FLUID site — the main results table (paper Table 1) rendered from data/tables.json, itself generated from results/final/tables.json.
'use strict';
// Table 1 as one wide table: the metric rows, WTaG and HoloAssist side by side, ± half-widths in small type, bold = best per metric and dataset.
// one line per metric, shown on hover over its name (the paper's Section 4 has the definitions)
const DESC = {
  hard_f1: 'Agreement with the instructor’s actual utterances inside a fixed timing tolerance, by embedding similarity.',
  judged_f1: 'Agreement with the instructor’s actual utterances inside a fixed timing tolerance, judged by a language model.',
  tc_reactive: 'The timing score of the evaluation section, averaged over the necessary reactive interventions.',
  tc_proactive: 'The timing score of the evaluation section, averaged over the necessary proactive interventions.',
  reactive_latency: 'Median delay from the end of the user’s turn to the start of the system’s reply.',
  ip: 'Share of system utterances that match an annotated intervention inside its window.',
  overlap_duration_ratio: 'Share of the user’s speaking time that the system talks over.',
};
function renderTable1Wide(T) {
  const DS = ['WTaG', 'HoloAssist']; const metrics = T.metrics; const sysRows = DS.map(ds => T.table1[ds]);
  const short = n => n === 'VideoLLM-online' ? 'VideoLLM' : n;
  const best = DS.map((ds, i) => Object.fromEntries(metrics.map(m => { const vals = sysRows[i].map(r => r.cells[m.id] ? r.cells[m.id].point : null).filter(v => v != null); return [m.id, m.dir === 'up' ? Math.max(...vals) : Math.min(...vals)]; })));
  const tbl = h('table', { class: 'res' });
  tbl.append(h('thead', {}, h('tr', {}, h('th', {}, ''), ...DS.flatMap((ds, i) => [h('th', { class: 'ds', colspan: sysRows[i].length }, ds === 'WTaG' ? 'WTaG (43 sessions)' : 'HoloAssist (72 sessions)'), i < DS.length - 1 ? h('th', { class: 'gap' }) : null])),
    h('tr', {}, h('th', {}, 'Metric'), ...DS.flatMap((ds, i) => [...sysRows[i].map(r => h('th', { class: r.system === 'FLUID' ? 'ours' : '' }, short(r.system))), i < DS.length - 1 ? h('th', { class: 'gap' }) : null]))));
  const tb = h('tbody'); let group = null;
  for (const m of metrics) {
    if (m.group !== group) { group = m.group; tb.append(h('tr', { class: 'grp' }, h('td', { colspan: 1 + sysRows.reduce((a, r) => a + r.length, 0) + DS.length - 1 }, group))); }
    tb.append(h('tr', {}, h('td', {}, h('span', { class: 'mt', title: DESC[m.id] || '', text: m.label }), h('span', { class: 'arrow', text: m.dir === 'up' ? '↑' : '↓' })),
      ...DS.flatMap((ds, i) => [...sysRows[i].map(r => { const c = r.cells[m.id]; return h('td', { class: (r.system === 'FLUID' ? 'ours ' : '') + (c && Math.abs(c.point - best[i][m.id]) < 1e-9 ? 'best' : '') }, c ? fmtNum(c.point, m.fmt) : '–', c ? h('span', { class: 'half', text: '±' + fmtNum(c.half, m.fmt) }) : null); }), i < DS.length - 1 ? h('td', { class: 'gap' }) : null])));
  }
  tbl.append(tb); return tbl;
}
