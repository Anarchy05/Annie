import { NextResponse } from "next/server";
import { buildFeedTimeline } from "@/lib/dashboard";

export async function GET() {
  try {
    const items = await buildFeedTimeline();
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
