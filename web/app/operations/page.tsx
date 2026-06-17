import { OperationsClient } from "@/components/OperationsClient";

export default function OperationsPage() {
  return (
    <>
      <div className="page-head">
        <h1>Operations</h1>
        <p>Technician productivity and job mix across the service lines.</p>
      </div>
      <OperationsClient />
    </>
  );
}
