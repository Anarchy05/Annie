import { NextResponse } from "next/server";
import { buildFallbackFeedData, buildFeedTimeline } from "@/lib/dashboard";

export async function GET() {
  try {
    const items = await buildFeedTimeline();
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(buildFallbackFeedData(), {
      headers: {
        "Cache-Control": "no-store",
        "X-Mission-Control-State": "degraded",
      },
    });
  }
}
