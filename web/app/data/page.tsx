import { DataExplorerClient } from "@/components/DataExplorerClient";

export default function DataPage() {
  return (
    <>
      <div className="page-head">
        <h1>Data Explorer</h1>
        <p>Filter, sort, group, and export the underlying job records.</p>
      </div>
      <DataExplorerClient />
    </>
  );
}
