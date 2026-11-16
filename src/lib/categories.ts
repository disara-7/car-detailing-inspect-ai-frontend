import type { Category } from "./schema";

export interface CategoryInfo {
  label: string;
  tip: string;
}

export const CATEGORY_INFO: Record<Category, CategoryInfo> = {
  door: {
    label: "Doors",
    tip: "Stand 1 metre back, daylight, no shadows. Include handles and sills.",
  },
  wheel: {
    label: "Wheels",
    tip: "Crouch level with the wheel so the whole rim and tyre wall fill the frame.",
  },
  bonnet: {
    label: "Bonnet",
    tip: "Shoot from the front corner at a low angle to show swirls and water spots.",
  },
  roof: {
    label: "Roof",
    tip: "Hold the phone up high or stand on a step. Avoid direct sun glare.",
  },
  bumper: {
    label: "Bumpers",
    tip: "Front and rear, 1 metre back. Bug splatter and scuffs show best in daylight.",
  },
  boot: { label: "Boot", tip: "One photo closed from behind, one open showing the boot floor." },
  glass: { label: "Glass", tip: "Shoot at a slight angle so smears and chips catch the light." },
  interior: {
    label: "Interior",
    tip: "Doors open, wide shot of seats, then close-ups of mats and dashboard.",
  },
};

export const MAX_PHOTOS_PER_CATEGORY = 4;
