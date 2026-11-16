// Keep in sync with the backend repo.
// This file is the API contract shared with the Cloudflare Worker backend. Any change here must be
// mirrored there (and vice versa); the contract block below is copied verbatim.
import { z } from "zod";

export const CATEGORIES = ["door","wheel","bonnet","roof","bumper","boot","glass","interior"] as const;
export const CategorySchema = z.enum(CATEGORIES);

export const AssessRequestSchema = z.object({
  turnstileToken: z.string().min(1).optional(), // only required when the backend has TURNSTILE_SECRET set
  parts: z.array(z.object({
    category: CategorySchema,
    images: z.array(z.string().min(100)).min(1).max(4), // base64 JPEG, no "data:" prefix
  })).min(1).max(8),
});

export const PartResultSchema = z.object({
  category: CategorySchema,
  score: z.number().int().min(0).max(100),
  issues: z.array(z.string()).max(6),
  services: z.array(z.string()),
  photoQuality: z.enum(["good","poor"]),
});

export const AssessResponseSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  overallLabel: z.enum(["clean","light","moderate","heavy"]),
  parts: z.array(PartResultSchema),
  recommendedServices: z.array(z.string()),
  disclaimer: z.string(),
});

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.enum(["INVALID_REQUEST","BOT_CHECK_FAILED","PAYLOAD_TOO_LARGE","RATE_LIMITED","AI_FAILED","INTERNAL"]),
    message: z.string(),
  }),
});

// ---- Frontend-only type helpers (derived from the contract above; not part of the contract) ----
export type Category = z.infer<typeof CategorySchema>;
export type AssessRequest = z.infer<typeof AssessRequestSchema>;
export type PartResult = z.infer<typeof PartResultSchema>;
export type AssessResponse = z.infer<typeof AssessResponseSchema>;
export type OverallLabel = AssessResponse["overallLabel"];
export type ApiErrorCode = z.infer<typeof ErrorResponseSchema>["error"]["code"];
