#!/usr/bin/env python3
"""The ingest step for the backfill scenario.

On a warehouse this is a stage: PUT the file, COPY into a landing table,
models read that. Here a dbt seed plays the landing table, same as the
template, but this scenario has four actions instead of two:

  --action load_next        stage the next day's file (default)
  --action inject_bug        flip the tax_bug flag; no data changes yet
  --action fix_and_backfill  clear the flag, replay the affected date range
  --action reset             clear everything, --full-refresh follows

State lives in state/: loaded_files.json (what's landed), config.json
(the tax_bug flag), bugged_dates.json (days landed while the flag was on -
the default backfill range), bug_snapshots.json (what those days' totals
looked like while bugged, for the before/after slide). run.py also writes
state/dbt_vars.json, the exact --vars payload the workflow hands to dbt so
pipeline.yml never has to know this scenario's variable names.
"""

import argparse
import csv
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = json.loads((ROOT / "docs" / "scenario.json").read_text())
INCOMING = ROOT / "incoming"
STATE = ROOT / "state"
LOADED_FILE = STATE / "loaded_files.json"
CONFIG_FILE = STATE / "config.json"
BUGGED_FILE = STATE / "bugged_dates.json"
SNAPSHOT_FILE = STATE / "bug_snapshots.json"
VARS_FILE = STATE / "dbt_vars.json"
SEED_FILE = ROOT / "seeds" / f"{CFG['landing']['seed']}.csv"
COLS = CFG["landing"]["columns"]
SENTINEL = "1900-01-01"


def read_json(path, default):
    return json.loads(path.read_text()) if path.exists() else default


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n")


def day_rows(name: str) -> list[dict]:
    with open(INCOMING / f"{name}.csv", newline="") as fh:
        return list(csv.DictReader(fh))


def day_net_total(rows: list[dict], bugged: bool) -> float:
    total = 0.0
    for r in rows:
        gross, tax = float(r["gross_amount"]), float(r["tax_amount"])
        total += (gross + tax) if bugged else (gross - tax)
    return round(total, 2)


def write_seed(loaded: list[str]) -> int:
    rows = []
    for name in loaded:
        for r in day_rows(name):
            rows.append([name] + [r.get(c, "") for c in COLS])
    with open(SEED_FILE, "w", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(["source_file"] + COLS)
        w.writerows(rows)
    return len(rows)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--action", default="load_next",
                     choices=["load_next", "inject_bug", "fix_and_backfill", "reset"])
    ap.add_argument("--backfill-start", default="")
    ap.add_argument("--backfill-end", default="")
    args = ap.parse_args()

    loaded = read_json(LOADED_FILE, [])
    config = read_json(CONFIG_FILE, {"tax_bug": False})
    bugged_dates = read_json(BUGGED_FILE, [])
    snapshots = read_json(SNAPSHOT_FILE, {})
    dbt_vars = {"tax_bug": config["tax_bug"], "backfill_start": SENTINEL,
                "backfill_end": SENTINEL, "action_label": args.action}

    if args.action == "reset":
        loaded, bugged_dates, snapshots = [], [], {}
        config = {"tax_bug": False}
        dbt_vars = {"tax_bug": False, "backfill_start": SENTINEL,
                    "backfill_end": SENTINEL, "action_label": "reset"}
        print("[reset] queue cleared, tax_bug off, snapshots cleared")

    elif args.action == "inject_bug":
        config["tax_bug"] = True
        dbt_vars["tax_bug"] = True
        print("[bug] tax_bug flag set -> net_amount will compute as gross + tax")

    elif args.action == "fix_and_backfill":
        start = args.backfill_start or (min(bugged_dates) if bugged_dates else None)
        end = args.backfill_end or (max(bugged_dates) if bugged_dates else None)
        if not start or not end:
            print("[backfill] nothing bugged to fix; no-op")
        else:
            dbt_vars.update(tax_bug=False, backfill_start=start, backfill_end=end)
            print(f"[backfill] {start} -> {end}")
        config["tax_bug"] = False
        bugged_dates = []

    else:  # load_next
        queue = [f.stem for f in sorted(INCOMING.glob("*.csv")) if f.stem not in loaded]
        if queue:
            name = queue[0]
            loaded.append(name)
            dbt_vars.update(backfill_start=name, backfill_end=name)
            if config["tax_bug"]:
                bugged_dates.append(name)
                snapshots[name] = day_net_total(day_rows(name), bugged=True)
                print(f"[pickup] {name}.csv (tax_bug is ON)")
            else:
                print(f"[pickup] {name}.csv")
        else:
            print("[pickup] every file is already loaded")

    write_json(LOADED_FILE, loaded)
    write_json(CONFIG_FILE, config)
    write_json(BUGGED_FILE, bugged_dates)
    write_json(SNAPSHOT_FILE, snapshots)
    write_json(VARS_FILE, dbt_vars)
    print(f"[seed] {write_seed(loaded)} records from {len(loaded)} file(s)")
    print(f"[vars] {json.dumps(dbt_vars)}")


if __name__ == "__main__":
    main()
