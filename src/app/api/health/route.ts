import { NextResponse } from "next/server";
import { fetchGatewayHealth } from "@/lib/openclaw";
import { recordRouteSample } from "@/lib/route-diagnostics";

export async function GET() {
  const startedAt = Date.now();

  try {
    const data = await fetchGatewayHealth();
    recordRouteSample("health", Date.now() - startedAt, "ok");
    return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    recordRouteSample("health", Date.now() - startedAt, "error");
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 503 }
    );
  }
}
