import "server-only";

const GATEWAY_URL = process.env.GATEWAY_URL;
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN;

type GatewayContentPart = {
  type: string;
  text?: string;
};

type GatewayEnvelope = {
  ok: boolean;
  error?: string;
  result?: {
    content?: GatewayContentPart[];
    details?: unknown;
  };
};

export class OpenClawGatewayError extends Error {
  details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "OpenClawGatewayError";
    this.details = details;
  }
}

function getGatewayConfig() {
  if (!GATEWAY_URL || !GATEWAY_TOKEN) {
    throw new OpenClawGatewayError(
      "Missing GATEWAY_URL or GATEWAY_TOKEN in .env.local"
    );
  }

  return {
    gatewayUrl: GATEWAY_URL.replace(/\/$/, ""),
    gatewayToken: GATEWAY_TOKEN,
  };
}

function maybeParseJson<T>(raw: string): T | string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return raw;
  }
}

export function unwrapGatewayResult<T>(envelope: GatewayEnvelope): T {
  if (!envelope.ok || !envelope.result) {
    throw new OpenClawGatewayError(
      envelope.error || "Tool invocation failed",
      envelope.result?.details
    );
  }

  const text = (envelope.result.content ?? [])
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();

  if (!text) {
    return envelope.result.details as T;
  }

  return maybeParseJson<T>(text) as T;
}

export async function invokeOpenClaw<T>(
  tool: string,
  args: Record<string, unknown> = {},
  options: { timeoutMs?: number } = {}
) {
  const { gatewayUrl, gatewayToken } = getGatewayConfig();
  const controller = new AbortController();
  const timeout = options.timeoutMs
    ? setTimeout(() => controller.abort(new OpenClawGatewayError(`${tool} timed out after ${options.timeoutMs} ms`)), options.timeoutMs)
    : null;

  const response = await fetch(`${gatewayUrl}/tools/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gatewayToken}`,
    },
    cache: "no-store",
    signal: controller.signal,
    body: JSON.stringify({ tool, args }),
  }).finally(() => {
    if (timeout) clearTimeout(timeout);
  });

  if (!response.ok) {
    throw new OpenClawGatewayError(
      `Gateway returned ${response.status} ${response.statusText}`
    );
  }

  const envelope = (await response.json()) as GatewayEnvelope;
  return unwrapGatewayResult<T>(envelope);
}

export async function fetchGatewayHealth() {
  const { gatewayUrl, gatewayToken } = getGatewayConfig();
  const response = await fetch(`${gatewayUrl}/health`, {
    headers: {
      Authorization: `Bearer ${gatewayToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new OpenClawGatewayError(`Health check failed with ${response.status}`);
  }

  return response.json();
}
