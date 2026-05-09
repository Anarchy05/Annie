import { NextResponse } from "next/server";
import { buildFallbackFeedData, buildFeedTimeline } from "@/lib/dashboard";
import { recordRouteSample } from "@/lib/route-diagnostics";

export async function GET() {
  const startedAt = Date.now();

  try {
    const items = await buildFeedTimeline();
    recordRouteSample("feed", Date.now() - startedAt, "ok");
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    recordRouteSample("feed", Date.now() - startedAt, "degraded");
    return NextResponse.json(buildFallbackFeedData(), {
      headers: {
        "Cache-Control": "no-store",
        "X-Mission-Control-State": "degraded",
      },
    });
  }
}
