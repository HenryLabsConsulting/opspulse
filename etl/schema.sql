-- OpsPulse warehouse schema for Northwind Field Services.
--
-- A small Kimball-style star schema. Four conformed dimensions describe the
-- business entities. Three fact tables hold the measurable events: jobs,
-- invoices, and calls. Reviews are kept as a supporting fact for service
-- quality. Every fact joins to dim_date so trends roll up cleanly by day,
-- month, quarter, and year.

DROP TABLE IF EXISTS fact_reviews   CASCADE;
DROP TABLE IF EXISTS fact_calls     CASCADE;
DROP TABLE IF EXISTS fact_invoices  CASCADE;
DROP TABLE IF EXISTS fact_jobs      CASCADE;
DROP TABLE IF EXISTS dim_customer   CASCADE;
DROP TABLE IF EXISTS dim_service_type CASCADE;
DROP TABLE IF EXISTS dim_technician CASCADE;
DROP TABLE IF EXISTS dim_date       CASCADE;

-- ---------------------------------------------------------------------------
-- Dimensions
-- ---------------------------------------------------------------------------

CREATE TABLE dim_date (
    date_key      INTEGER     PRIMARY KEY,   -- YYYYMMDD
    full_date     DATE        NOT NULL,
    year          INTEGER     NOT NULL,
    quarter       INTEGER     NOT NULL,
    month         INTEGER     NOT NULL,
    month_name    TEXT        NOT NULL,
    day           INTEGER     NOT NULL,
    day_of_week   INTEGER     NOT NULL,      -- 0 = Monday
    weekday_name  TEXT        NOT NULL,
    is_weekend    BOOLEAN     NOT NULL,
    week_of_year  INTEGER     NOT NULL
);

CREATE TABLE dim_technician (
    technician_id INTEGER     PRIMARY KEY,
    name          TEXT        NOT NULL,
    region        TEXT        NOT NULL,
    level         TEXT        NOT NULL,
    hire_date     DATE        NOT NULL,
    bill_rate     NUMERIC(8,2) NOT NULL
);

CREATE TABLE dim_service_type (
    service_type_id           SERIAL  PRIMARY KEY,
    service_type              TEXT    NOT NULL UNIQUE,
    category                  TEXT    NOT NULL,
    standard_price            NUMERIC(10,2) NOT NULL,
    standard_duration_minutes INTEGER NOT NULL
);

CREATE TABLE dim_customer (
    customer_id   INTEGER     PRIMARY KEY,
    name          TEXT        NOT NULL,
    segment       TEXT        NOT NULL,
    city          TEXT        NOT NULL,
    region        TEXT        NOT NULL,
    signup_date   DATE        NOT NULL
);

-- ---------------------------------------------------------------------------
-- Facts
-- ---------------------------------------------------------------------------

CREATE TABLE fact_jobs (
    job_id           INTEGER  PRIMARY KEY,
    date_key         INTEGER  NOT NULL REFERENCES dim_date(date_key),
    technician_id    INTEGER  NOT NULL REFERENCES dim_technician(technician_id),
    service_type_id  INTEGER  NOT NULL REFERENCES dim_service_type(service_type_id),
    customer_id      INTEGER  NOT NULL REFERENCES dim_customer(customer_id),
    status           TEXT     NOT NULL,
    first_time_fix   BOOLEAN  NOT NULL,
    duration_minutes INTEGER  NOT NULL,
    revenue          NUMERIC(10,2) NOT NULL,
    cost             NUMERIC(10,2) NOT NULL
);

CREATE TABLE fact_invoices (
    invoice_id   INTEGER  PRIMARY KEY,
    job_id       INTEGER  NOT NULL REFERENCES fact_jobs(job_id),
    date_key     INTEGER  NOT NULL REFERENCES dim_date(date_key),
    amount       NUMERIC(10,2) NOT NULL,
    status       TEXT     NOT NULL,
    paid_date    DATE
);

CREATE TABLE fact_calls (
    call_id          INTEGER  PRIMARY KEY,
    date_key         INTEGER  NOT NULL REFERENCES dim_date(date_key),
    customer_id      INTEGER  NOT NULL REFERENCES dim_customer(customer_id),
    direction        TEXT     NOT NULL,
    outcome          TEXT     NOT NULL,
    duration_seconds INTEGER  NOT NULL
);

CREATE TABLE fact_reviews (
    review_id    INTEGER  PRIMARY KEY,
    job_id       INTEGER  NOT NULL REFERENCES fact_jobs(job_id),
    date_key     INTEGER  NOT NULL REFERENCES dim_date(date_key),
    rating       INTEGER  NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment      TEXT     NOT NULL
);

-- Indexes that match the dashboard query patterns: filter and group by date,
-- technician, service, and customer.
CREATE INDEX idx_jobs_date    ON fact_jobs(date_key);
CREATE INDEX idx_jobs_tech    ON fact_jobs(technician_id);
CREATE INDEX idx_jobs_service ON fact_jobs(service_type_id);
CREATE INDEX idx_jobs_status  ON fact_jobs(status);
CREATE INDEX idx_invoices_date ON fact_invoices(date_key);
CREATE INDEX idx_calls_date    ON fact_calls(date_key);
CREATE INDEX idx_reviews_date  ON fact_reviews(date_key);
