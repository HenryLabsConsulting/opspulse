import { NextResponse } from "next/server";
import { getJobsTable } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await getJobsTable(3000);
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load jobs", detail: String(err) },
      { status: 500 }
    );
  }
}
