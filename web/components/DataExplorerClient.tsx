"use client";

import { useEffect, useMemo, useState } from "react";
import type { JobTableRow } from "@/lib/queries";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

type SortKey = keyof JobTableRow;
type GroupKey = "none" | "technician" | "category" | "status" | "region";

const GROUP_FIELD: Record<Exclude<GroupKey, "none">, keyof JobTableRow> = {
  technician: "technician",
  category: "category",
  status: "status",
  region: "region",
};

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataExplorerClient() {
  const [rows, setRows] = useState<JobTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [group, setGroup] = useState<GroupKey>("none");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(rows.map((r) => r.category))).sort()],
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "All" && r.status !== status) return false;
      if (category !== "All" && r.category !== category) return false;
      if (q) {
        const hay = `${r.technician} ${r.customer} ${r.serviceType} ${r.region}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, status, category]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else if (typeof av === "boolean" && typeof bv === "boolean")
        cmp = Number(av) - Number(bv);
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const grouped = useMemo(() => {
    if (group === "none") return null;
    const field = GROUP_FIELD[group];
    const map = new Map<
      string,
      { jobs: number; completed: number; revenue: number; ftf: number; duration: number }
    >();
    for (const r of filtered) {
      const key = String(r[field]);
      const g = map.get(key) ?? { jobs: 0, completed: 0, revenue: 0, ftf: 0, duration: 0 };
      g.jobs += 1;
      g.revenue += r.revenue;
      g.duration += r.durationMinutes;
      if (r.status === "Completed") {
        g.completed += 1;
        if (r.firstTimeFix) g.ftf += 1;
      }
      map.set(key, g);
    }
    return Array.from(map.entries())
      .map(([key, g]) => ({
        key,
        jobs: g.jobs,
        revenue: g.revenue,
        avgDuration: g.duration / g.jobs,
        ftfRate: g.completed ? g.ftf / g.completed : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered, group]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function exportCsv() {
    if (grouped) {
      const headers = [
        GROUP_FIELD[group as Exclude<GroupKey, "none">],
        "jobs",
        "revenue",
        "avg_duration_minutes",
        "first_time_fix_rate",
      ];
      const out = grouped.map((g) => [
        g.key,
        g.jobs,
        g.revenue.toFixed(2),
        g.avgDuration.toFixed(1),
        (g.ftfRate * 100).toFixed(1),
      ]);
      download("opspulse_grouped.csv", toCsv(headers, out));
    } else {
      const headers = [
        "job_id", "date", "technician", "service_type", "category",
        "customer", "segment", "region", "status", "first_time_fix",
        "duration_minutes", "revenue",
      ];
      const out = sorted.map((r) => [
        r.jobId, r.date, r.technician, r.serviceType, r.category, r.customer,
        r.segment, r.region, r.status, r.firstTimeFix ? "yes" : "no",
        r.durationMinutes, r.revenue.toFixed(2),
      ]);
      download("opspulse_jobs.csv", toCsv(headers, out));
    }
  }

  const sortArrow = (key: SortKey) =>
    key === sortKey ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  if (loading) return <div className="loading">Loading jobs...</div>;

  return (
    <div className="card">
      <div className="controls">
        <input
          placeholder="Search technician, customer, service..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 260 }}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {["All", "Completed", "Cancelled", "Rescheduled"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={group} onChange={(e) => setGroup(e.target.value as GroupKey)}>
          <option value="none">Group: None</option>
          <option value="technician">Group: Technician</option>
          <option value="category">Group: Category</option>
          <option value="status">Group: Status</option>
          <option value="region">Group: Region</option>
        </select>
        <button className="btn" onClick={exportCsv}>
          Export CSV
        </button>
        <span className="row-count">
          {grouped
            ? `${grouped.length} groups`
            : `${formatNumber(sorted.length)} of ${formatNumber(rows.length)} jobs`}
        </span>
      </div>

      <div className="table-scroll">
        {grouped ? (
          <table className="data">
            <thead>
              <tr>
                <th>{GROUP_FIELD[group as Exclude<GroupKey, "none">]}</th>
                <th className="num">Jobs</th>
                <th className="num">Revenue</th>
                <th className="num">Avg Duration</th>
                <th className="num">First-Time-Fix</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => (
                <tr key={g.key}>
                  <td>{g.key}</td>
                  <td className="num">{formatNumber(g.jobs)}</td>
                  <td className="num">{formatCurrency(g.revenue)}</td>
                  <td className="num">{Math.round(g.avgDuration)} min</td>
                  <td className="num">{formatPercent(g.ftfRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th onClick={() => toggleSort("date")}>Date{sortArrow("date")}</th>
                <th onClick={() => toggleSort("technician")}>Technician{sortArrow("technician")}</th>
                <th onClick={() => toggleSort("serviceType")}>Service{sortArrow("serviceType")}</th>
                <th onClick={() => toggleSort("category")}>Category{sortArrow("category")}</th>
                <th onClick={() => toggleSort("customer")}>Customer{sortArrow("customer")}</th>
                <th onClick={() => toggleSort("region")}>Region{sortArrow("region")}</th>
                <th onClick={() => toggleSort("status")}>Status{sortArrow("status")}</th>
                <th className="num" onClick={() => toggleSort("durationMinutes")}>Duration{sortArrow("durationMinutes")}</th>
                <th className="num" onClick={() => toggleSort("revenue")}>Revenue{sortArrow("revenue")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 500).map((r) => (
                <tr key={r.jobId}>
                  <td>{r.date}</td>
                  <td>{r.technician}</td>
                  <td>{r.serviceType}</td>
                  <td>{r.category}</td>
                  <td>{r.customer}</td>
                  <td>{r.region}</td>
                  <td>
                    <span className={`pill ${r.status.toLowerCase()}`}>{r.status}</span>
                  </td>
                  <td className="num">{r.durationMinutes} min</td>
                  <td className="num">{formatCurrency(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {!grouped && sorted.length > 500 && (
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          Showing the first 500 rows. Export to CSV for the full filtered set.
        </p>
      )}
    </div>
  );
}
