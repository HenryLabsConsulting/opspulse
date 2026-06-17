import { NextResponse } from "next/server";
import {
  getTechnicianProductivity,
  getJobMixByCategory,
  getJobMixByService,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [technicians, mixByCategory, mixByService] = await Promise.all([
      getTechnicianProductivity(),
      getJobMixByCategory(),
      getJobMixByService(),
    ]);
    return NextResponse.json({ technicians, mixByCategory, mixByService });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load operations", detail: String(err) },
      { status: 500 }
    );
  }
}
