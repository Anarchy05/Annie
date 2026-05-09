import { NextResponse } from "next/server";
import { buildFallbackBannerData, getBannerData } from "@/lib/dashboard";
import { recordRouteSample } from "@/lib/route-diagnostics";

export async function GET() {
  const startedAt = Date.now();

  try {
    const data = await getBannerData();
    recordRouteSample("banner", Date.now() - startedAt, "ok");
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mission Control banner data is unavailable right now.";
    recordRouteSample("banner", Date.now() - startedAt, "degraded");
    return NextResponse.json(buildFallbackBannerData(message), {
      headers: {
        "Cache-Control": "no-store",
        "X-Mission-Control-State": "degraded",
      },
    });
  }
}
