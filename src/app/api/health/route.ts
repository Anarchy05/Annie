import { NextResponse } from "next/server";
import { fetchGatewayHealth } from "@/lib/openclaw";

export async function GET() {
  try {
    const data = await fetchGatewayHealth();
    return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 503 }
    );
  }
}
