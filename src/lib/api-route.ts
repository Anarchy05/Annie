import { NextResponse } from "next/server";
import { recordRouteSample, type RouteOutcome } from "@/lib/route-diagnostics";

type JsonRouteOptions<T> = {
  route: string;
  run: () => Promise<T>;
  cacheControl?: string;
  successStatus?: number;
} & (
  | {
      fallback: (error: unknown) => T;
      errorOutcome?: Extract<RouteOutcome, "degraded" | "error">;
      fallbackStatus?: number;
      fallbackHeaders?: Record<string, string>;
    }
  | {
      fallback?: undefined;
      errorStatus?: number;
      errorBody?: (error: unknown) => unknown;
      errorOutcome?: Extract<RouteOutcome, "error">;
      errorHeaders?: Record<string, string>;
    }
);

export async function runJsonRoute<T>(options: JsonRouteOptions<T>) {
  const startedAt = Date.now();
  const cacheControl = options.cacheControl ?? "no-store";

  try {
    const data = await options.run();
    recordRouteSample(options.route, Date.now() - startedAt, "ok");
    return NextResponse.json(data, {
      status: options.successStatus,
      headers: { "Cache-Control": cacheControl },
    });
  } catch (error) {
    const outcome = options.errorOutcome ?? ("fallback" in options && options.fallback ? "degraded" : "error");
    recordRouteSample(options.route, Date.now() - startedAt, outcome);

    if ("fallback" in options && options.fallback) {
      return NextResponse.json(options.fallback(error), {
        status: options.fallbackStatus,
        headers: {
          "Cache-Control": cacheControl,
          "X-Mission-Control-State": "degraded",
          ...options.fallbackHeaders,
        },
      });
    }

    return NextResponse.json(options.errorBody ? options.errorBody(error) : { error: error instanceof Error ? error.message : "Unknown error" }, {
      status: options.errorStatus ?? 500,
      headers: {
        "Cache-Control": cacheControl,
        ...(options.errorHeaders ?? {}),
      },
    });
  }
}
