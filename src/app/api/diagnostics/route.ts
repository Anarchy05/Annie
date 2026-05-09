import { NextResponse } from "next/server";
import { getRouteDiagnostics } from "@/lib/route-diagnostics";

export async function GET() {
  return NextResponse.json(getRouteDiagnostics(), {
    headers: { "Cache-Control": "no-store" },
  });
}
