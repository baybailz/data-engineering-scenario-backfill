# Conventions

These are the working standards applied across every `data-engineering-scenario-*`
repo. They are distilled from the development procedures I wrote and ran for a
~1,500-model SAP → Snowflake warehouse, adapted to a DuckDB project that has to
run on a free GitHub runner. Where I deliberately deviate from the enterprise
version, the reason is stated.

## Layers

| Layer | Prefix | Materialization | Allowed to do |
|---|---|---|---|
| seed / raw | none | seed | land data as-is; no logic |
| stage | `stg_` | view | rename, type, light joins to keys; no business logic |
| transform | `trn_tbl_` | table (`unique_key` declared) | the business logic |
| conformed | `dim_` / `fact_` | incremental on a surrogate key | publish; no new logic; tests on every key |
| datamart | `dm_` | view (or table when heavy) | what BI reads; joins done here so reports need none |

All raw data is reached through a stage model. Conformed never reads a seed.
Datamarts read conformed. Models that need more than one step of logic get a
second transform model, not a 2,000-line datamart. *Deviation from the enterprise
doc, which forbade joins in transform and pushed every calculation into datamarts;
that is exactly how we ended up with 5–10k-line datamart files.*

## Keys and columns

- Surrogate keys: `md5_number_upper` on the natural key via `{{ surrogate_key([...]) }}`,
  suffix `_key`, first column of every dimension, then foreign keys, then attributes.
- `unique_key` is declared on every model as its grain, even when not incremental.
- lowercase snake_case everywhere; no reserved words as identifiers; full-name CTE aliases
  (`dim_customer.customer_id`), never `a.` / `b.`.
- Every conformed and datamart model carries `dbt_run_timestamp`.

## SQL shape

- CTEs declare dependencies first, then a join CTE, then a clean final `select`
  with no functions in it.
- `is distinct from` over `<>` when nulls are possible.
- No commented-out code. Comments only explain a filter, a key, or a formula.
- `sqlfluff` enforces casing, indentation, and qualification in CI. *Deviation: the
  enterprise doc enforced these by eye in a review meeting and rejected PRs for
  casing and line breaks; a linter does that for free so review can be about the model.*

## Tests

- `unique` + `not_null` on every primary key; `relationships` on every foreign key;
  `accepted_values` on every status/enum column; one singular test per business rule.
- `store_failures: true` into `dbt_audit` so a red test is a queryable table.
- Every conformed and datamart model writes a row-count audit via post-hook
  (`audit.tbl_metadata_audit`).
- `dbt build`, never `dbt run`: models and their tests succeed or fail together.

## Workflow

- Feature branch per change, PR into `main`, squash merge, delete branch, never reuse a branch.
- CI on every PR: lint + `dbt build --full-refresh` + export smoke test. Nothing merges red.
- The pipeline workflow is `workflow_dispatch` only, concurrency-grouped, and fails closed:
  a red build commits nothing back to the page.
- Commit subjects are imperative and under 50 characters; the body says why.
- Think – Write – Do: the scenario page's "Assumptions & strategy" slide is the written
  design, and it is written before the code.
