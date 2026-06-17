"use client";

import { useEffect, useState } from "react";
import type { InsightResult } from "@/lib/insights";

export function InsightsPanel() {
  const [data, setData] = useState<InsightResult | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(true);
        else setData(d);
      })
      .catch(() => setError(true));
  }, []);

  return (
    <div className="insight-panel">
      <div className="insight-head">
        <span className="insight-title">✦ Daily Insights</span>
        {data && (
          <span className={`badge ${data.mode}`}>
            {data.mode === "live" ? "AI Live" : "Demo"}
          </span>
        )}
      </div>

      {error && (
        <div className="insight-body muted">
          Insights are unavailable right now.
        </div>
      )}

      {!error && !data && (
        <div className="insight-body muted">Reading the latest week...</div>
      )}

      {data && <div className="insight-body">{data.summary}</div>}

      {data && (
        <div className="insight-foot">
          {data.mode === "live"
            ? "Written by Claude from this week's warehouse data."
            : "Committed sample summary. Set ANTHROPIC_API_KEY to generate this live with Claude."}
        </div>
      )}
    </div>
  );
}
