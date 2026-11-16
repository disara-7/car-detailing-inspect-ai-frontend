import { CATEGORIES, type Category } from "./schema";

export interface Photo {
  id: string;
  name: string;
  /** Object URL for the thumbnail. Must be revoked when the photo is removed. */
  previewUrl: string;
  status: "processing" | "ready";
  /** Base64 JPEG without "data:" prefix, once resized. */
  base64?: string;
}

export type PhotosByCategory = Record<Category, Photo[]>;

export function emptyPhotos(): PhotosByCategory {
  return Object.fromEntries(CATEGORIES.map((c) => [c, []])) as unknown as PhotosByCategory;
}

export function revokeAll(photos: PhotosByCategory) {
  for (const list of Object.values(photos)) {
    for (const p of list) URL.revokeObjectURL(p.previewUrl);
  }
}

export function countPhotos(photos: PhotosByCategory): number {
  return Object.values(photos).reduce((n, list) => n + list.length, 0);
}

let counter = 0;
export function newPhotoId(): string {
  counter += 1;
  return `p${Date.now().toString(36)}${counter}`;
}
