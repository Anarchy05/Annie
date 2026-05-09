import { NextResponse } from "next/server";
import { buildFallbackAutomationWatchData, getAutomationWatchData } from "@/lib/dashboard";
import { recordRouteSample } from "@/lib/route-diagnostics";

export async function GET() {
  const startedAt = Date.now();

  try {
    const data = await getAutomationWatchData();
    recordRouteSample("automation-watch", Date.now() - startedAt, "ok");
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automation watch is unavailable right now.";
    recordRouteSample("automation-watch", Date.now() - startedAt, "degraded");
    return NextResponse.json(buildFallbackAutomationWatchData(message), {
      headers: {
        "Cache-Control": "no-store",
        "X-Mission-Control-State": "degraded",
      },
    });
  }
}
