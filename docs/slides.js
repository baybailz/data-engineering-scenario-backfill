/* Slides for the backfill scenario. */
'use strict';
const m = t => `<span class="mono">${t}</span>`;

window.SLIDES = [
  {id:'title', kicker:'SCENARIO', render(){
    const {esc} = S;
    return `<div class="titleslide">
      <div class="kicker">Scenario walkthrough</div>
      <h2>A bug shipped 30 days ago.<br>Replay the range. Count nothing twice.</h2>
      <div class="stackchips">
        <span class="schip hot">python</span><span class="schip hot">dbt</span>
        <span class="schip">duckdb</span><span class="schip">github actions</span>
      </div>
      <p class="lead">Daily sales files land, a transform computes net_amount, a fact table is
        partitioned by sale_date. A bug flips the sign on the tax term, a test catches it, and a
        targeted backfill replays only the days it touched - nothing before, nothing after,
        and running it twice changes nothing.</p>
      <div class="byline">${esc(S.CFG.author)}</div>
    </div>`;}},

  {id:'assumptions', kicker:'ASSUMPTIONS & STRATEGY', render(){
    return `<h2>Assumptions &amp; strategy</h2>
      <div class="ptsec">What I assumed</div>
      <ul class="pointlist">
        <li><span class="pt">1</span><span><b>One file lands per day, in order.</b> ${m('incoming/2026-07-DD.csv')}, never out of sequence and never twice.</span></li>
        <li><span class="pt">2</span><span><b>The bug only ever touches net_amount.</b> gross_amount and tax_amount are always recorded correctly, so the correct total is always recoverable.</span></li>
        <li><span class="pt">3</span><span><b>A red test is real information, not noise.</b> In CI it should block the merge silently. In this demo, a run that fails on purpose should still publish what it found.</span></li>
      </ul>
      <div class="ptsec">How it is built</div>
      <ul class="pointlist">
        <li><span class="pt">1</span><span><b>Bounded replay.</b> ${m('fact_sale')} is incremental with ${m("delete+insert")} on ${m('sale_date')}; a run only touches ${m('[backfill_start, backfill_end]')}.</span></li>
        <li><span class="pt">2</span><span><b>Idempotent.</b> Backfilling the same range twice deletes and reinserts the same rows - the second run changes nothing.</span></li>
        <li><span class="pt">3</span><span><b>Fail-closed for data, publish-the-evidence for the page.</b> A failing test still stops nothing being trusted downstream, but the run's JSON - including the FAIL - still ships to the console.</span></li>
      </ul>`;}},

  {id:'arch', kicker:'THE ARCHITECTURE', render(){
    return `<h2>The architecture</h2>
      <p class="lead">Run dispatches a GitHub Actions workflow: Python lands or injects or backfills,
        dbt builds and tests, results are committed back as JSON - even when the build failed.</p>
      <div class="diagram" style="position:relative">
        ${S.isNarrow()?S.archFlow():S.svgArch()}
        ${S.isNarrow()?'':`<button class="zoombtn" id="archZoomBtn">${S.archZoom?'&#8854; full picture':'&#8853; zoom to pipeline'}</button>`}
      </div>`;}},

  {id:'lineage', kicker:'DBT LINEAGE', render(){
    return `<h2>dbt lineage</h2>
      <p class="lead">Read from the dbt manifest after the last build, so the picture can never drift from the project.</p>
      <div class="diagram" style="margin:38px 0 26px">${S.isNarrow()?S.dagFlow():S.svgDag()}</div>
      ${S.dagLegend()}`;}},

  {id:'code', kicker:'THE CODE', render(){
    const files = S.D.models?.files || [];
    const lines = files.reduce((a,f)=>a+f.sql.split('\n').length,0);
    const varsCode = `-- fact_sale.sql, incremental, delete+insert on sale_date
{{ config(unique_key='sale_id', incremental_strategy='delete+insert') }}
...
{% if is_incremental() %}
where sale_date between
    cast('{{ var("backfill_start","1900-01-01") }}' as date)
    and cast('{{ var("backfill_end","1900-01-01") }}' as date)
{% endif %}

-- dispatched with:
dbt build --select tag:scenario \\
  --vars '{"backfill_start":"2026-07-06","backfill_end":"2026-07-08","tax_bug":false}'`;
    return `<h2>The code</h2>
      <p class="lead">${files.length} files, ~${Math.round(lines/10)*10} lines. Press ▶ on a model to see its rows from the last run.</p>
      ${S.ideHtml()}
      <div class="ptsec" style="margin-top:26px">The backfill, bounded</div>
      ${S.codePanel('fact_sale.sql', 'the delete+insert scope', varsCode, 'sql')}
      <ul class="pointlist" style="margin-top:14px">
        <li><span class="pt">1</span><span><b>Partition key.</b> Every incremental write is scoped by ${m('sale_date')}, never by a full-table upsert.</span></li>
        <li><span class="pt">2</span><span><b>Idempotent.</b> delete+insert on the same range twice deletes the same rows it just inserted - re-running is a no-op.</span></li>
        <li><span class="pt">3</span><span><b>Bounded.</b> Rows outside ${m('[backfill_start, backfill_end]')} are never read, never deleted, never rewritten.</span></li>
      </ul>`;}},

  {id:'hardpart', kicker:'THE HARD PART', render(){
    const days = (S.D.summary?.daily_series||[]).filter(d=>d.bugged!=null || d.current!==d.correct);
    const maxV = Math.max(1, ...days.flatMap(d=>[d.correct, d.bugged??0, d.current]));
    const bar = (label, v, cls) => `<div class="hpbar"><span class="hplabel">${label}</span>
      <div class="hptrack"><div class="hpfill ${cls}" style="width:${v==null?0:Math.max(2,Math.round(v/maxV*100))}%"></div></div>
      <span class="hpval mono">${v==null?'—':'$'+v.toFixed(0)}</span></div>`;
    const rows = days.map(d=>`<div class="hprow">
        <div class="hpdate mono">${S.esc(d.date)}</div>
        <div class="hpbars">
          ${bar('correct', d.correct, 'hp-good')}
          ${bar('bugged', d.bugged, 'hp-bad')}
          ${bar('now', d.current, Math.abs(d.current-d.correct)<0.01?'hp-good':'hp-bad')}
        </div></div>`).join('');
    return `<h2>Net total per day: correct, bugged, and now</h2>
      <p class="lead">Correct is always recoverable - it's ${m('gross_amount - tax_amount')} from the raw rows, bug or no bug.
        Bugged is what actually shipped while ${m('tax_bug')} was on. Now is what ${m('fact_sale')} holds after the last run.</p>
      ${days.length ? `<div class="hpstrip scrollbox">${rows}</div>` :
        '<div class="empty"><div class="big">∅</div>No day has been through the bug yet. Inject it, then load a day.</div>'}
      <style>
        .hprow{display:flex;gap:14px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)}
        .hpdate{width:96px;flex:none;color:var(--ink3)}
        .hpbars{flex:1;display:flex;flex-direction:column;gap:4px}
        .hpbar{display:flex;align-items:center;gap:8px;font-size:11px}
        .hplabel{width:48px;flex:none;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em}
        .hptrack{flex:1;height:8px;border-radius:4px;background:var(--surface3);overflow:hidden}
        .hpfill{height:100%;border-radius:4px}
        .hp-good{background:var(--good)}
        .hp-bad{background:var(--warn)}
        .hpval{width:60px;text-align:right;color:var(--ink2)}
      </style>`;}},

  {id:'result', kicker:'THE RESULT', render(){
    const rows = S.D.tables.dm_daily_sales || [];
    const body = rows.map(r=>`<tr>
        <td class="mono">${S.esc(r.sale_date)}</td><td class="num">${S.esc(r.orders)}</td>
        <td class="num mono">${S.esc(S.fmtCell(r.gross_total))}</td>
        <td class="num mono">${S.esc(S.fmtCell(r.tax_total))}</td>
        <td class="num mono"><b>${S.esc(S.fmtCell(r.net_total))}</b></td></tr>`).join('');
    return `<h2>The result</h2>
      <p class="lead">${m('select * from dm_daily_sales')} - net total per day, converged back to correct.</p>
      <div class="verdicts scrollbox"><table><thead><tr><th>Date</th><th>Orders</th><th>Gross</th><th>Tax</th><th>Net</th></tr></thead>
      <tbody>${body}</tbody></table></div>`;}},
];
