import { NextResponse } from "next/server";
import { generateInsight } from "@/lib/insights";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await generateInsight();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to generate insight", detail: String(err) },
      { status: 500 }
    );
  }
}
