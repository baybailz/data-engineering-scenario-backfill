/* Slides for this scenario. Each slide: {id, kicker, render() -> html}.
   S exposes shell helpers and the live data (S.D), config (S.CFG).
   Replace the words; keep the ids 'arch', 'lineage', 'code' if you want
   the generic diagrams and the code browser. */
'use strict';
const m = t => `<span class="mono">${t}</span>`;

window.SLIDES = [
  {id:'title', kicker:'SCENARIO', render(){
    const {esc} = S;
    return `<div class="titleslide">
      <div class="kicker">Scenario walkthrough</div>
      <h2>Load incoming batches.<br>Master data wins.</h2>
      <div class="stackchips">
        <span class="schip hot">python</span><span class="schip hot">dbt</span>
        <span class="schip">duckdb</span><span class="schip">github actions</span>
      </div>
      <p class="lead">A template for every scenario in this series: an incoming queue, a Python
        ingest step, a layered dbt project with tests, and a page that runs the real pipeline
        through GitHub Actions and shows what came out.</p>
      <div class="byline">${esc(S.CFG.author)}</div>
    </div>`;}},

  {id:'assumptions', kicker:'ASSUMPTIONS & STRATEGY', render(){
    return `<h2>Assumptions &amp; strategy</h2>
      <div class="ptsec">What I assumed</div>
      <ul class="pointlist">
        <li><span class="pt">1</span><span><b>Master data is the source of truth.</b> ${m('crm_customer')} wins every conflict. An import adds rows; it never edits or deletes one.</span></li>
        <li><span class="pt">2</span><span><b>Incoming data is low-trust.</b> Repeats across files and inside a file are normal, not exceptional.</span></li>
        <li><span class="pt">3</span><span><b>Seeds stand in for a landing stage.</b> On a warehouse the seed becomes a stage table and the loader becomes the COPY into it.</span></li>
      </ul>
      <div class="ptsec">How it is built</div>
      <ul class="pointlist">
        <li><span class="pt">1</span><span><b>Layered.</b> stage (rename) → transform (decide) → conformed (publish, keyed, tested) → datamart (what BI reads).</span></li>
        <li><span class="pt">2</span><span><b>Re-running is safe.</b> ${m('dim_customer')} is incremental on ${m('customer_key')}; the landing seed is a pure function of the state file.</span></li>
        <li><span class="pt">3</span><span><b>Nothing merges red.</b> CI lints the SQL and builds every model with its tests on every pull request.</span></li>
      </ul>`;}},

  {id:'arch', kicker:'THE ARCHITECTURE', render(){
    return `<h2>The architecture</h2>
      <p class="lead">Run dispatches a GitHub Actions workflow: Python lands a file, dbt builds and tests,
        results are committed back as JSON. A real pipeline, driven from a web page.</p>
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
    return `<h2>The code</h2>
      <p class="lead">${files.length} files, ~${Math.round(lines/10)*10} lines. Press ▶ on a model to see its rows from the last run.</p>
      ${S.ideHtml()}`;}},

  {id:'result', kicker:'THE RESULT', render(){
    const rows = S.D.tables.dim_customer || [];
    const body = rows.map(c=>`<tr${c.source!=='crm_customer'?' class="rowimp"':''}>
        <td class="num mono faded">${S.esc(c.customer_id)}</td><td><b>${S.esc(c.customer_name)}</b></td>
        <td>${S.esc(c.city)}, ${S.esc(c.state)}</td><td>${S.esc(c.segment)}</td>
        <td><span class="mono faded">${S.esc(c.source)}</span></td></tr>`).join('');
    return `<h2>The result</h2>
      <p class="lead">${m('select * from dim_customer')}</p>
      <div class="verdicts scrollbox"><table><thead><tr><th>ID</th><th>Customer</th><th>Location</th><th>Segment</th><th>Source</th></tr></thead>
      <tbody>${body}</tbody></table></div>`;}},
];
