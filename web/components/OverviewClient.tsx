"use client";

import { useEffect, useState } from "react";
import { KpiCard } from "./KpiCard";
import { RevenueTrendChart } from "./RevenueTrendChart";
import { InsightsPanel } from "./InsightsPanel";
import type { OverviewKpis, TrendPoint } from "@/lib/queries";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

type OverviewData = { kpis: OverviewKpis; trend: TrendPoint[] };

export function OverviewClient() {
  const [data, setData] = useState<OverviewData | null>(null);

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) {
    return <div className="loading">Loading dashboard...</div>;
  }

  const { kpis, trend } = data;

  return (
    <>
      <div className="kpi-grid">
        <KpiCard
          label="Revenue (30d)"
          value={formatCurrency(kpis.revenue)}
          delta={kpis.revenueDelta}
        />
        <KpiCard
          label="Jobs Completed (30d)"
          value={formatNumber(kpis.jobsCompleted)}
          delta={kpis.jobsDelta}
        />
        <KpiCard
          label="First-Time-Fix Rate"
          value={formatPercent(kpis.firstTimeFixRate)}
          delta={kpis.firstTimeFixDelta}
          deltaIsPoints
        />
        <KpiCard
          label="Average Ticket"
          value={formatCurrency(kpis.avgTicket)}
          delta={kpis.avgTicketDelta}
        />
      </div>

      <div className="grid-2">
        <div className="card">
          <h2 className="card-title">Revenue by Month</h2>
          <RevenueTrendChart data={trend} />
        </div>
        <InsightsPanel />
      </div>
    </>
  );
}
