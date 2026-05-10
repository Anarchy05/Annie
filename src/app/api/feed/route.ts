import { runJsonRoute } from "@/lib/api-route";
import { buildFallbackFeedData, buildFeedTimeline } from "@/lib/dashboard";

export async function GET() {
  return runJsonRoute({
    route: "feed",
    run: async () => ({ items: await buildFeedTimeline() }),
    fallback: buildFallbackFeedData,
  });
}
