import Anthropic from "@anthropic-ai/sdk";
import { query } from "./db";
import { formatCurrency, formatPercent } from "./format";

// The Daily Insights panel reads the latest week of data and explains what
// moved. The numbers are always computed live from the warehouse. The
// narrative comes from Claude when ANTHROPIC_API_KEY is set, and from a
// committed template otherwise, so the repo runs for anyone with no key.

export type WeeklyMetrics = {
  weekEnding: string;
  revenue: number;
  revenueDelta: number;
  jobsCompleted: number;
  jobsDelta: number;
  firstTimeFixRate: number;
  firstTimeFixDelta: number;
  avgTicket: number;
  avgTicketDelta: number;
  topService: string;
  topServiceRevenue: number;
  busiestTech: string;
  busiestTechJobs: number;
  callBookingRate: number;
};

function pctDelta(current: number, prior: number): number {
  if (prior === 0) return 0;
  return (current - prior) / prior;
}

export async function getWeeklyMetrics(): Promise<WeeklyMetrics> {
  const core = await query<{
    max_date: string;
    cur_revenue: number;
    prior_revenue: number;
    cur_jobs: number;
    prior_jobs: number;
    cur_ftf: number;
    prior_ftf: number;
  }>(`
    WITH periods AS (
      SELECT
        (SELECT MAX(d2.full_date) FROM fact_jobs f2 JOIN dim_date d2 ON d2.date_key = f2.date_key)                       AS max_date,
        (SELECT MAX(d2.full_date) FROM fact_jobs f2 JOIN dim_date d2 ON d2.date_key = f2.date_key) - INTERVAL '6 days'   AS cur_start,
        (SELECT MAX(d2.full_date) FROM fact_jobs f2 JOIN dim_date d2 ON d2.date_key = f2.date_key) - INTERVAL '13 days'  AS prior_start,
        (SELECT MAX(d2.full_date) FROM fact_jobs f2 JOIN dim_date d2 ON d2.date_key = f2.date_key) - INTERVAL '7 days'   AS prior_end
    )
    SELECT
      to_char(MAX(p.max_date), 'YYYY-MM-DD') AS max_date,
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
          AND d.full_date >= p.prior_start AND d.full_date <= p.prior_end)::int AS prior_ftf
    FROM fact_jobs fj
    JOIN dim_date d ON d.date_key = fj.date_key
    CROSS JOIN periods p
  `);

  const topService = await query<{ service_type: string; revenue: number }>(`
    SELECT s.service_type,
           COALESCE(SUM(fj.revenue), 0)::float8 AS revenue
    FROM fact_jobs fj
    JOIN dim_service_type s ON s.service_type_id = fj.service_type_id
    JOIN dim_date d ON d.date_key = fj.date_key
    WHERE fj.status = 'Completed'
      AND d.full_date >= (SELECT MAX(d2.full_date) FROM fact_jobs f2 JOIN dim_date d2 ON d2.date_key = f2.date_key) - INTERVAL '6 days'
    GROUP BY s.service_type
    ORDER BY revenue DESC
    LIMIT 1
  `);

  const busiestTech = await query<{ name: string; jobs: number }>(`
    SELECT t.name, COUNT(*)::int AS jobs
    FROM fact_jobs fj
    JOIN dim_technician t ON t.technician_id = fj.technician_id
    JOIN dim_date d ON d.date_key = fj.date_key
    WHERE fj.status = 'Completed'
      AND d.full_date >= (SELECT MAX(d2.full_date) FROM fact_jobs f2 JOIN dim_date d2 ON d2.date_key = f2.date_key) - INTERVAL '6 days'
    GROUP BY t.name
    ORDER BY jobs DESC
    LIMIT 1
  `);

  const calls = await query<{ booking_rate: number }>(`
    SELECT
      (COUNT(*) FILTER (WHERE outcome = 'Booked')::float8
        / NULLIF(COUNT(*), 0))::float8 AS booking_rate
    FROM fact_calls fc
    JOIN dim_date d ON d.date_key = fc.date_key
    WHERE d.full_date >= (SELECT MAX(d2.full_date) FROM fact_jobs f2 JOIN dim_date d2 ON d2.date_key = f2.date_key) - INTERVAL '6 days'
  `);

  const c = core[0];
  const curFtfRate = c.cur_jobs ? c.cur_ftf / c.cur_jobs : 0;
  const priorFtfRate = c.prior_jobs ? c.prior_ftf / c.prior_jobs : 0;
  const curAvgTicket = c.cur_jobs ? c.cur_revenue / c.cur_jobs : 0;
  const priorAvgTicket = c.prior_jobs ? c.prior_revenue / c.prior_jobs : 0;

  return {
    weekEnding: c.max_date,
    revenue: c.cur_revenue,
    revenueDelta: pctDelta(c.cur_revenue, c.prior_revenue),
    jobsCompleted: c.cur_jobs,
    jobsDelta: pctDelta(c.cur_jobs, c.prior_jobs),
    firstTimeFixRate: curFtfRate,
    firstTimeFixDelta: curFtfRate - priorFtfRate,
    avgTicket: curAvgTicket,
    avgTicketDelta: pctDelta(curAvgTicket, priorAvgTicket),
    topService: topService[0]?.service_type ?? "n/a",
    topServiceRevenue: topService[0]?.revenue ?? 0,
    busiestTech: busiestTech[0]?.name ?? "n/a",
    busiestTechJobs: busiestTech[0]?.jobs ?? 0,
    callBookingRate: calls[0]?.booking_rate ?? 0,
  };
}

