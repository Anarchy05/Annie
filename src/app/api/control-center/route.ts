import { runJsonRoute } from "@/lib/api-route";
import { buildFallbackControlCenterData, getControlCenterData } from "@/lib/dashboard";

export async function GET() {
  return runJsonRoute({
    route: "control-center",
    run: getControlCenterData,
    fallback: (error) =>
      buildFallbackControlCenterData(
        error instanceof Error ? error.message : "Control center data is unavailable right now."
      ),
  });
}
