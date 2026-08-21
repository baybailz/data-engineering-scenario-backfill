"""Scenario hooks for export_json.py. Replace these per scenario.

summary(con, ctx)  -> dict merged into summary.json (headline numbers)
history(con, ctx)  -> dict: one cell per pipeline step key in scenario.json,
                      plus anything else the console's log row wants.
ctx has: action, loaded, queue, next_file, passed, failed, cfg
"""


def summary(con, ctx) -> dict:
    total = con.execute("select count(*) from main.dim_customer").fetchone()[0]
    imported = con.execute(
        "select count(*) from main.dim_customer where source <> 'crm_customer'"
    ).fetchone()[0]
    blocked = con.execute(
        "select count(*) from main.dim_record_status where status <> 'new'"
    ).fetchone()[0]
    return {"customers_total": total, "customers_imported": imported,
            "duplicates_blocked": blocked}


def history(con, ctx) -> dict:
    last = ctx["loaded"][-1] if ctx["action"] != "reset" and ctx["loaded"] else None
    added = 0
    if last:
        added = con.execute(
            "select count(*) from main.dim_record_status "
            "where status = 'new' and source_file = ?", [last]).fetchone()[0]
    total = con.execute("select count(*) from main.dim_customer").fetchone()[0]
    if ctx["action"] == "reset":
        python = "reset · queue cleared"
        out = f"dim_customer → {total} records"
    elif last:
        python = f"loaded {last}.csv"
        out = f"dim_customer → added {added} records"
    else:
        python = "nothing left to load"
        out = "—"
    dbt = (f"dbt build --select {ctx['cfg']['dbt_select']} · PASS={ctx['passed']}"
           if ctx["passed"] else "—")
    return {"python": python, "dbt": dbt, "out": out, "loaded_file": last,
            "added": added}
