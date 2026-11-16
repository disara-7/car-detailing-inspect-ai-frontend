import type { OverallLabel } from "./schema";

/** Score meaning: 0 = spotless, 100 = needs heavy detailing. */
export function labelForScore(score: number): OverallLabel {
  if (score < 25) return "clean";
  if (score < 50) return "light";
  if (score < 75) return "moderate";
  return "heavy";
}

export const LABEL_INFO: Record<
  OverallLabel,
  { title: string; description: string; textClass: string; strokeClass: string; bgClass: string }
> = {
  clean: {
    title: "Clean",
    description: "Little to no detailing needed",
    textClass: "text-level-clean",
    strokeClass: "stroke-level-clean",
    bgClass: "bg-level-clean",
  },
  light: {
    title: "Light",
    description: "A light detail will freshen it up",
    textClass: "text-level-light",
    strokeClass: "stroke-level-light",
    bgClass: "bg-level-light",
  },
  moderate: {
    title: "Moderate",
    description: "A moderate detail is recommended",
    textClass: "text-level-moderate",
    strokeClass: "stroke-level-moderate",
    bgClass: "bg-level-moderate",
  },
  heavy: {
    title: "Heavy",
    description: "A full, heavy detail is recommended",
    textClass: "text-level-heavy",
    strokeClass: "stroke-level-heavy",
    bgClass: "bg-level-heavy",
  },
};

/** Deduplicate service names case- and whitespace-insensitively, keeping the first spelling and order. */
export function dedupeServices(services: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of services) {
    const name = raw.trim().replace(/\s+/g, " ");
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
