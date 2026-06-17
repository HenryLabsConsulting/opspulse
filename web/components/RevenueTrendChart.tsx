"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/lib/queries";
import { formatCurrency } from "@/lib/format";

export function RevenueTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f6df6" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#2f6df6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "#5b6577" }}
            tickLine={false}
            axisLine={{ stroke: "#e4e7ec" }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#5b6577" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
            width={48}
          />
          <Tooltip
            formatter={(value: number) => [formatCurrency(value), "Revenue"]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e4e7ec",
              fontSize: 13,
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#2f6df6"
            strokeWidth={2}
            fill="url(#revFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
