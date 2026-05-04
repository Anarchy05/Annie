import { NextResponse } from "next/server";
import { buildFallbackControlCenterData, getControlCenterData } from "@/lib/dashboard";

export async function GET() {
  try {
    const data = await getControlCenterData();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Control center data is unavailable right now.";
    return NextResponse.json(buildFallbackControlCenterData(message), {
      headers: {
        "Cache-Control": "no-store",
        "X-Mission-Control-State": "degraded",
      },
    });
  }
}
