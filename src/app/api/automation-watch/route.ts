import { NextResponse } from "next/server";
import { buildFallbackAutomationWatchData, getAutomationWatchData } from "@/lib/dashboard";

export async function GET() {
  try {
    const data = await getAutomationWatchData();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automation watch is unavailable right now.";
    return NextResponse.json(buildFallbackAutomationWatchData(message), {
      headers: {
        "Cache-Control": "no-store",
        "X-Mission-Control-State": "degraded",
      },
    });
  }
}
