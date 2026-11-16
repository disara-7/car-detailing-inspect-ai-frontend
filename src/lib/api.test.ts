import { describe, expect, it, vi } from "vitest";
import { assess, GENERIC_ERROR_MESSAGE, mapErrorCode, parseErrorBody } from "./api";
import { buildMockResponse } from "./mock";
import { CATEGORIES, type ApiErrorCode, type AssessRequest } from "./schema";

const request: AssessRequest = {
  turnstileToken: "token",
  parts: [{ category: "wheel", images: ["A".repeat(200)] }],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchReturning = (res: Response | Promise<Response>) =>
  vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(res));

describe("mapErrorCode", () => {
  const codes: ApiErrorCode[] = [
    "INVALID_REQUEST",
    "BOT_CHECK_FAILED",
    "PAYLOAD_TOO_LARGE",
    "RATE_LIMITED",
    "AI_FAILED",
    "INTERNAL",
  ];

  it.each(codes)("has a friendly message for %s", (code) => {
    const err = mapErrorCode(code);
    expect(err.kind).toBe("api");
    expect(err.code).toBe(code);
    expect(err.message.length).toBeGreaterThan(10);
    expect(err.message).not.toMatch(/[A-Z]{2,}_[A-Z]/); // no raw codes leak into copy
  });

  it("tells rate-limited users to wait a minute", () => {
    expect(mapErrorCode("RATE_LIMITED").message).toMatch(/minute/);
  });

  it("tells bot-check failures to refresh", () => {
    expect(mapErrorCode("BOT_CHECK_FAILED").message).toMatch(/refresh/i);
  });
});

describe("parseErrorBody", () => {
  it("uses the code from a valid error body", () => {
    const err = parseErrorBody(500, { error: { code: "AI_FAILED", message: "model down" } });
    expect(err.code).toBe("AI_FAILED");
  });

  it("falls back to HTTP status when the body is not in the contract", () => {
    expect(parseErrorBody(429, "Too Many Requests").code).toBe("RATE_LIMITED");
    expect(parseErrorBody(413, undefined).code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("returns a generic error for unknown codes", () => {
    const err = parseErrorBody(500, { error: { code: "NOPE", message: "x" } });
    expect(err.kind).toBe("invalid_response");
    expect(err.message).toBe(GENERIC_ERROR_MESSAGE);
  });
});

describe("assess", () => {
  it("POSTs to /api/assess and returns validated data", async () => {
    const data = buildMockResponse(request);
    const fetchImpl = fetchReturning(jsonResponse(200, data));
    const result = await assess(request, { apiUrl: "https://api.example.com", fetchImpl });

    expect(result).toEqual({ ok: true, data });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/api/assess");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(request);
  });

  it("maps a contract error response", async () => {
    const fetchImpl = fetchReturning(
      jsonResponse(429, { error: { code: "RATE_LIMITED", message: "slow down" } }),
    );
    const result = await assess(request, { apiUrl: "", fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("RATE_LIMITED");
      expect(result.error.retryable).toBe(true);
    }
  });

  it("returns a generic error when a 200 body fails validation", async () => {
    const fetchImpl = fetchReturning(jsonResponse(200, { overallScore: 150 }));
    const result = await assess(request, { apiUrl: "", fetchImpl });
    expect(result).toMatchObject({
      ok: false,
      error: { kind: "invalid_response", message: GENERIC_ERROR_MESSAGE },
    });
  });

  it("returns a generic error when a 200 body is not JSON", async () => {
    const fetchImpl = fetchReturning(new Response("<html>oops</html>", { status: 200 }));
    const result = await assess(request, { apiUrl: "", fetchImpl });
    expect(result).toMatchObject({ ok: false, error: { kind: "invalid_response" } });
  });

  it("reports network failures as retryable", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await assess(request, { apiUrl: "", fetchImpl });
    expect(result).toMatchObject({ ok: false, error: { kind: "network", retryable: true } });
  });

  it("times out slow requests", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("", "AbortError")));
        }),
    );
    const result = await assess(request, { apiUrl: "", fetchImpl, timeoutMs: 10 });
    expect(result).toMatchObject({ ok: false, error: { kind: "timeout", retryable: true } });
  });

  it("does not send requests that violate the contract", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await assess({ turnstileToken: "", parts: [] }, { apiUrl: "", fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, error: { kind: "invalid_request" } });
  });
});

describe("mock data", () => {
  it("matches the response contract for every category", async () => {
    const { AssessResponseSchema } = await import("./schema");
    const all: AssessRequest = {
      turnstileToken: "x",
      parts: CATEGORIES.map((category) => ({ category, images: ["A".repeat(200)] })),
    };
    expect(AssessResponseSchema.safeParse(buildMockResponse(all)).success).toBe(true);
  });
});
