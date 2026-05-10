import { runJsonRoute } from "@/lib/api-route";
import { buildFallbackBannerData, getBannerData } from "@/lib/dashboard";

export async function GET() {
  return runJsonRoute({
    route: "banner",
    run: getBannerData,
    fallback: (error) =>
      buildFallbackBannerData(
        error instanceof Error ? error.message : "Mission Control banner data is unavailable right now."
      ),
  });
}
