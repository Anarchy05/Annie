import { runJsonRoute } from "@/lib/api-route";
import { fetchGatewayHealth } from "@/lib/openclaw";

export async function GET() {
  return runJsonRoute({
    route: "health",
    run: async () => ({ ok: true, data: await fetchGatewayHealth() }),
    errorStatus: 503,
    errorBody: (error) => ({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }),
  });
}
