import { NextResponse } from "next/server.js";
import { getCronJobs } from "@/lib/dashboard";

export async function GET() {
  try {
    const data = await getCronJobs();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
        "X-Mission-Control-State": data.meta.status,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
