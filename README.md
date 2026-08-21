# A bug shipped 30 days ago. Replay the range. Count nothing twice.

Daily sales files land, a transform computes `net_amount`, a fact table is
partitioned by `sale_date`. Someone flips the sign on the tax term and it
ships for a few days before a test catches it. A targeted backfill replays
only the days the bug touched: not the whole table, not twice.

**[Live demo →](https://baybailz.github.io/data-engineering-scenario-backfill/)** — a
presentation and a working console. The buttons dispatch a GitHub Actions
workflow that runs the real pipeline and publishes the result back to the page.

## The hard part

`net_amount` should always be `gross_amount - tax_amount`. With the bug on,
`trn_tbl_sale` computes `gross_amount + tax_amount` instead. That is a
three-line `case` flip, easy to miss in review, and every day it stays on
ships a total that is too high. `assert_net_never_exceeds_gross` catches it: `net_amount`
can never exceed `gross_amount` since tax is never negative, so any row
where it does proves the sign is wrong.

The fix is not "rebuild everything." `fact_sale` is incremental with
`incremental_strategy='delete+insert'` on `sale_date`; a backfill run passes
`--vars '{"backfill_start":...,"backfill_end":...}'` and only that range is
deleted and reinserted. Days outside it are never read. Running the same
backfill twice deletes and reinserts the same rows, so the second run changes
nothing, which `assert_no_duplicate_sale_ids_after_backfill` and
`dim_partition_status`'s unchanged `last_built_at` both prove.

One deliberate deviation from the series' fail-closed rule: `inject_bug` and
the load after it are meant to turn the run red. The workflow exports and
commits `docs/data/*.json` first, then fails the run if `dbt build` failed.
The red test still blocks the merge; the page just does not hide it.

## How it works

1. **Land** — `scripts/run.py` stages one day's `incoming/*.csv` into the
   `incoming_sale` seed and records what's loaded in `state/`.
2. **Stage** — `stg_sale`, `stg_store` rename and type, no logic.
3. **Transform** — `trn_tbl_sale` computes `net_amount`, rebuilt in full from
   every currently landed day so it always reflects the current bug state.
4. **Conform** — `fact_sale` and `dim_partition_status` are incremental,
   delete+insert, scoped to `[backfill_start, backfill_end]`: one day for a
   normal load, a wider range for a backfill, everything for `--full-refresh`.
5. **Publish** — `dm_daily_sales` is what BI reads; `scripts/export_json.py`
   writes `docs/data/*.json` for the console, whether the build passed or not.

## Actions

- **Load next day** — lands the next `incoming/*.csv`, builds that one partition.
- **Inject bug** — flips `state/config.json`'s `tax_bug` flag. No data changes
  until the next load ships a wrong number.
- **Fix + backfill** — clears the flag, replays the recorded bugged date
  range. No parameters needed from the page; the range comes from state.
- **Reset** — flag off, queue cleared, `--full-refresh`.

## Layout

```
incoming/           daily sale CSVs waiting to be loaded, 2026-07-01..14
scripts/            run.py (land/inject/backfill), scenario.py (log + summary hooks)
seeds/              crm_store (master), incoming_sale (rebuilt landing table)
models/stage/       stg_sale · stg_store — rename and type only
models/transform/   trn_tbl_sale — the net_amount logic and the bug toggle
models/conformed/   fact_sale · dim_store · dim_partition_status
models/datamart/    dm_daily_sales — what BI reads
tests/              assert_net_never_exceeds_gross · assert_no_duplicate_sale_ids_after_backfill
state/               loaded files, the tax_bug flag, the recorded bugged range
docs/                the presentation and console, published by Pages
```
