import { formatDelta } from "@/lib/format";

type Props = {
  label: string;
  value: string;
  delta: number;
  deltaIsPoints?: boolean;
};

export function KpiCard({ label, value, delta, deltaIsPoints }: Props) {
  const direction = delta > 0.0005 ? "up" : delta < -0.0005 ? "down" : "flat";
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "■";
  const deltaText = deltaIsPoints
    ? `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(1)} pts`
    : formatDelta(delta);

  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className={`kpi-delta ${direction}`}>
        {arrow} {deltaText}
      </div>
    </div>
  );
}
