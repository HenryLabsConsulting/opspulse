"""Synthetic data generator for Northwind Field Services.

Produces realistic but entirely fake operational data for OpsPulse:
technicians, service types, customers, jobs, invoices, calls, and reviews.

The output is deterministic. A fixed seed means every run produces the same
CSVs, so the committed seed data and the generator always agree. Run this to
regenerate the data set or to change its size and shape.

Usage:
    python generator/generate.py
    python generator/generate.py --months 18 --out data/seed
"""

from __future__ import annotations

import argparse
import csv
import math
import random
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path

SEED = 20260616

# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------

REGIONS = ["North", "South", "East", "West", "Central"]

TECH_LEVELS = [
    ("Apprentice", 0.85, 95.0),   # (level, productivity factor, hourly bill rate)
    ("Technician", 1.00, 120.0),
    ("Senior", 1.12, 150.0),
    ("Lead", 1.20, 185.0),
]

FIRST_NAMES = [
    "James", "Maria", "David", "Sarah", "Michael", "Linda", "Robert", "Patricia",
    "John", "Jennifer", "William", "Elizabeth", "Richard", "Barbara", "Joseph",
    "Susan", "Thomas", "Jessica", "Charles", "Karen", "Daniel", "Nancy", "Matthew",
    "Lisa", "Anthony", "Betty", "Mark", "Sandra", "Steven", "Ashley",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
]

# service_type, category, base_price, base_duration_minutes, parts_cost
SERVICE_TYPES = [
    ("AC Repair", "HVAC", 285.0, 90, 70.0),
    ("AC Installation", "HVAC", 3800.0, 300, 2600.0),
    ("Furnace Repair", "HVAC", 320.0, 100, 85.0),
    ("Furnace Installation", "HVAC", 4200.0, 330, 2900.0),
    ("Heat Pump Service", "HVAC", 240.0, 80, 55.0),
    ("Drain Cleaning", "Plumbing", 195.0, 60, 25.0),
    ("Water Heater Repair", "Plumbing", 310.0, 95, 90.0),
    ("Water Heater Install", "Plumbing", 1650.0, 180, 950.0),
    ("Leak Detection", "Plumbing", 225.0, 75, 30.0),
    ("Panel Upgrade", "Electrical", 2100.0, 240, 1200.0),
    ("Outlet & Wiring", "Electrical", 175.0, 60, 40.0),
    ("Lighting Install", "Electrical", 340.0, 110, 145.0),
    ("Thermostat Install", "HVAC", 260.0, 70, 130.0),
    ("Preventive Maintenance", "HVAC", 145.0, 60, 15.0),
]

CITIES = [
    ("Northwind", "North"), ("Lakeshore", "North"), ("Riverton", "East"),
    ("Maple Grove", "West"), ("Fairview", "South"), ("Oakdale", "Central"),
    ("Brookfield", "East"), ("Cedar Falls", "West"), ("Glenwood", "South"),
    ("Pinehurst", "Central"),
]

JOB_STATUSES = ["Completed", "Completed", "Completed", "Completed",
                "Completed", "Completed", "Cancelled", "Rescheduled"]

INVOICE_STATUSES = ["Paid", "Paid", "Paid", "Paid", "Outstanding", "Overdue"]

REVIEW_COMMENTS = {
    5: ["Excellent service, on time and professional.",
        "Technician fixed it fast and explained everything.",
        "Could not be happier. Highly recommend."],
    4: ["Good work, arrived a little late but solved the issue.",
        "Solid service, fair price.",
        "Happy with the repair overall."],
    3: ["Job got done but took longer than expected.",
        "Okay service, communication could improve.",
        "Average experience."],
    2: ["Had to call back for a second visit.",
        "Pricing was higher than quoted.",
        "Slow to schedule."],
    1: ["Issue was not fully resolved.",
        "Disappointed with the turnaround.",
        "Would not book again."],
}


