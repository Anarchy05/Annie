import { NextResponse } from "next/server";
import { getBannerData } from "@/lib/dashboard";

export async function GET() {
  try {
    const data = await getBannerData();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
