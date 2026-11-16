"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useEffect, useRef, useState } from "react";
import { CategorySlot } from "@/components/CategorySlot";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ResultPanel } from "@/components/ResultPanel";
import {
  assess,
  GENERIC_ERROR_MESSAGE,
  mapErrorCode,
  NETWORK_ERROR,
  type AppError,
  type AssessResult,
} from "@/lib/api";
import { MAX_PHOTOS_PER_CATEGORY } from "@/lib/categories";
import { API_URL, TURNSTILE_SITE_KEY, USE_MOCK } from "@/lib/config";
import { LABEL_INFO } from "@/lib/format";
import { mockAssess } from "@/lib/mock";
import {
  countPhotos,
  emptyPhotos,
  newPhotoId,
  revokeAll,
  type Photo,
  type PhotosByCategory,
} from "@/lib/photos";
import { ImagePrepError, resizeImage, validateImageFile } from "@/lib/resizeImage";
import {
  CATEGORIES,
  ErrorResponseSchema,
  type AssessRequest,
  type AssessResponse,
  type Category,
} from "@/lib/schema";

type Stage = "idle" | "preparing" | "analysing";
type SlotErrors = Partial<Record<Category, string[]>>;

/** Mock mode: ?mockError=RATE_LIMITED (any API code), NETWORK or INVALID simulates failures. */
async function runMock(request: AssessRequest): Promise<AssessResult> {
  const param = new URLSearchParams(window.location.search).get("mockError");
  const data = await mockAssess(request);
  if (!param) return { ok: true, data };
  if (param === "NETWORK") return { ok: false, error: NETWORK_ERROR };
  const code = ErrorResponseSchema.shape.error.shape.code.safeParse(param);
  if (code.success) return { ok: false, error: mapErrorCode(code.data) };
  return {
    ok: false,
    error: { kind: "invalid_response", message: GENERIC_ERROR_MESSAGE, retryable: true },
  };
}