@dataclass
class Tech:
    technician_id: int
    name: str
    region: str
    level: str
    productivity: float
    bill_rate: float
    hire_date: date


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def seasonal_demand(d: date) -> float:
    """A demand multiplier that peaks in summer and winter (HVAC seasonality)."""
    # Two peaks: cooling season (~July) and heating season (~January).
    day_of_year = d.timetuple().tm_yday
    summer = math.cos((day_of_year - 196) / 365 * 2 * math.pi)
    winter = math.cos((day_of_year - 15) / 365 * 2 * math.pi)
    base = 1.0 + 0.35 * max(summer, winter)
    # Weekends are slower.
    if d.weekday() >= 5:
        base *= 0.55
    return base


def money(value: float) -> float:
    return round(value, 2)


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------

def build_technicians(rng: random.Random, n: int, end: date) -> list[Tech]:
    techs: list[Tech] = []
    used_names: set[str] = set()
    for i in range(1, n + 1):
        while True:
            name = f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"
            if name not in used_names:
                used_names.add(name)
                break
        level, productivity, bill_rate = rng.choices(
            TECH_LEVELS, weights=[3, 4, 2, 1]
        )[0]
        hire_days_ago = rng.randint(180, 2200)
        techs.append(
            Tech(
                technician_id=i,
                name=name,
                region=rng.choice(REGIONS),
                level=level,
                productivity=productivity,
                bill_rate=bill_rate,
                hire_date=end - timedelta(days=hire_days_ago),
            )
        )
    return techs


def build_customers(rng: random.Random, n: int, end: date) -> list[dict]:
    customers: list[dict] = []
    for i in range(1, n + 1):
        city, region = rng.choice(CITIES)
        segment = "Commercial" if rng.random() < 0.28 else "Residential"
        signup_days_ago = rng.randint(30, 1500)
        customers.append(
            {
                "customer_id": i,
                "name": (f"{rng.choice(['Apex', 'Summit', 'Harbor', 'Vista', 'Anchor'])} "
                         f"{rng.choice(['Properties', 'Retail', 'Logistics', 'Group', 'Holdings'])}")
                if segment == "Commercial"
                else f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}",
                "segment": segment,
                "city": city,
                "region": region,
                "signup_date": (end - timedelta(days=signup_days_ago)).isoformat(),
            }
        )
    return customers


