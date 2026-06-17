import { NextResponse } from "next/server";
import { getOverviewKpis, getRevenueTrend } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [kpis, trend] = await Promise.all([
      getOverviewKpis(),
      getRevenueTrend(),
    ]);
    return NextResponse.json({ kpis, trend });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load overview", detail: String(err) },
      { status: 500 }
    );
  }
}
