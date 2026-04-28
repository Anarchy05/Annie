import { NextRequest, NextResponse } from "next/server";
import { buildSearchResults } from "@/lib/dashboard";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";

  try {
    const data = await buildSearchResults(query);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
