# OpsPulse

**Operations analytics that turns raw field-service records into decisions leaders can act on.**

OpsPulse shows a service company what is happening across its business in one place. Revenue, jobs completed, first-time-fix rate, average ticket, technician productivity, and job mix. A Daily Insights panel reads the latest week and writes a plain-language summary of what moved and why. The whole thing runs with one command.

This repository is a complete, deployed-shape application. It carries the data, the pipeline underneath, the API, the dashboard, the AI layer, and the infrastructure to run them together.

![OpsPulse dashboard](docs/dashboard.png)

> Live demo: _coming soon at_ `https://demo.henrylabs.net` _(run it locally today with the quick start below)._

*Built as a standalone, synthetic-data demo, modeled on the kind of operations-analytics system I build for service-business clients.*

---

## What it gives a business

- **A single view of operations.** Leaders see revenue and throughput trends without pulling reports.
- **A quality signal that protects margin.** First-time-fix rate is tracked because every callback costs money and goodwill.
- **Technician-level visibility.** Productivity and revenue per technician surface who is carrying the high-value work.
- **A weekly read in plain English.** The AI panel summarizes the week so the numbers come with a story.

## Quick start

You need Docker. One command brings up the database, loads the warehouse, and serves the dashboard.

```bash
git clone https://github.com/HenryLabsConsulting/opspulse.git
cd opspulse
docker compose up
```

Open http://localhost:3000.

The first run generates nothing and downloads nothing extra. The seed data is already committed. The ETL service loads it into Postgres, then the dashboard comes up populated.

The Daily Insights panel works with no API key. It serves a committed sample summary so anyone can run the full app. To have Claude write the summary live, set a key:

```bash
ANTHROPIC_API_KEY=sk-ant-... docker compose up
```

## Architecture

![Architecture](docs/architecture.svg)

The data flows in one direction. A Python generator produces realistic synthetic records. A Python ETL job validates them and loads a clean star schema in PostgreSQL. The Next.js app reads that warehouse through its own REST API and renders the dashboard. The AI layer calls Claude when a key is present and falls back to a committed summary when it is not.

| Layer | Technology | What it does |
|-------|-----------|--------------|
| Synthetic data | Python | Generates 18 months of jobs, technicians, invoices, calls, and reviews. Seeded and deterministic. |
| ETL | Python, psycopg | Validates schemas, then loads four dimensions and four facts into Postgres. |
| Warehouse | PostgreSQL 16 | Kimball-style star schema built for clean KPI rollups by day, month, and quarter. |
| API | Next.js route handlers | KPI queries over the warehouse, returned as JSON. |
| Dashboard | Next.js, React, Recharts | Overview, Operations, and a filter and export data explorer. |
| AI layer | Claude API | Reads the latest week and writes a plain-language summary. Demo mode needs no key. |
| Infrastructure | Docker Compose, GitHub Actions | One-command run. CI lints and tests both the pipeline and the app. |

## The pages

- **Overview.** Revenue, jobs completed, first-time-fix rate, average ticket, a revenue trend, and the Daily Insights panel.
- **Operations.** Technician productivity, revenue by service category, and the top technicians by revenue.
- **Data Explorer.** Every job record, with search, filters, sortable columns, grouping, and CSV export.

## The data

The data describes a fictional company, Northwind Field Services. It is entirely synthetic and built by `generator/generate.py`. The generator carries realistic shape: seasonal HVAC demand, weekend slowdowns, a slow growth trend, senior technicians with higher first-time-fix rates, and invoices that age into outstanding and overdue.

Regenerate or resize it any time:

```bash
python generator/generate.py --months 24
```

## Repository layout

```
opspulse/
  generator/   Synthetic data generator (Python) and its tests
  data/seed/   Committed seed CSVs
  etl/         Validation, star-schema DDL, and the loader (Python)
  web/         Next.js dashboard, REST API, and the AI insights layer
  tests/       Data integrity checks
  docs/        Architecture diagram and dashboard preview
  docker-compose.yml
```

## Running the pieces on their own

The whole stack runs with Docker. You can also run the parts directly.

```bash
# 1. Generate data (already committed, optional to rerun)
python generator/generate.py

# 2. Load a local Postgres
pip install -r etl/requirements.txt
export DATABASE_URL=postgresql://opspulse:opspulse@localhost:5432/opspulse
python etl/load.py

# 3. Run the dashboard
cd web
npm install
DATABASE_URL=$DATABASE_URL npm run dev
```

## Tests and CI

GitHub Actions runs on every push and pull request.

- **Data pipeline.** Ruff lint, pytest on the generator and validator, a check that the generator reproduces the committed seed data exactly, and data integrity tests.
- **Web app.** Lint and a production build.

Run them locally:

```bash
ruff check generator etl
pytest generator etl
node --test tests/data_integrity.test.mjs
cd web && npm run lint && npm run build
```

## Security and data

No real client data is used anywhere. No keys are committed. The AI layer reads a key from the environment only, and the repository ships a `.env.example` with placeholders. The `.gitignore` keeps real `.env` files out of version control.

## License

MIT. See [LICENSE](LICENSE).

---

Built by [HenryLabs Consulting](https://github.com/HenryLabsConsulting). Data and automation engineering: BI, custom apps, and AI systems.
