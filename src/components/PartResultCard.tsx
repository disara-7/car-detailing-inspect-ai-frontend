import { CATEGORY_INFO } from "@/lib/categories";
import { LABEL_INFO, labelForScore } from "@/lib/format";
import type { PartResult } from "@/lib/schema";

export function PartResultCard({ part }: { part: PartResult }) {
  const { label: partName, tip } = CATEGORY_INFO[part.category];
  const level = LABEL_INFO[labelForScore(part.score)];
  const headingId = `result-${part.category}`;

  return (
    <article
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={headingId} className="text-lg font-semibold">
          {partName}
        </h3>
        <p className="text-sm">
          <span className={`font-semibold ${level.textClass}`}>{level.title}</span>{" "}
          <span className="text-fg-muted tabular-nums">· {part.score}/100</span>
        </p>
      </div>

      <div
        role="meter"
        aria-label={`${partName} detailing need`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={part.score}
        aria-valuetext={`${part.score} out of 100, ${level.title.toLowerCase()}`}
        className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className={`h-full rounded-full ${level.bgClass}`}
          style={{ width: `${part.score}%` }}
        />
      </div>

      {part.photoQuality === "poor" && (
        <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">
          <strong>Photo unclear.</strong> This result may be less accurate. Please add a clearer
          photo of the {partName.toLowerCase()}. Tip: {tip}
        </p>
      )}

      {part.issues.length > 0 ? (
        <div>
          <h4 className="text-sm font-medium text-fg-muted">What we spotted</h4>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {part.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-fg-muted">No issues spotted.</p>
      )}

      {part.services.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-fg-muted">Suggested services</h4>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {part.services.map((s, i) => (
              <li key={i} className="rounded-full bg-brand-soft px-3 py-1 text-sm">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
