import { GEMINI_MODEL_ID } from "./gemini.config";

export type GeminiErrorCode =
  | "GEMINI_CONFIGURATION_MISSING"
  | "GEMINI_TIMEOUT"
  | "GEMINI_RATE_LIMITED"
  | "GEMINI_INVALID_RESPONSE"
  | "GEMINI_PROVIDER_ERROR";

export type GeminiDiagnosticCategory =
  | "invalid_authentication"
  | "permission_denied"
  | "api_not_enabled"
  | "quota_exceeded"
  | "model_unavailable"
  | "invalid_request"
  | "network_or_timeout"
  | "malformed_response"
  | "unknown_provider_error";

export interface GeminiDiagnostic {
  category: GeminiDiagnosticCategory;
  httpStatus?: number;
  errorType?: string;
  redactedMessage?: string;
  requestHost?: string;
  modelId: string;
  requestPhase: "before_network" | "after_network";
}

export class GeminiServiceError extends Error {
  constructor(
    public readonly code: GeminiErrorCode,
    public readonly diagnosticCategory: GeminiDiagnosticCategory = "unknown_provider_error",
    public readonly diagnostic?: GeminiDiagnostic,
  ) {
    super(code);
    this.name = "GeminiServiceError";
  }
}

export function extractGeminiResponse(response: unknown): {
  answer: string;
  tokenUsage?: unknown;
} {
  if (!response || typeof response !== "object") {
    throw new GeminiServiceError("GEMINI_INVALID_RESPONSE", "malformed_response");
  }

  const candidate = response as { text?: unknown; usageMetadata?: unknown };

  if (typeof candidate.text !== "string" || candidate.text.length === 0) {
    throw new GeminiServiceError("GEMINI_INVALID_RESPONSE", "malformed_response");
  }

  return {
    answer: candidate.text,
    tokenUsage: candidate.usageMetadata,
  };
}

export function classifyGeminiError(
  error: unknown,
  context: { modelId?: string; requestPhase?: "before_network" | "after_network" } = {},
): GeminiServiceError {
  if (error instanceof GeminiServiceError) {
    if (!context.modelId && !context.requestPhase) return error;
    return new GeminiServiceError(error.code, error.diagnosticCategory, {
      ...(error.diagnostic ?? buildDiagnostic(error.diagnosticCategory, undefined, error.message, context)),
      ...context,
    });
  }

  const candidate = error as {
    status?: unknown;
    code?: unknown;
    message?: unknown;
    name?: unknown;
    url?: unknown;
    requestUrl?: unknown;
    response?: { url?: unknown };
    request?: { url?: unknown };
    config?: { url?: unknown };
  } | null;
  const status = candidate && typeof candidate.status === "number"
    ? candidate.status
    : candidate && typeof candidate.code === "number"
      ? candidate.code
      : undefined;
  const message = candidate && typeof candidate.message === "string"
    ? candidate.message.toLowerCase()
    : "";
  const diagnostic = (category: GeminiDiagnosticCategory) => buildDiagnostic(
    category,
    candidate,
    candidate && typeof candidate.message === "string" ? candidate.message : undefined,
    context,
  );

  if (message.includes("api not enabled") || message.includes("service disabled")) {
    return new GeminiServiceError("GEMINI_PROVIDER_ERROR", "api_not_enabled", diagnostic("api_not_enabled"));
  }

  if (message.includes("quota") || message.includes("resource exhausted")) {
    return new GeminiServiceError("GEMINI_RATE_LIMITED", "quota_exceeded", diagnostic("quota_exceeded"));
  }

  if (message.includes("model") && (message.includes("not found") || message.includes("unavailable"))) {
    return new GeminiServiceError("GEMINI_PROVIDER_ERROR", "model_unavailable", diagnostic("model_unavailable"));
  }

  if (status === 401) {
    return new GeminiServiceError("GEMINI_PROVIDER_ERROR", "invalid_authentication", diagnostic("invalid_authentication"));
  }

  if (status === 403) {
    return new GeminiServiceError("GEMINI_PROVIDER_ERROR", "permission_denied", diagnostic("permission_denied"));
  }

  if (status === 404) {
    return new GeminiServiceError("GEMINI_PROVIDER_ERROR", "model_unavailable", diagnostic("model_unavailable"));
  }

  if (status === 400) {
    return new GeminiServiceError("GEMINI_PROVIDER_ERROR", "invalid_request", diagnostic("invalid_request"));
  }

  if (status === 429) {
    return new GeminiServiceError("GEMINI_RATE_LIMITED", "quota_exceeded", diagnostic("quota_exceeded"));
  }

  if (message.includes("timeout") || message.includes("econn") || message.includes("network")
    || message.includes("fetch failed")
    || (typeof candidate?.code === "string" && /^e(ai|conn|net|timed)/i.test(candidate.code))) {
    return new GeminiServiceError("GEMINI_PROVIDER_ERROR", "network_or_timeout", diagnostic("network_or_timeout"));
  }

  return new GeminiServiceError("GEMINI_PROVIDER_ERROR", "unknown_provider_error", diagnostic("unknown_provider_error"));
}

function buildDiagnostic(
  category: GeminiDiagnosticCategory,
  error: {
    status?: unknown;
    code?: unknown;
    name?: unknown;
    url?: unknown;
    requestUrl?: unknown;
    response?: { url?: unknown };
    request?: { url?: unknown };
    config?: { url?: unknown };
  } | null | undefined,
  message: string | undefined,
  context: { modelId?: string; requestPhase?: "before_network" | "after_network" },
): GeminiDiagnostic {
  const numericStatus = typeof error?.status === "number"
    ? error.status
    : typeof error?.code === "number" ? error.code : undefined;
  const errorType = typeof error?.name === "string"
    ? error.name.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80)
    : undefined;

  return {
    category,
    ...(numericStatus === undefined ? {} : { httpStatus: numericStatus }),
    ...(errorType ? { errorType } : {}),
    ...(message ? { redactedMessage: redactSensitiveText(message) } : {}),
    ...(extractRequestHost(error) ? { requestHost: extractRequestHost(error) } : {}),
    modelId: context.modelId ?? GEMINI_MODEL_ID,
    requestPhase: context.requestPhase ?? "before_network",
  };
}

function extractRequestHost(error: {
  url?: unknown;
  requestUrl?: unknown;
  response?: { url?: unknown };
  request?: { url?: unknown };
  config?: { url?: unknown };
} | null | undefined): string | undefined {
  const candidates = [error?.url, error?.requestUrl, error?.response?.url, error?.request?.url, error?.config?.url];
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    try {
      return new URL(value).host;
    } catch {
      // Ignore malformed or credential-bearing URL-like values.
    }
  }
  return undefined;
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, "[url-redacted]")
    .replace(/bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(api[-_ ]?key|token|secret|credential)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[key-redacted]")
    .replace(/[A-Za-z0-9_-]{40,}/g, "[secret-redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 240);
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new GeminiServiceError("GEMINI_TIMEOUT", "network_or_timeout"));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

