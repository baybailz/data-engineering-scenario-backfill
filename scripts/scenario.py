"""Scenario hooks for export_json.py: the tax-bug-and-backfill demo.

summary(con, ctx) -> dict merged into summary.json (headline numbers, plus
                      the daily_series list the hard-part slide reads).
history(con, ctx) -> dict: one cell per pipeline_steps key (python, dbt,
                      out) plus the log-row sentence for this run.
ctx has: action, loaded, queue, next_file, passed, failed, cfg
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / "state"


def _state(name, default):
    p = STATE / name
    return json.loads(p.read_text()) if p.exists() else default


def _failed_test_names(ctx) -> list[str]:
    rr = ROOT / "target" / "run_results.json"
    if ctx["failed"] == 0 or not rr.exists():
        return []
    data = json.loads(rr.read_text())
    names = []
    for r in data.get("results", []):
        if r.get("status") in ("fail", "error") and r.get("unique_id", "").startswith("test."):
            names.append(r["unique_id"].rsplit(".", 1)[-1])
    return names


def summary(con, ctx) -> dict:
    net_total = con.execute("select coalesce(sum(net_amount), 0) from main.fact_sale").fetchone()[0]
    partitions = con.execute("select count(*) from main.dim_partition_status").fetchone()[0]
    bugged_now = con.execute(
        "select count(*) from main.dim_partition_status where bugged"
    ).fetchone()[0]
    config = _state("config.json", {"tax_bug": False})
    # bug_snapshots.json only ever gets a key for a date that was actually
    # landed while tax_bug was on - so its keys are the real "this shipped
    # wrong" history, not a hypothetical for every day.
    snapshots = _state("bug_snapshots.json", {})

    # correct is always derivable from the raw stored gross/tax figures,
    # regardless of what tax_bug happens to be set to right now - gross-tax
    # is the correct formula. "current" is whatever fact_sale actually
    # holds this instant.
    days = rows_dict(con, "select sale_date, gross_amount, tax_amount from main.trn_tbl_sale")
    correct_by_day = {}
    for r in days:
        d = str(r["sale_date"])
        gross, tax = float(r["gross_amount"]), float(r["tax_amount"])
        correct_by_day[d] = correct_by_day.get(d, 0) + gross - tax
    current_by_day = {str(r["sale_date"]): float(r["net_total"])
                       for r in rows_dict(con, "select sale_date, net_total from main.dim_partition_status")}

    daily_series = [
        {"date": d, "correct": round(correct_by_day[d], 2),
         "bugged": snapshots.get(d), "current": round(current_by_day.get(d, 0), 2)}
        for d in sorted(correct_by_day)
    ]

    return {"net_total": round(float(net_total), 2), "partitions_built": partitions,
            "partitions_bugged": bugged_now, "tax_bug_active": bool(config["tax_bug"]),
            "daily_series": daily_series}


def rows_dict(con, sql):
    cur = con.execute(sql)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def history(con, ctx) -> dict:
    action = ctx["action"]
    dbt_vars = _state("dbt_vars.json", {})
    failing = _failed_test_names(ctx)
    dbt_msg = (f"dbt build · FAIL · {', '.join(failing)}" if failing
               else f"dbt build · PASS={ctx['passed']}")

    # How many partitions THIS run touched, from the vars run.py wrote for
    # it - not a cumulative count of every row ever tagged with this action.
    sentinel = "1900-01-01"
    bs, be = dbt_vars.get("backfill_start", sentinel), dbt_vars.get("backfill_end", sentinel)
    touched = 0
    if action != "reset" and bs != sentinel and be != sentinel:
        from datetime import date
        y1, m1, d1 = (int(x) for x in bs.split("-"))
        y2, m2, d2 = (int(x) for x in be.split("-"))
        touched = (date(y2, m2, d2) - date(y1, m1, d1)).days + 1

    if action == "reset":
        python = "reset · queue cleared"
        out = "fact_sale → 0 rows"
    elif action == "inject_bug":
        python = "bug injected · net_amount sign flipped"
        out = f"{touched} partitions rebuilt"
    elif action == "fix_and_backfill":
        start, end = dbt_vars.get("backfill_start"), dbt_vars.get("backfill_end")
        python = f"backfill {start}→{end}"
        out = f"{touched} partitions rebuilt · totals match" if not failing else f"{touched} partitions rebuilt"
    else:  # load_next
        last = ctx["loaded"][-1] if ctx["loaded"] else None
        python = f"{last} landed" if last else "nothing left to load"
        out = f"{touched} partitions rebuilt"

    return {"python": python, "dbt": dbt_msg, "out": out, "action": action}
