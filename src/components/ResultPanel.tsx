"use client";

import { useEffect, useRef } from "react";
import { dedupeServices } from "@/lib/format";
import type { AssessResponse } from "@/lib/schema";
import { PartResultCard } from "./PartResultCard";
import { ScoreRing } from "./ScoreRing";

interface ResultPanelProps {
  result: AssessResponse;
  onStartOver: () => void;
  onEditPhotos: () => void;
}

export function ResultPanel({ result, onStartOver, onEditPhotos }: ResultPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const services = dedupeServices(result.recommendedServices);
  const poorParts = result.parts.filter((p) => p.photoQuality === "poor").length;

  // Move focus to the results so screen reader and keyboard users land on them.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby="results-heading" className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2
          id="results-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          Your detailing assessment
        </h2>
        <ScoreRing score={result.overallScore} label={result.overallLabel} />
        <p className="text-center text-sm text-fg-muted">
          Higher scores mean more detailing is needed.
        </p>
        {poorParts > 0 && (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-center text-sm text-warning">
            {poorParts === 1 ? "1 part has" : `${poorParts} parts have`} unclear photos. See below
            and consider retaking them.
          </p>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">By part</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {result.parts.map((part) => (
            <PartResultCard key={part.category} part={part} />
          ))}
        </div>
      </div>

      {services.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Recommended services</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {services.map((s) => (
              <li
                key={s}
                className="rounded-full border border-brand/40 bg-brand-soft px-3.5 py-1.5 font-medium"
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-fg-muted">{result.disclaimer}</p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onEditPhotos}
          className="min-h-12 flex-1 rounded-xl border border-border bg-surface px-5 font-semibold hover:bg-surface-muted"
        >
          Edit photos
        </button>
        <button
          type="button"
          onClick={onStartOver}
          className="min-h-12 flex-1 rounded-xl bg-brand px-5 font-semibold text-brand-fg hover:bg-brand-strong"
        >
          Start over
        </button>
      </div>
    </section>
  );
}
