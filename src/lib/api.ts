import {
  AssessRequestSchema,
  AssessResponseSchema,
  ErrorResponseSchema,
  type ApiErrorCode,
  type AssessRequest,
  type AssessResponse,
} from "./schema";

export type AppErrorKind = "api" | "network" | "timeout" | "invalid_response" | "invalid_request";

export interface AppError {
  kind: AppErrorKind;
  code?: ApiErrorCode;
  message: string;
  /** Whether a "Try again" button makes sense. */
  retryable: boolean;
}

export type AssessResult = { ok: true; data: AssessResponse } | { ok: false; error: AppError };

export const GENERIC_ERROR_MESSAGE =
  "Something went wrong reading the results. Please try again in a moment.";

const ERROR_MESSAGES: Record<ApiErrorCode, { message: string; retryable: boolean }> = {
  INVALID_REQUEST: {
    message: "Some photos couldn't be processed. Please check them and try again.",
    retryable: false,
  },
  BOT_CHECK_FAILED: {
    message: "We couldn't verify you're human. Please refresh the page and try again.",
    retryable: false,
  },
  PAYLOAD_TOO_LARGE: {
    message: "Those photos are too large to send together. Try removing a few and submit again.",
    retryable: false,
  },
  RATE_LIMITED: {
    message: "You've made a lot of requests. Please wait a minute and try again.",
    retryable: true,
  },
  AI_FAILED: {
    message: "Our AI couldn't analyse these photos right now. Please try again.",
    retryable: true,
  },
  INTERNAL: {
    message: "Something went wrong on our side. Please try again shortly.",
    retryable: true,
  },
};

export function mapErrorCode(code: ApiErrorCode): AppError {
  const { message, retryable } = ERROR_MESSAGES[code];
  return { kind: "api", code, message, retryable };
}

/** Fallback when the error body is missing or doesn't match the contract. */
export function errorFromStatus(status: number): AppError {
  if (status === 429) return mapErrorCode("RATE_LIMITED");
  if (status === 413) return mapErrorCode("PAYLOAD_TOO_LARGE");
  return { kind: "invalid_response", message: GENERIC_ERROR_MESSAGE, retryable: true };
}

/** Turn a non-OK response body (parsed JSON, or undefined if unparseable) into an AppError. */
export function parseErrorBody(status: number, body: unknown): AppError {
  const parsed = ErrorResponseSchema.safeParse(body);
  return parsed.success ? mapErrorCode(parsed.data.error.code) : errorFromStatus(status);
}

/** Validate a 200 response body against the contract. */
export function parseSuccessBody(body: unknown): AssessResult {
  const parsed = AssessResponseSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "invalid_response", message: GENERIC_ERROR_MESSAGE, retryable: true },
    };
  }
  return { ok: true, data: parsed.data };
}

export const NETWORK_ERROR: AppError = {
  kind: "network",
  message: "We couldn't reach the server. Check your connection and try again.",
  retryable: true,
};

export const TIMEOUT_ERROR: AppError = {
  kind: "timeout",
  message: "The analysis is taking too long. Please try again.",
  retryable: true,
};

export interface AssessOptions {
  apiUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function assess(
  request: AssessRequest,
  options: AssessOptions,
): Promise<AssessResult> {
  const checked = AssessRequestSchema.safeParse(request);
  if (!checked.success) {
    return {
      ok: false,
      error: {
        kind: "invalid_request",
        message: "Some photos couldn't be prepared. Please remove them and try again.",
        retryable: false,
      },
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 90_000);

  try {
    let response: Response;
    try {
      response = await fetchImpl(`${options.apiUrl}/api/assess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checked.data),
        signal: controller.signal,
      });
    } catch {
      return { ok: false, error: timedOut ? TIMEOUT_ERROR : NETWORK_ERROR };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      if (timedOut) return { ok: false, error: TIMEOUT_ERROR };
      body = undefined;
    }

    if (!response.ok) return { ok: false, error: parseErrorBody(response.status, body) };
    return parseSuccessBody(body);
  } finally {
    clearTimeout(timer);
  }
}