function direction(value: number): string {
  if (value > 0.001) return "up";
  if (value < -0.001) return "down";
  return "flat";
}

function signedPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

// The committed demo narrative. Built from the live weekly metrics so the words
// match the cards, with no API call and no key required.
export function buildCannedInsight(m: WeeklyMetrics): string {
  const revDir = direction(m.revenueDelta);
  const jobsDir = direction(m.jobsDelta);
  const ftfDir = direction(m.firstTimeFixDelta);

  const lead =
    revDir === "up"
      ? `Revenue rose to ${formatCurrency(m.revenue)} for the week ending ${m.weekEnding}, ${signedPct(m.revenueDelta)} over the prior week.`
      : revDir === "down"
        ? `Revenue eased to ${formatCurrency(m.revenue)} for the week ending ${m.weekEnding}, ${signedPct(m.revenueDelta)} against the prior week.`
        : `Revenue held steady at ${formatCurrency(m.revenue)} for the week ending ${m.weekEnding}.`;

  const volume = `The team completed ${m.jobsCompleted} jobs (${signedPct(m.jobsDelta)} ${jobsDir === "flat" ? "" : "week over week"}), at an average ticket of ${formatCurrency(m.avgTicket)}.`;

  const quality = `First-time-fix landed at ${formatPercent(m.firstTimeFixRate)}, ${ftfDir === "up" ? "an improvement of" : ftfDir === "down" ? "a decline of" : "even at"} ${Math.abs(m.firstTimeFixDelta * 100).toFixed(1)} points. Higher first-time-fix lifts both margin and customer satisfaction, so it is worth protecting.`;

  const drivers = `${m.topService} led revenue at ${formatCurrency(m.topServiceRevenue)} for the week, and ${m.busiestTech} carried the most completed jobs (${m.busiestTechJobs}). The call center booked ${formatPercent(m.callBookingRate)} of inbound and outbound calls.`;

  const action =
    revDir === "down" || jobsDir === "down"
      ? `Watch scheduling capacity next week. If demand recovers, the dip looks like a calendar effect rather than a demand problem.`
      : `Momentum is positive. Keep senior technicians on the high-ticket installation work where first-time-fix is strongest.`;

  return [lead, volume, quality, drivers, action].join(" ");
}

function buildPrompt(m: WeeklyMetrics): string {
  return `You are an operations analyst for Northwind Field Services, a field-service company.
Write a short plain-language summary (4 to 6 sentences) of last week's performance for the leadership team.
Lead with the headline. State the numbers that moved and why they matter. End with one concrete thing to watch or do.
Do not use markdown, bullet points, or em dashes. Use short, direct sentences.

Week ending: ${m.weekEnding}
Revenue: ${formatCurrency(m.revenue)} (${signedPct(m.revenueDelta)} week over week)
Jobs completed: ${m.jobsCompleted} (${signedPct(m.jobsDelta)} week over week)
First-time-fix rate: ${formatPercent(m.firstTimeFixRate)} (${signedPct(m.firstTimeFixDelta)} change in points)
Average ticket: ${formatCurrency(m.avgTicket)} (${signedPct(m.avgTicketDelta)} week over week)
Top service by revenue: ${m.topService} at ${formatCurrency(m.topServiceRevenue)}
Busiest technician: ${m.busiestTech} with ${m.busiestTechJobs} completed jobs
Call booking rate: ${formatPercent(m.callBookingRate)}`;
}

export type InsightResult = {
  mode: "live" | "demo";
  summary: string;
  metrics: WeeklyMetrics;
};

export async function generateInsight(): Promise<InsightResult> {
  const metrics = await getWeeklyMetrics();

  if (!process.env.ANTHROPIC_API_KEY) {
    return { mode: "demo", summary: buildCannedInsight(metrics), metrics };
  }

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system:
        "You are a precise operations analyst. You write clear, plain-language summaries for busy leaders.",
      messages: [{ role: "user", content: buildPrompt(metrics) }],
    });
    const summary = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    return { mode: "live", summary: summary || buildCannedInsight(metrics), metrics };
  } catch {
    // If the API call fails for any reason, fall back to the committed insight
    // so the panel always renders.
    return { mode: "demo", summary: buildCannedInsight(metrics), metrics };
  }
}
