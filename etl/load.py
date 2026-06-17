"""Load the validated seed CSVs into the PostgreSQL star schema.

Pipeline:
    1. Validate every CSV against its expected schema (etl/validate.py).
    2. Create the warehouse schema (etl/schema.sql).
    3. Build dim_date from the full range of dates seen in the facts.
    4. Load the four dimensions, then the four facts.

The loader is idempotent. It drops and rebuilds the schema on every run, so a
fresh `docker compose up` always lands clean, reproducible data.

Connection settings come from the environment:
    DATABASE_URL   e.g. postgresql://opspulse:opspulse@db:5432/opspulse
or the individual PG* variables that psycopg understands.
"""

from __future__ import annotations

import os
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values
from validate import ValidationError, validate_all

ROOT = Path(__file__).resolve().parent
SEED_DIR = Path(os.environ.get("SEED_DIR", ROOT.parent / "data" / "seed"))
SCHEMA_SQL = ROOT / "schema.sql"

MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
               "July", "August", "September", "October", "November", "December"]
WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday",
                 "Friday", "Saturday", "Sunday"]


def connect(retries: int = 30, delay: float = 2.0):
    """Connect to Postgres, waiting for it to accept connections."""
    dsn = os.environ.get("DATABASE_URL")
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            if dsn:
                return psycopg2.connect(dsn)
            return psycopg2.connect()  # falls back to PG* env vars
        except psycopg2.OperationalError as err:
            last_err = err
            print(f"  database not ready (attempt {attempt}/{retries}); retrying...")
            time.sleep(delay)
    raise SystemExit(f"Could not connect to the database: {last_err}")


def date_key(d: date) -> int:
    return d.year * 10000 + d.month * 100 + d.day


def parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def build_dim_date(jobs, invoices, calls) -> list[tuple]:
    """Build one dim_date row per calendar day across the full fact range."""
    all_dates: set[date] = set()
    for row in jobs:
        all_dates.add(parse_date(row["date"]))
    for row in invoices:
        all_dates.add(parse_date(row["issue_date"]))
        if row["paid_date"]:
            all_dates.add(parse_date(row["paid_date"]))
    for row in calls:
        all_dates.add(parse_date(row["date"]))

    lo, hi = min(all_dates), max(all_dates)
    rows: list[tuple] = []
    current = lo
    while current <= hi:
        rows.append((
            date_key(current),
            current,
            current.year,
            (current.month - 1) // 3 + 1,
            current.month,
            MONTH_NAMES[current.month - 1],
            current.day,
            current.weekday(),
            WEEKDAY_NAMES[current.weekday()],
            current.weekday() >= 5,
            current.isocalendar().week,
        ))
        current += timedelta(days=1)
    return rows


