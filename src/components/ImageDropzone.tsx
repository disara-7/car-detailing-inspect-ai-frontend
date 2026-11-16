"use client";

import { useState, type DragEvent } from "react";

interface ImageDropzoneProps {
  inputId: string;
  /** Accessible label for the file input, e.g. "Add photos of the wheels". */
  label: string;
  remaining: number;
  disabled?: boolean;
  describedBy?: string;
  onFiles: (files: File[]) => void;
}

/**
 * A visually-hidden but focusable file input with a large styled <label> as the drop target.
 * Keyboard users tab to the input (focus ring shows on the label) and press Enter/Space to open
 * the picker; on phones the picker offers camera or gallery.
 */
export function ImageDropzone({
  inputId,
  label,
  remaining,
  disabled = false,
  describedBy,
  onFiles,
}: ImageDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const full = remaining <= 0;
  const inactive = disabled || full;

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    if (inactive) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  }

  return (
    <div>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        className="peer sr-only"
        aria-label={label}
        aria-describedby={describedBy}
        disabled={inactive}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          // Reset so picking the same file again still fires onChange.
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
      <label
        htmlFor={inputId}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!inactive) setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={[
          "flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors",
          "peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
          inactive
            ? "cursor-not-allowed border-border bg-surface-muted text-fg-muted"
            : dragging
              ? "cursor-copy border-brand bg-brand-soft text-fg"
              : "cursor-pointer border-border bg-surface hover:border-brand hover:bg-brand-soft",
        ].join(" ")}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 text-brand" fill="none">
          <path
            d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.2-1.8A1.5 1.5 0 0 1 10.5 3.5h3a1.5 1.5 0 0 1 1.2.7L15.9 6h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        <span className="font-medium">
          {full ? "Maximum photos added" : "Take or choose photos"}
        </span>
        {!full && (
          <span className="text-sm text-fg-muted">
            <span className="hidden sm:inline">or drag and drop here · </span>
            up to {remaining} more
          </span>
        )}
      </label>
    </div>
  );
}
