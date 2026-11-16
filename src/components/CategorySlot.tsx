"use client";

import { CATEGORY_INFO, MAX_PHOTOS_PER_CATEGORY } from "@/lib/categories";
import type { Photo } from "@/lib/photos";
import type { Category } from "@/lib/schema";
import { ImageDropzone } from "./ImageDropzone";

interface CategorySlotProps {
  category: Category;
  photos: Photo[];
  errors: string[];
  disabled?: boolean;
  onAdd: (category: Category, files: File[]) => void;
  onRemove: (category: Category, id: string) => void;
  onDismissErrors: (category: Category) => void;
}

export function CategorySlot({
  category,
  photos,
  errors,
  disabled = false,
  onAdd,
  onRemove,
  onDismissErrors,
}: CategorySlotProps) {
  const { label, tip } = CATEGORY_INFO[category];
  const headingId = `slot-${category}-heading`;
  const tipId = `slot-${category}-tip`;
  const remaining = MAX_PHOTOS_PER_CATEGORY - photos.length;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={headingId} className="text-lg font-semibold">
            {label}
          </h3>
          <p id={tipId} className="mt-0.5 text-sm text-fg-muted">
            {tip}
          </p>
        </div>
        <span
          className={[
            "shrink-0 rounded-full px-2.5 py-1 text-sm font-medium tabular-nums",
            photos.length ? "bg-brand-soft text-fg" : "bg-surface-muted text-fg-muted",
          ].join(" ")}
          aria-label={`${photos.length} of ${MAX_PHOTOS_PER_CATEGORY} photos`}
        >
          {photos.length}/{MAX_PHOTOS_PER_CATEGORY}
        </span>
      </div>

      {photos.length > 0 && (
        <ul className="grid grid-cols-4 gap-2" aria-label={`${label} photos`}>
          {photos.map((photo, i) => (
            <li key={photo.id} className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img
                src={photo.previewUrl}
                alt={`${label} photo ${i + 1}: ${photo.name}`}
                className="size-full rounded-lg border border-border object-cover"
              />
              {photo.status === "processing" && (
                <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/40">
                  <span className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span className="sr-only">Preparing photo</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemove(category, photo.id)}
                disabled={disabled}
                aria-label={`Remove ${label} photo ${i + 1}`}
                className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full border border-border bg-surface text-fg shadow hover:bg-danger-soft hover:text-danger disabled:opacity-50"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none">
                  <path
                    d="M5 5l10 10M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ImageDropzone
        inputId={`slot-${category}-input`}
        label={`Add photos of the ${label.toLowerCase()}`}
        remaining={remaining}
        disabled={disabled}
        describedBy={tipId}
        onFiles={(files) => onAdd(category, files)}
      />

      {errors.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm text-danger"
        >
          <ul className="flex-1 space-y-1">
            {errors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onDismissErrors(category)}
            className="-m-1 rounded p-1 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </section>
  );
}
