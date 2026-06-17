"""Tests for the synthetic data generator."""

import csv
from pathlib import Path

from generate import generate


def _read(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def test_generation_is_deterministic(tmp_path):
    """The same seed must produce identical output every run."""
    out_a = tmp_path / "a"
    out_b = tmp_path / "b"
    counts_a = generate(months=6, out_dir=out_a)
    counts_b = generate(months=6, out_dir=out_b)

    assert counts_a == counts_b
    for name in counts_a:
        assert (out_a / f"{name}.csv").read_text() == (out_b / f"{name}.csv").read_text()


def test_expected_files_and_columns(tmp_path):
    generate(months=3, out_dir=tmp_path)

    jobs = _read(tmp_path / "jobs.csv")
    assert len(jobs) > 0
    expected_cols = {
        "job_id", "date", "technician_id", "service_type", "category",
        "customer_id", "status", "first_time_fix", "duration_minutes",
        "revenue", "cost",
    }
    assert expected_cols.issubset(jobs[0].keys())


def test_referential_integrity(tmp_path):
    """Every job references a real technician, customer, and service type."""
    generate(months=3, out_dir=tmp_path)

    techs = {r["technician_id"] for r in _read(tmp_path / "technicians.csv")}
    customers = {r["customer_id"] for r in _read(tmp_path / "customers.csv")}
    services = {r["service_type"] for r in _read(tmp_path / "service_types.csv")}

    for job in _read(tmp_path / "jobs.csv"):
        assert job["technician_id"] in techs
        assert job["customer_id"] in customers
        assert job["service_type"] in services


def test_completed_jobs_have_revenue(tmp_path):
    generate(months=3, out_dir=tmp_path)
    for job in _read(tmp_path / "jobs.csv"):
        if job["status"] == "Completed":
            assert float(job["revenue"]) > 0
        else:
            assert float(job["revenue"]) == 0
