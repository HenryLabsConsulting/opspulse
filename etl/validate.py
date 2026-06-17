"""Schema validation for the seed CSVs.

The ETL refuses to load data it cannot trust. Before anything touches the
warehouse, each CSV is checked for the columns it must contain, for non-null
primary keys, and for unique primary keys. A failure raises ValidationError
with a clear message naming the file and the problem.
"""

from __future__ import annotations

import csv
from pathlib import Path


class ValidationError(Exception):
    """Raised when a seed CSV does not match its expected schema."""


# file stem -> (required columns, primary key column)
EXPECTED = {
    "technicians": (
        ["technician_id", "name", "region", "level", "hire_date", "bill_rate"],
        "technician_id",
    ),
    "service_types": (
        ["service_type", "category", "standard_price", "standard_duration_minutes"],
        "service_type",
    ),
    "customers": (
        ["customer_id", "name", "segment", "city", "region", "signup_date"],
        "customer_id",
    ),
    "jobs": (
        ["job_id", "date", "technician_id", "service_type", "category",
         "customer_id", "status", "first_time_fix", "duration_minutes",
         "revenue", "cost"],
        "job_id",
    ),
    "invoices": (
        ["invoice_id", "job_id", "issue_date", "amount", "status", "paid_date"],
        "invoice_id",
    ),
    "calls": (
        ["call_id", "date", "customer_id", "direction", "outcome", "duration_seconds"],
        "call_id",
    ),
    "reviews": (
        ["review_id", "job_id", "date", "rating", "comment"],
        "review_id",
    ),
}


def read_rows(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def validate_file(stem: str, rows: list[dict], header: list[str]) -> None:
    required, pk = EXPECTED[stem]

    missing = [c for c in required if c not in header]
    if missing:
        raise ValidationError(
            f"{stem}.csv is missing required columns: {', '.join(missing)}"
        )

    seen: set[str] = set()
    for i, row in enumerate(rows, start=2):  # row 1 is the header
        key = row.get(pk, "")
        if key is None or key == "":
            raise ValidationError(f"{stem}.csv row {i} has an empty primary key ({pk}).")
        if key in seen:
            raise ValidationError(f"{stem}.csv has a duplicate primary key {pk}={key}.")
        seen.add(key)


def validate_all(seed_dir: Path) -> dict[str, list[dict]]:
    """Validate every expected CSV and return the parsed rows keyed by stem."""
    data: dict[str, list[dict]] = {}
    for stem in EXPECTED:
        path = seed_dir / f"{stem}.csv"
        if not path.exists():
            raise ValidationError(f"Expected seed file not found: {path}")
        with path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            header = reader.fieldnames or []
            rows = list(reader)
        validate_file(stem, rows, header)
        data[stem] = rows
    return data
