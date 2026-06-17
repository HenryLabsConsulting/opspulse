import { query } from "./db";

// All KPI SQL for the dashboard lives here. Money columns are cast to float8
// so the driver returns numbers instead of numeric strings.

export type OverviewKpis = {
  revenue: number;
  revenueDelta: number;
  jobsCompleted: number;
  jobsDelta: number;
  firstTimeFixRate: number;
  firstTimeFixDelta: number;
  avgTicket: number;
  avgTicketDelta: number;
  periodLabel: string;
};

export type TrendPoint = {
  month: string;
  revenue: number;
  jobsCompleted: number;
};

function delta(current: number, prior: number): number {
  if (prior === 0) return 0;
  return (current - prior) / prior;
}

export async function getOverviewKpis(): Promise<OverviewKpis> {
  const rows = await query<{
    cur_revenue: number;
    prior_revenue: number;
    cur_jobs: number;
    prior_jobs: number;
    cur_ftf: number;
    prior_ftf: number;
    cur_completed: number;
    prior_completed: number;
  }>(`
    WITH periods AS (
      SELECT
        (SELECT MAX(full_date) FROM dim_date)                       AS max_date,
        (SELECT MAX(full_date) FROM dim_date) - INTERVAL '29 days'  AS cur_start,
        (SELECT MAX(full_date) FROM dim_date) - INTERVAL '59 days'  AS prior_start,
        (SELECT MAX(full_date) FROM dim_date) - INTERVAL '30 days'  AS prior_end
    )
    SELECT
      COALESCE(SUM(fj.revenue) FILTER (
        WHERE fj.status = 'Completed' AND d.full_date >= p.cur_start), 0)::float8 AS cur_revenue,
      COALESCE(SUM(fj.revenue) FILTER (
        WHERE fj.status = 'Completed' AND d.full_date >= p.prior_start
          AND d.full_date <= p.prior_end), 0)::float8 AS prior_revenue,
      COUNT(*) FILTER (
        WHERE fj.status = 'Completed' AND d.full_date >= p.cur_start)::int AS cur_jobs,
      COUNT(*) FILTER (
        WHERE fj.status = 'Completed' AND d.full_date >= p.prior_start
          AND d.full_date <= p.prior_end)::int AS prior_jobs,
      COUNT(*) FILTER (
        WHERE fj.status = 'Completed' AND fj.first_time_fix
          AND d.full_date >= p.cur_start)::int AS cur_ftf,
      COUNT(*) FILTER (
        WHERE fj.status = 'Completed' AND fj.first_time_fix
          AND d.full_date >= p.prior_start AND d.full_date <= p.prior_end)::int AS prior_ftf,
      COUNT(*) FILTER (
        WHERE fj.status = 'Completed' AND d.full_date >= p.cur_start)::int AS cur_completed,
      COUNT(*) FILTER (
        WHERE fj.status = 'Completed' AND d.full_date >= p.prior_start
          AND d.full_date <= p.prior_end)::int AS prior_completed
    FROM fact_jobs fj
    JOIN dim_date d ON d.date_key = fj.date_key
    CROSS JOIN periods p
  `);

  const r = rows[0];
  const curFtfRate = r.cur_completed ? r.cur_ftf / r.cur_completed : 0;
  const priorFtfRate = r.prior_completed ? r.prior_ftf / r.prior_completed : 0;
  const curAvgTicket = r.cur_jobs ? r.cur_revenue / r.cur_jobs : 0;
  const priorAvgTicket = r.prior_jobs ? r.prior_revenue / r.prior_jobs : 0;

  return {
    revenue: r.cur_revenue,
    revenueDelta: delta(r.cur_revenue, r.prior_revenue),
    jobsCompleted: r.cur_jobs,
    jobsDelta: delta(r.cur_jobs, r.prior_jobs),
    firstTimeFixRate: curFtfRate,
    firstTimeFixDelta: curFtfRate - priorFtfRate,
    avgTicket: curAvgTicket,
    avgTicketDelta: delta(curAvgTicket, priorAvgTicket),
    periodLabel: "Last 30 days vs prior 30 days",
  };
}

