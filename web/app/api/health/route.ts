import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query<{ jobs: number }>(
      "SELECT COUNT(*)::int AS jobs FROM fact_jobs"
    );
    return NextResponse.json({ status: "ok", jobs: rows[0]?.jobs ?? 0 });
  } catch (err) {
    return NextResponse.json(
      { status: "degraded", detail: String(err) },
      { status: 503 }
    );
  }
}
