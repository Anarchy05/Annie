import { NextRequest, NextResponse } from "next/server.js";
import { getCronRuns } from "@/lib/dashboard";

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  try {
    const data = await getCronRuns(jobId);
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
