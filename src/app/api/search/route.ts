import { NextRequest, NextResponse } from "next/server";
import { buildSearchResults } from "@/lib/dashboard";
import { recordRouteSample } from "@/lib/route-diagnostics";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";
  const startedAt = Date.now();

  try {
    const data = await buildSearchResults(query);
    recordRouteSample("search", Date.now() - startedAt, "ok");
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    recordRouteSample("search", Date.now() - startedAt, "error");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
