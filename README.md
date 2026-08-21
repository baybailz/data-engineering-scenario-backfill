# data-engineering-scenario-template

The template behind every `data-engineering-scenario-*` repo: a data pipeline you
can run from a web page. The page is static (GitHub Pages); the **Run** button
dispatches a GitHub Actions workflow that lands the next incoming file, runs
`dbt build` (models *and* tests) against DuckDB, and commits the results back as
JSON for the page to render. No servers, no keys beyond a fine-grained PAT in the
owner's browser, no cost.

**[Live demo →](https://baybailz.github.io/data-engineering-scenario-template/)**

## What you get

```
docs/index.html        the shell: presentation deck + demo console (do not edit per scenario)
docs/slides.js         the slides for THIS scenario
docs/panels.js         the console tabs for THIS scenario
docs/scenario.json     title, repo, pipeline steps, which tables to export
scripts/run.py         ingest step: incoming/*.csv -> landing seed, queue in state/
scripts/export_json.py publishes docs/data/*.json (summary, tables, logs, code, lineage, audit)
scripts/scenario.py    two hooks: headline numbers + the log row for a run
models/                stage -> transform -> conformed -> datamart (see CONVENTIONS.md)
macros/                surrogate_key(), metadata_audit()
tests/                 singular tests
.github/workflows/pipeline.yml   the dispatchable run
.github/workflows/ci.yml         PR gate: sqlfluff + dbt build + export smoke test
.github/actions/ollama           local LLM on the runner, model blobs cached (for the AI scenarios)
.github/workflows/ollama-smoke.yml  proves the LLM path and reports tok/s
```

## Start a new scenario

1. **Use this template** on GitHub → name it `data-engineering-scenario-<topic>`.
2. Settings → Pages → Deploy from branch `main`, folder `/docs`.
3. Edit `docs/scenario.json` (repo, title, steps, export tables) and the `<meta>` tags
   at the top of `docs/index.html`.
4. Replace the seeds, `incoming/*.csv`, and the models. Keep the layer folders.
5. Rewrite `docs/slides.js` and `docs/panels.js`. `S.tablePanel(name, hint)` renders any
   exported table; `S.incomingPanel()` renders the queue; `S.svgDag()` draws lineage from
   the manifest. Adjust `scripts/scenario.py` so the log row says something true.
6. Run the workflow once (`reset`) so `docs/data/` exists, then open the page.
7. To drive it from the page: gear icon → paste a fine-grained PAT scoped to this repo
   with *Actions: read & write* and *Contents: read*. Visitors without a token see a
   locked button and the published state.

Locally:

```bash
python -m venv .venv && .venv/bin/pip install -r requirements.txt
export DBT_PROFILES_DIR=.
.venv/bin/python scripts/run.py --action reset && .venv/bin/dbt build --full-refresh
.venv/bin/python scripts/run.py --action load_next && .venv/bin/dbt build --select tag:scenario
.venv/bin/python scripts/export_json.py --action load_next
(cd docs && python -m http.server 8000)   # http://localhost:8000
```

## Using a local LLM in a scenario

```yaml
- uses: ./.github/actions/ollama
  with: { model: "qwen2.5:3b" }
- run: curl -s localhost:11434/api/generate -d '{"model":"qwen2.5:3b","format":"json","stream":false,"prompt":"..."}'
```

Free, keyless, runs on `ubuntu-latest`. The first run pulls the model (~2 GB);
later runs restore it from the Actions cache. Dispatch `ollama-smoke` to see timings.

## Conventions

See [CONVENTIONS.md](CONVENTIONS.md): layers, keys, tests, SQL shape, and workflow,
with the places where this series deliberately departs from the enterprise standard
it grew out of.