export default function Home() {
  const [photos, setPhotos] = useState<PhotosByCategory>(emptyPhotos);
  const photosRef = useRef<PhotosByCategory>(photos);
  const pending = useRef(new Map<string, Promise<void>>());
  const [slotErrors, setSlotErrors] = useState<SlotErrors>({});

  const [token, setToken] = useState<string | null>(null);
  const [botCheckFailed, setBotCheckFailed] = useState(false);
  /** Turnstile client error code, e.g. "110200". 110xxx/400xxx are site configuration problems. */
  const [botCheckCode, setBotCheckCode] = useState<string | null>(null);
  const botCheckMisconfigured = botCheckCode !== null && /^(110|400)/.test(botCheckCode);
  const turnstileRef = useRef<TurnstileInstance>(undefined);

  const [stage, setStage] = useState<Stage>("idle");
  const inFlight = useRef(false);
  const [error, setError] = useState<AppError | null>(null);
  const [result, setResult] = useState<AssessResponse | null>(null);
  const [announcement, setAnnouncement] = useState("");

  /** Synchronously update the ref and state together so async callbacks always see the latest photos. */
  function updatePhotos(fn: (prev: PhotosByCategory) => PhotosByCategory) {
    const next = fn(photosRef.current);
    photosRef.current = next;
    setPhotos(next);
  }

  // Free every preview URL when the page unmounts.
  useEffect(() => () => revokeAll(photosRef.current), []);

  const busy = stage !== "idle";
  const total = countPhotos(photos);
  const needsTurnstile = !USE_MOCK;
  const canSubmit = total > 0 && !busy && (!needsTurnstile || token !== null);

  function setSlotError(category: Category, messages: string[], append = false) {
    setSlotErrors((prev) => ({
      ...prev,
      [category]: append ? [...(prev[category] ?? []), ...messages] : messages,
    }));
  }

  function addFiles(category: Category, files: File[]) {
    const room = MAX_PHOTOS_PER_CATEGORY - photosRef.current[category].length;
    const errors: string[] = [];
    const accepted: { photo: Photo; file: File }[] = [];
    let skipped = 0;

    for (const file of files) {
      const invalid = validateImageFile(file);
      if (invalid) {
        errors.push(invalid);
      } else if (accepted.length >= room) {
        skipped += 1;
      } else {
        accepted.push({
          file,
          photo: {
            id: newPhotoId(),
            name: file.name,
            previewUrl: URL.createObjectURL(file),
            status: "processing",
          },
        });
      }
    }
    if (skipped) {
      errors.push(
        `Only ${MAX_PHOTOS_PER_CATEGORY} photos per part. ${skipped} photo${skipped > 1 ? "s were" : " was"} not added.`,
      );
    }
    setSlotError(category, errors);
    if (!accepted.length) return;

    updatePhotos((prev) => ({
      ...prev,
      [category]: [...prev[category], ...accepted.map((a) => a.photo)],
    }));

    // Resize in the background so decode errors (e.g. HEIC) surface immediately for that file.
    for (const { photo, file } of accepted) {
      const job = resizeImage(file)
        .then((base64) => {
          updatePhotos((prev) => ({
            ...prev,
            [category]: prev[category].map((p) =>
              p.id === photo.id ? { ...p, status: "ready" as const, base64 } : p,
            ),
          }));
        })
        .catch((err: unknown) => {
          const stillThere = photosRef.current[category].some((p) => p.id === photo.id);
          if (!stillThere) return;
          URL.revokeObjectURL(photo.previewUrl);
          updatePhotos((prev) => ({
            ...prev,
            [category]: prev[category].filter((p) => p.id !== photo.id),
          }));
          const msg =
            err instanceof ImagePrepError ? err.message : `We couldn't process "${file.name}".`;
          setSlotError(category, [msg], true);
        })
        .finally(() => pending.current.delete(photo.id));
      pending.current.set(photo.id, job);
    }
  }

  function removePhoto(category: Category, id: string) {
    const target = photosRef.current[category].find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    updatePhotos((prev) => ({ ...prev, [category]: prev[category].filter((p) => p.id !== id) }));
  }

  async function submit() {
    if (inFlight.current || !canSubmit) return;
    inFlight.current = true;
    setError(null);
    try {
      if (!USE_MOCK && !API_URL) {
        setError({
          kind: "invalid_request",
          message: "This site isn't configured yet (missing API URL). Please try again later.",
          retryable: false,
        });
        return;
      }

      setStage("preparing");
      setAnnouncement("Preparing your photos…");
      await Promise.allSettled([...pending.current.values()]);

      const current = photosRef.current;
      const parts = CATEGORIES.map((category) => ({
        category,
        images: current[category].flatMap((p) => (p.base64 ? [p.base64] : [])),
      })).filter((p) => p.images.length > 0);

      if (!parts.length) {
        setError({
          kind: "invalid_request",
          message: "None of your photos could be prepared. Please add them again.",
          retryable: false,
        });
        setAnnouncement("");
        return;
      }

      setStage("analysing");
      setAnnouncement("Analysing your photos. This can take up to 30 seconds.");
      const outcome = USE_MOCK
        ? await runMock({ turnstileToken: "mock", parts })
        : await assess({ turnstileToken: token ?? "", parts }, { apiUrl: API_URL });

      if (outcome.ok) {
        setResult(outcome.data);
        const info = LABEL_INFO[outcome.data.overallLabel];
        setAnnouncement(
          `Results ready. Detailing need ${outcome.data.overallScore} out of 100, ${info.title}.`,
        );
        window.scrollTo({ top: 0 });
      } else {
        setError(outcome.error);
        setAnnouncement("");
      }
    } finally {
      inFlight.current = false;
      setStage("idle");
      if (needsTurnstile) {
        // Turnstile tokens are single-use: get a fresh one for the next attempt.
        setToken(null);
        turnstileRef.current?.reset();
      }
    }
  }

  function startOver() {
    revokeAll(photosRef.current);
    pending.current.clear();
    updatePhotos(() => emptyPhotos());
    setSlotErrors({});
    setResult(null);
    setError(null);
    setAnnouncement("");
    window.scrollTo({ top: 0 });
  }

  function editPhotos() {
    setResult(null);
    setAnnouncement("");
    window.scrollTo({ top: 0 });
  }

  let hint = "";
  if (total === 0) hint = "Add at least one photo to continue.";
  else if (needsTurnstile && !token && !busy && !botCheckFailed)
    hint = "Completing a quick security check…";

  function retryBotCheck() {
    setBotCheckFailed(false);
    setToken(null);
    turnstileRef.current?.reset();
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Detailing check</h1>
          {USE_MOCK && (
            <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning">
              Mock mode
            </span>
          )}
        </div>
        {!result && (
          <p className="max-w-2xl text-fg-muted">
            Add photos of the parts you&apos;d like assessed. You don&apos;t need every part.
            We&apos;ll estimate how much detailing your car needs and suggest services.
          </p>
        )}
      </header>

      {result ? (
        <ResultPanel result={result} onStartOver={startOver} onEditPhotos={editPhotos} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {CATEGORIES.map((category) => (
              <CategorySlot
                key={category}
                category={category}
                photos={photos[category]}
                errors={slotErrors[category] ?? []}
                disabled={busy}
                onAdd={addFiles}
                onRemove={removePhoto}
                onDismissErrors={(c) => setSlotError(c, [])}
              />
            ))}
          </div>

          <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-border bg-bg/95 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            {error && (
              <ErrorBanner
                message={error.message}
                onRetry={error.retryable ? () => void submit() : undefined}
                retryDisabled={!canSubmit}
                onDismiss={() => setError(null)}
              />
            )}

            {needsTurnstile &&
              (TURNSTILE_SITE_KEY ? (
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={(t) => {
                    setToken(t);
                    setBotCheckFailed(false);
                  }}
                  onExpire={() => setToken(null)}
                  onError={(code) => {
                    setToken(null);
                    setBotCheckFailed(true);
                    setBotCheckCode(code ? String(code) : null);
                    console.warn("Turnstile error", code);
                  }}
                  options={{ theme: "auto", size: "flexible" }}
                />
              ) : (
                <p className="text-sm text-danger">
                  Security check isn&apos;t configured (missing NEXT_PUBLIC_TURNSTILE_SITE_KEY).
                </p>
              ))}

            {needsTurnstile && botCheckFailed && (
              <p role="alert" className="text-sm text-danger">
                {botCheckMisconfigured
                  ? "The security check isn't set up correctly for this site. Please let us know."
                  : "The security check couldn't complete. Ad blockers, VPNs or strict privacy settings can cause this."}{" "}
                Your photos are kept.
                {botCheckCode && (
                  <span className="text-fg-muted"> (Error {botCheckCode})</span>
                )}{" "}
                <button
                  type="button"
                  onClick={retryBotCheck}
                  className="font-semibold underline underline-offset-2"
                >
                  Try again
                </button>
              </p>
            )}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit}
              aria-describedby={hint ? "submit-hint" : undefined}
              className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-brand px-6 text-lg font-semibold text-brand-fg shadow-sm hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:self-end"
            >
              {busy && (
                <span
                  aria-hidden="true"
                  className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
              )}
              {stage === "preparing"
                ? "Preparing photos…"
                : stage === "analysing"
                  ? "Analysing…"
                  : total > 0
                    ? `Assess ${total} photo${total > 1 ? "s" : ""}`
                    : "Assess my car"}
            </button>
            {hint && (
              <p id="submit-hint" className="text-center text-sm text-fg-muted sm:text-right">
                {hint}
              </p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
