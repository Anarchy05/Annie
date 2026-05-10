import { NextRequest } from "next/server";
import { runJsonRoute } from "@/lib/api-route";
import { buildSearchResults } from "@/lib/dashboard";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";

  return runJsonRoute({
    route: "search",
    run: () => buildSearchResults(query),
  });
}
