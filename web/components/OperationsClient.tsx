"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TechnicianRow, JobMixRow } from "@/lib/queries";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

type OperationsData = {
  technicians: TechnicianRow[];
  mixByCategory: JobMixRow[];
  mixByService: JobMixRow[];
};

const CATEGORY_COLORS: Record<string, string> = {
  HVAC: "#2f6df6",
  Plumbing: "#11875a",
  Electrical: "#b76e00",
};

export function OperationsClient() {
  const [data, setData] = useState<OperationsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/operations")
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed: ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return <div className="loading">Failed to load operations. Please refresh.</div>;
  }

  if (!data) {
    return <div className="loading">Loading operations...</div>;
  }

  const topTechs = data.technicians.slice(0, 10).map((t) => {
    const parts = t.name.split(" ");
    return {
      name: parts[1] ? `${parts[0]} ${parts[1][0]}.` : parts[0],
      revenue: t.revenue,
    };
  });

  return (
    <>
      <div className="grid-2-even">
        <div className="card">
          <h2 className="card-title">Revenue by Service Category</h2>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.mixByCategory} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#5b6577" }} tickLine={false} axisLine={{ stroke: "#e4e7ec" }} />
                <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fontSize: 12, fill: "#5b6577" }} tickLine={false} axisLine={false} width={48} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), "Revenue"]} contentStyle={{ borderRadius: 8, border: "1px solid #e4e7ec", fontSize: 13 }} />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                  {data.mixByCategory.map((row) => (
                    <Cell key={row.label} fill={CATEGORY_COLORS[row.label] ?? "#2f6df6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Top Technicians by Revenue</h2>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={topTechs} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fontSize: 12, fill: "#5b6577" }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#5b6577" }} tickLine={false} axisLine={false} width={70} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), "Revenue"]} contentStyle={{ borderRadius: 8, border: "1px solid #e4e7ec", fontSize: 13 }} />
                <Bar dataKey="revenue" fill="#2f6df6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Technician Productivity</h2>
        <div className="table-scroll" style={{ maxHeight: 460 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Technician</th>
                <th>Level</th>
                <th>Region</th>
                <th className="num">Jobs Completed</th>
                <th className="num">Revenue</th>
                <th className="num">Avg Duration</th>
                <th className="num">First-Time-Fix</th>
              </tr>
            </thead>
            <tbody>
              {data.technicians.map((t) => (
                <tr key={t.name}>
                  <td>{t.name}</td>
                  <td>{t.level}</td>
                  <td>{t.region}</td>
                  <td className="num">{formatNumber(t.jobsCompleted)}</td>
                  <td className="num">{formatCurrency(t.revenue)}</td>
                  <td className="num">{Math.round(t.avgDuration)} min</td>
                  <td className="num">{formatPercent(t.firstTimeFixRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