export async function getRevenueTrend(): Promise<TrendPoint[]> {
  return query<TrendPoint>(`
    SELECT
      to_char(date_trunc('month', d.full_date), 'YYYY-MM')   AS month,
      COALESCE(SUM(fj.revenue) FILTER (WHERE fj.status = 'Completed'), 0)::float8 AS revenue,
      COUNT(*) FILTER (WHERE fj.status = 'Completed')::int    AS "jobsCompleted"
    FROM fact_jobs fj
    JOIN dim_date d ON d.date_key = fj.date_key
    GROUP BY 1
    ORDER BY 1
  `);
}

export type TechnicianRow = {
  name: string;
  region: string;
  level: string;
  jobsCompleted: number;
  revenue: number;
  avgDuration: number;
  firstTimeFixRate: number;
};

export async function getTechnicianProductivity(): Promise<TechnicianRow[]> {
  return query<TechnicianRow>(`
    SELECT
      t.name,
      t.region,
      t.level,
      COUNT(*) FILTER (WHERE fj.status = 'Completed')::int AS "jobsCompleted",
      COALESCE(SUM(fj.revenue) FILTER (WHERE fj.status = 'Completed'), 0)::float8 AS revenue,
      COALESCE(AVG(fj.duration_minutes) FILTER (WHERE fj.status = 'Completed'), 0)::float8 AS "avgDuration",
      (COUNT(*) FILTER (WHERE fj.status = 'Completed' AND fj.first_time_fix)::float8
        / NULLIF(COUNT(*) FILTER (WHERE fj.status = 'Completed'), 0))::float8 AS "firstTimeFixRate"
    FROM fact_jobs fj
    JOIN dim_technician t ON t.technician_id = fj.technician_id
    GROUP BY t.technician_id, t.name, t.region, t.level
    ORDER BY revenue DESC
  `);
}

export type JobMixRow = {
  label: string;
  jobs: number;
  revenue: number;
};

export async function getJobMixByCategory(): Promise<JobMixRow[]> {
  return query<JobMixRow>(`
    SELECT
      s.category AS label,
      COUNT(*) FILTER (WHERE fj.status = 'Completed')::int AS jobs,
      COALESCE(SUM(fj.revenue) FILTER (WHERE fj.status = 'Completed'), 0)::float8 AS revenue
    FROM fact_jobs fj
    JOIN dim_service_type s ON s.service_type_id = fj.service_type_id
    GROUP BY s.category
    ORDER BY revenue DESC
  `);
}

export async function getJobMixByService(): Promise<JobMixRow[]> {
  return query<JobMixRow>(`
    SELECT
      s.service_type AS label,
      COUNT(*) FILTER (WHERE fj.status = 'Completed')::int AS jobs,
      COALESCE(SUM(fj.revenue) FILTER (WHERE fj.status = 'Completed'), 0)::float8 AS revenue
    FROM fact_jobs fj
    JOIN dim_service_type s ON s.service_type_id = fj.service_type_id
    GROUP BY s.service_type
    ORDER BY revenue DESC
  `);
}

export type JobTableRow = {
  jobId: number;
  date: string;
  technician: string;
  serviceType: string;
  category: string;
  customer: string;
  segment: string;
  region: string;
  status: string;
  firstTimeFix: boolean;
  durationMinutes: number;
  revenue: number;
};

// The data-explorer table loads the most recent jobs and lets the browser
// filter, sort, group, and export. A few thousand rows stay snappy client-side.
export async function getJobsTable(limit = 3000): Promise<JobTableRow[]> {
  return query<JobTableRow>(
    `
    SELECT
      fj.job_id                  AS "jobId",
      to_char(d.full_date, 'YYYY-MM-DD') AS date,
      t.name                     AS technician,
      s.service_type             AS "serviceType",
      s.category                 AS category,
      c.name                     AS customer,
      c.segment                  AS segment,
      c.region                   AS region,
      fj.status                  AS status,
      fj.first_time_fix          AS "firstTimeFix",
      fj.duration_minutes        AS "durationMinutes",
      fj.revenue::float8         AS revenue
    FROM fact_jobs fj
    JOIN dim_date d         ON d.date_key = fj.date_key
    JOIN dim_technician t   ON t.technician_id = fj.technician_id
    JOIN dim_service_type s ON s.service_type_id = fj.service_type_id
    JOIN dim_customer c     ON c.customer_id = fj.customer_id
    ORDER BY d.full_date DESC, fj.job_id DESC
    LIMIT $1
  `,
    [limit]
  );
}
