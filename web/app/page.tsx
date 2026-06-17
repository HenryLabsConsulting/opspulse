import { OverviewClient } from "@/components/OverviewClient";

export default function OverviewPage() {
  return (
    <>
      <div className="page-head">
        <h1>Overview</h1>
        <p>Revenue, throughput, and service quality at a glance.</p>
      </div>
      <OverviewClient />
    </>
  );
}
