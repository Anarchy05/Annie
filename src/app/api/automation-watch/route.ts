import { NextResponse } from "next/server";
import { getAutomationWatchData } from "@/lib/dashboard";

export async function GET() {
  try {
    const data = await getAutomationWatchData();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
