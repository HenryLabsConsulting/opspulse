# ETL

This pipeline turns the committed seed CSVs into a clean PostgreSQL star schema
that the dashboard reads.

## What it does

1. **Validate.** Every CSV is checked for required columns and for non-null,
   unique primary keys before any data touches the warehouse. A bad file stops
   the run with a clear message. See `validate.py`.
2. **Build the schema.** `schema.sql` drops and recreates four dimensions and
   four facts. Running again always lands clean.
3. **Build the date dimension.** `dim_date` is generated from the full span of
   dates found across jobs, invoices, and calls, one row per calendar day.
4. **Load.** Dimensions load first, then facts. Service types resolve to surrogate
   keys so `fact_jobs` joins on `service_type_id`.

## Star schema

```
                 dim_date
                    |
   dim_technician --+-- dim_service_type
                    |
   fact_jobs -------+------- dim_customer
      |  \
      |   +-- fact_invoices
      |   +-- fact_reviews
      |
   fact_calls --- dim_customer
```

| Table | Grain | Key measures |
|-------|-------|--------------|
| `fact_jobs` | one row per job | revenue, cost, duration, first_time_fix |
| `fact_invoices` | one row per invoice | amount, status, paid_date |
| `fact_calls` | one row per call | duration, outcome |
| `fact_reviews` | one row per review | rating |

## Run it

The pipeline runs automatically as the `etl` service in `docker compose up`. To
run it by hand against a local Postgres:

```bash
pip install -r etl/requirements.txt
export DATABASE_URL=postgresql://opspulse:opspulse@localhost:5432/opspulse
python etl/load.py
```

Regenerate the seed data first if you want a different size or shape:

```bash
python generator/generate.py --months 24
```