def load(conn, data: dict[str, list[dict]]) -> dict[str, int]:
    cur = conn.cursor()

    print("Creating warehouse schema...")
    cur.execute(SCHEMA_SQL.read_text(encoding="utf-8"))

    counts: dict[str, int] = {}

    # dim_date -----------------------------------------------------------
    print("Loading dim_date...")
    date_rows = build_dim_date(data["jobs"], data["invoices"], data["calls"])
    execute_values(
        cur,
        """INSERT INTO dim_date
           (date_key, full_date, year, quarter, month, month_name, day,
            day_of_week, weekday_name, is_weekend, week_of_year)
           VALUES %s""",
        date_rows,
    )
    counts["dim_date"] = len(date_rows)

    # dim_technician -----------------------------------------------------
    print("Loading dim_technician...")
    tech_rows = [
        (int(r["technician_id"]), r["name"], r["region"], r["level"],
         parse_date(r["hire_date"]), float(r["bill_rate"]))
        for r in data["technicians"]
    ]
    execute_values(
        cur,
        """INSERT INTO dim_technician
           (technician_id, name, region, level, hire_date, bill_rate)
           VALUES %s""",
        tech_rows,
    )
    counts["dim_technician"] = len(tech_rows)

    # dim_service_type ---------------------------------------------------
    print("Loading dim_service_type...")
    service_rows = [
        (r["service_type"], r["category"], float(r["standard_price"]),
         int(r["standard_duration_minutes"]))
        for r in data["service_types"]
    ]
    execute_values(
        cur,
        """INSERT INTO dim_service_type
           (service_type, category, standard_price, standard_duration_minutes)
           VALUES %s""",
        service_rows,
    )
    counts["dim_service_type"] = len(service_rows)

    cur.execute("SELECT service_type, service_type_id FROM dim_service_type")
    service_id = dict(cur.fetchall())

    # dim_customer -------------------------------------------------------
    print("Loading dim_customer...")
    customer_rows = [
        (int(r["customer_id"]), r["name"], r["segment"], r["city"], r["region"],
         parse_date(r["signup_date"]))
        for r in data["customers"]
    ]
    execute_values(
        cur,
        """INSERT INTO dim_customer
           (customer_id, name, segment, city, region, signup_date)
           VALUES %s""",
        customer_rows,
    )
    counts["dim_customer"] = len(customer_rows)

    # fact_jobs ----------------------------------------------------------
    print("Loading fact_jobs...")
    job_rows = [
        (int(r["job_id"]), date_key(parse_date(r["date"])),
         int(r["technician_id"]), service_id[r["service_type"]],
         int(r["customer_id"]), r["status"], r["first_time_fix"] == "1",
         int(r["duration_minutes"]), float(r["revenue"]), float(r["cost"]))
        for r in data["jobs"]
    ]
    execute_values(
        cur,
        """INSERT INTO fact_jobs
           (job_id, date_key, technician_id, service_type_id, customer_id,
            status, first_time_fix, duration_minutes, revenue, cost)
           VALUES %s""",
        job_rows,
    )
    counts["fact_jobs"] = len(job_rows)

    # fact_invoices ------------------------------------------------------
    print("Loading fact_invoices...")
    invoice_rows = [
        (int(r["invoice_id"]), int(r["job_id"]),
         date_key(parse_date(r["issue_date"])), float(r["amount"]), r["status"],
         parse_date(r["paid_date"]) if r["paid_date"] else None)
        for r in data["invoices"]
    ]
    execute_values(
        cur,
        """INSERT INTO fact_invoices
           (invoice_id, job_id, date_key, amount, status, paid_date)
           VALUES %s""",
        invoice_rows,
    )
    counts["fact_invoices"] = len(invoice_rows)

    # fact_calls ---------------------------------------------------------
    print("Loading fact_calls...")
    call_rows = [
        (int(r["call_id"]), date_key(parse_date(r["date"])),
         int(r["customer_id"]), r["direction"], r["outcome"],
         int(r["duration_seconds"]))
        for r in data["calls"]
    ]
    execute_values(
        cur,
        """INSERT INTO fact_calls
           (call_id, date_key, customer_id, direction, outcome, duration_seconds)
           VALUES %s""",
        call_rows,
    )
    counts["fact_calls"] = len(call_rows)

    # fact_reviews -------------------------------------------------------
    print("Loading fact_reviews...")
    review_rows = [
        (int(r["review_id"]), int(r["job_id"]),
         date_key(parse_date(r["date"])), int(r["rating"]), r["comment"])
        for r in data["reviews"]
    ]
    execute_values(
        cur,
        """INSERT INTO fact_reviews
           (review_id, job_id, date_key, rating, comment)
           VALUES %s""",
        review_rows,
    )
    counts["fact_reviews"] = len(review_rows)

    conn.commit()
    cur.close()
    return counts


def main() -> None:
    print(f"OpsPulse ETL starting. Reading seed data from {SEED_DIR}")
    try:
        data = validate_all(SEED_DIR)
    except ValidationError as err:
        print(f"Validation failed: {err}", file=sys.stderr)
        raise SystemExit(1) from err
    print("Validation passed for all seed files.")

    conn = connect()
    try:
        counts = load(conn, data)
    finally:
        conn.close()

    print("\nLoad complete:")
    for table, count in counts.items():
        print(f"  {table:<18} {count:>8,}")


if __name__ == "__main__":
    main()