def generate(months: int, out_dir: Path) -> dict[str, int]:
    rng = random.Random(SEED)
    end = date(2026, 6, 15)
    start = end - timedelta(days=months * 30)

    techs = build_technicians(rng, 24, end)
    customers = build_customers(rng, 600, end)

    jobs: list[dict] = []
    invoices: list[dict] = []
    calls: list[dict] = []
    reviews: list[dict] = []

    job_id = 0
    invoice_id = 0
    call_id = 0
    review_id = 0

    day = start
    while day <= end:
        demand = seasonal_demand(day)
        # Slow upward growth trend across the window.
        trend = 1.0 + 0.18 * ((day - start).days / max((end - start).days, 1))
        daily_jobs = max(0, int(rng.gauss(22 * demand * trend, 4)))

        # Calls roughly track demand and exceed booked jobs.
        daily_calls = max(0, int(rng.gauss(daily_jobs * 1.6, 5)))
        for _ in range(daily_calls):
            call_id += 1
            outcome = rng.choices(
                ["Booked", "Information", "Missed"], weights=[55, 30, 15]
            )[0]
            calls.append(
                {
                    "call_id": call_id,
                    "date": day.isoformat(),
                    "customer_id": rng.choice(customers)["customer_id"],
                    "direction": rng.choices(["Inbound", "Outbound"], weights=[80, 20])[0],
                    "outcome": outcome,
                    "duration_seconds": max(20, int(rng.gauss(220, 90))),
                }
            )

        for _ in range(daily_jobs):
            job_id += 1
            tech = rng.choice(techs)
            svc_name, category, base_price, base_dur, parts_cost = rng.choice(SERVICE_TYPES)
            customer = rng.choice(customers)
            status = rng.choice(JOB_STATUSES)

            # Senior techs fix first-time more often.
            ftf_prob = 0.78 + (tech.productivity - 1.0) * 0.4
            first_time_fix = status == "Completed" and rng.random() < ftf_prob

            duration = int(base_dur / tech.productivity * rng.uniform(0.85, 1.3))
            price_noise = rng.uniform(0.92, 1.18)
            revenue = money(base_price * price_noise) if status == "Completed" else 0.0
            cost = money(parts_cost * rng.uniform(0.9, 1.15) +
                         (duration / 60.0) * tech.bill_rate * 0.45)

            jobs.append(
                {
                    "job_id": job_id,
                    "date": day.isoformat(),
                    "technician_id": tech.technician_id,
                    "service_type": svc_name,
                    "category": category,
                    "customer_id": customer["customer_id"],
                    "status": status,
                    "first_time_fix": int(first_time_fix),
                    "duration_minutes": duration,
                    "revenue": revenue,
                    "cost": cost if status == "Completed" else 0.0,
                }
            )

            if status == "Completed":
                invoice_id += 1
                inv_status = rng.choice(INVOICE_STATUSES)
                issued = day + timedelta(days=rng.randint(0, 2))
                paid_date = ""
                if inv_status == "Paid":
                    paid_date = (issued + timedelta(days=rng.randint(1, 30))).isoformat()
                invoices.append(
                    {
                        "invoice_id": invoice_id,
                        "job_id": job_id,
                        "issue_date": issued.isoformat(),
                        "amount": revenue,
                        "status": inv_status,
                        "paid_date": paid_date,
                    }
                )

                # Roughly 40% of completed jobs leave a review.
                if rng.random() < 0.40:
                    review_id += 1
                    if first_time_fix:
                        rating = rng.choices([5, 4, 3, 2, 1], weights=[50, 30, 12, 5, 3])[0]
                    else:
                        rating = rng.choices([5, 4, 3, 2, 1], weights=[20, 25, 25, 18, 12])[0]
                    reviews.append(
                        {
                            "review_id": review_id,
                            "job_id": job_id,
                            "date": (day + timedelta(days=rng.randint(1, 7))).isoformat(),
                            "rating": rating,
                            "comment": rng.choice(REVIEW_COMMENTS[rating]),
                        }
                    )

        day += timedelta(days=1)

    out_dir.mkdir(parents=True, exist_ok=True)

    _write_csv(out_dir / "technicians.csv",
               ["technician_id", "name", "region", "level", "hire_date", "bill_rate"],
               [{"technician_id": t.technician_id, "name": t.name, "region": t.region,
                 "level": t.level, "hire_date": t.hire_date.isoformat(),
                 "bill_rate": t.bill_rate} for t in techs])

    _write_csv(out_dir / "service_types.csv",
               ["service_type", "category", "standard_price", "standard_duration_minutes"],
               [{"service_type": s[0], "category": s[1], "standard_price": s[2],
                 "standard_duration_minutes": s[3]} for s in SERVICE_TYPES])

    _write_csv(out_dir / "customers.csv",
               ["customer_id", "name", "segment", "city", "region", "signup_date"],
               customers)

    _write_csv(out_dir / "jobs.csv",
               ["job_id", "date", "technician_id", "service_type", "category",
                "customer_id", "status", "first_time_fix", "duration_minutes",
                "revenue", "cost"],
               jobs)

    _write_csv(out_dir / "invoices.csv",
               ["invoice_id", "job_id", "issue_date", "amount", "status", "paid_date"],
               invoices)

    _write_csv(out_dir / "calls.csv",
               ["call_id", "date", "customer_id", "direction", "outcome", "duration_seconds"],
               calls)

    _write_csv(out_dir / "reviews.csv",
               ["review_id", "job_id", "date", "rating", "comment"],
               reviews)

    return {
        "technicians": len(techs),
        "service_types": len(SERVICE_TYPES),
        "customers": len(customers),
        "jobs": len(jobs),
        "invoices": len(invoices),
        "calls": len(calls),
        "reviews": len(reviews),
    }


def _write_csv(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic field-service data.")
    parser.add_argument("--months", type=int, default=18,
                        help="Months of history to generate (default 18).")
    parser.add_argument("--out", type=str, default="data/seed",
                        help="Output directory for CSV files.")
    args = parser.parse_args()

    started = datetime.now()
    counts = generate(args.months, Path(args.out))
    elapsed = (datetime.now() - started).total_seconds()

    print(f"Generated synthetic data in {elapsed:.1f}s:")
    for name, count in counts.items():
        print(f"  {name:<14} {count:>8,}")
    print(f"Output written to {args.out}/")


if __name__ == "__main__":
    main()
