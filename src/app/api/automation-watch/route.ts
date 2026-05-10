import { runJsonRoute } from "@/lib/api-route";
import { buildFallbackAutomationWatchData, getAutomationWatchData } from "@/lib/dashboard";

export async function GET() {
  return runJsonRoute({
    route: "automation-watch",
    run: getAutomationWatchData,
    fallback: (error) =>
      buildFallbackAutomationWatchData(
        error instanceof Error ? error.message : "Automation watch is unavailable right now."
      ),
  });
}
