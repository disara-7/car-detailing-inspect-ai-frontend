export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_DIMENSION = 1024;
export const JPEG_QUALITY = 0.8;

export class ImagePrepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImagePrepError";
  }
}

/** Returns a friendly error message if the file should be rejected before decoding, otherwise null. */
export function validateImageFile(file: Pick<File, "name" | "type" | "size">): string | null {
  const looksLikeImage =
    file.type.startsWith("image/") ||
    // Some phones/browsers leave type empty for HEIC; let the decoder decide.
    (file.type === "" && /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i.test(file.name));
  if (!looksLikeImage) {
    return `"${file.name}" isn't an image. Please choose a photo (JPEG, PNG or WebP).`;
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `"${file.name}" is ${mb} MB. Please use a photo under 15 MB.`;
  }
  return null;
}

/** Scale (width, height) so the longest side is at most `max`, preserving aspect ratio. Never upscales. */
export function fitWithin(width: number, height: number, max = MAX_DIMENSION) {
  if (width <= 0 || height <= 0) throw new ImagePrepError("Image has no size.");
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Strip a "data:...;base64," prefix from a data URL. */
export function stripDataUrlPrefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma === -1) {
    throw new ImagePrepError("Unexpected image encoding.");
  }
  return dataUrl.slice(comma + 1);
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" applies EXIF orientation so portrait phone photos aren't sideways.
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Fall through to <img>, which supports some formats createImageBitmap doesn't (e.g. HEIC in Safari).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Decode an image in the browser, resize so the longest side is ≤ 1024px and
 * return base64 JPEG (quality 0.8) without the "data:" prefix.
 * Throws ImagePrepError with a user-friendly message on failure.
 */
export async function resizeImage(file: File): Promise<string> {
  const invalid = validateImageFile(file);
  if (invalid) throw new ImagePrepError(invalid);

  let decoded: Decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new ImagePrepError(
      `We couldn't read "${file.name}". It may be a format your browser doesn't support (such as HEIC). ` +
        `Try taking the photo again or saving it as JPEG.`,
    );
  }

  try {
    const { width, height } = fitWithin(decoded.width, decoded.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImagePrepError("Your browser couldn't process this image.");
    // JPEG has no alpha; paint white so transparent PNGs don't turn black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(decoded.source, 0, 0, width, height);
    return stripDataUrlPrefix(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
  } finally {
    decoded.release();
  }
}
