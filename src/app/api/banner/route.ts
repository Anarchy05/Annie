import { NextResponse } from "next/server";
import { buildFallbackBannerData, getBannerData } from "@/lib/dashboard";

export async function GET() {
  try {
    const data = await getBannerData();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mission Control banner data is unavailable right now.";
    return NextResponse.json(buildFallbackBannerData(message), {
      headers: {
        "Cache-Control": "no-store",
        "X-Mission-Control-State": "degraded",
      },
    });
  }
}
