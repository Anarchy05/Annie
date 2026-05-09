import { NextResponse } from "next/server";
import { buildFallbackControlCenterData, getControlCenterData } from "@/lib/dashboard";
import { recordRouteSample } from "@/lib/route-diagnostics";

export async function GET() {
  const startedAt = Date.now();

  try {
    const data = await getControlCenterData();
    recordRouteSample("control-center", Date.now() - startedAt, "ok");
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Control center data is unavailable right now.";
    recordRouteSample("control-center", Date.now() - startedAt, "degraded");
    return NextResponse.json(buildFallbackControlCenterData(message), {
      headers: {
        "Cache-Control": "no-store",
        "X-Mission-Control-State": "degraded",
      },
    });
  }
}
