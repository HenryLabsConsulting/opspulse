# Design Decisions

Short record of the choices behind OpsPulse and the reasoning for each. The goal of the project is a deployed-shape operations-analytics application that anyone can run in one command on fully synthetic data.

## 1. A star schema, not a wide flat table

Field-service records arrive as transactional rows: a job, a technician, a date, an amount, an outcome. The warehouse models these as a fact table of jobs surrounded by dimensions (date, technician, service type). A star schema keeps aggregation fast and the measure logic readable, and it is the shape a BI tool expects. A single wide table would have been quicker to load and worse at everything after that.

## 2. A deterministic synthetic generator instead of a static sample file

The data is produced by a seeded generator, not committed as a frozen dump. That makes the dataset reproducible, lets the volume and time window scale, and keeps the repo free of any real business data. The generator writes with fixed line endings so the committed data matches what CI regenerates, and CI checks that.

## 3. Next.js API routes, not a separate backend service

The dashboard and its API live in one Next.js application. With the database and the app as the only two containers, a separate Flask or Express service would have added a moving part without adding capability. Co-locating the API with the frontend keeps the compose file to two services and the request path short.

## 4. An AI insights layer with a keyless demo mode

The Daily Insights panel reads the latest week and writes a plain-language summary. It calls the Claude API when a key is present, and falls back to a committed, templated summary when one is not. That fallback is deliberate: anyone can clone the repo and see the full application, AI panel included, without supplying credentials. The AI is a product feature, not a gate on running the demo.

## 5. First-time-fix rate as a first-class metric

The dashboard treats first-time-fix rate as a headline number rather than a buried detail, because in field service every callback costs margin and goodwill. Choosing which metrics are prominent is a product decision, and this one reflects what actually protects a service business's economics.

## 6. One command to run everything

`docker compose up` brings up the database, loads the warehouse, and serves the dashboard. The point of a portfolio build is that it runs, not that it claims to. Keeping startup to a single command, with green CI proving it builds, is the difference between a demo and a description of one.
