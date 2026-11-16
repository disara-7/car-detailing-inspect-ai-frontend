// NEXT_PUBLIC_* vars are inlined at build time, so they must be referenced literally.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
