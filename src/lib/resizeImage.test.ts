import { describe, expect, it } from "vitest";
import {
  fitWithin,
  ImagePrepError,
  MAX_FILE_BYTES,
  resizeImage,
  stripDataUrlPrefix,
  validateImageFile,
} from "./resizeImage";

describe("validateImageFile", () => {
  it("accepts a normal JPEG", () => {
    expect(validateImageFile({ name: "car.jpg", type: "image/jpeg", size: 2_000_000 })).toBeNull();
  });

  it("rejects non-images with a friendly message", () => {
    const msg = validateImageFile({ name: "notes.pdf", type: "application/pdf", size: 1000 });
    expect(msg).toMatch(/isn't an image/);
    expect(msg).toContain("notes.pdf");
  });

  it("rejects files over 15 MB", () => {
    const msg = validateImageFile({
      name: "big.jpg",
      type: "image/jpeg",
      size: MAX_FILE_BYTES + 1,
    });
    expect(msg).toMatch(/under 15 MB/);
  });

  it("accepts exactly 15 MB", () => {
    expect(
      validateImageFile({ name: "a.jpg", type: "image/jpeg", size: MAX_FILE_BYTES }),
    ).toBeNull();
  });

  it("lets image extensions with an empty MIME type through (e.g. HEIC on some devices)", () => {
    expect(validateImageFile({ name: "IMG_0001.HEIC", type: "", size: 1000 })).toBeNull();
    expect(validateImageFile({ name: "readme", type: "", size: 1000 })).not.toBeNull();
  });
});

describe("fitWithin", () => {
  it("does not upscale small images", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("scales landscape so width is 1024", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1024, height: 768 });
  });

  it("scales portrait so height is 1024", () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 768, height: 1024 });
  });

  it("keeps exactly-1024 images unchanged", () => {
    expect(fitWithin(1024, 1024)).toEqual({ width: 1024, height: 1024 });
  });

  it("never returns a zero dimension for extreme aspect ratios", () => {
    expect(fitWithin(100_000, 10)).toEqual({ width: 1024, height: 1 });
  });

  it("throws on empty images", () => {
    expect(() => fitWithin(0, 100)).toThrow(ImagePrepError);
  });
});

describe("stripDataUrlPrefix", () => {
  it("removes the data URL prefix", () => {
    expect(stripDataUrlPrefix("data:image/jpeg;base64,/9j/4AAQ")).toBe("/9j/4AAQ");
  });

  it("throws on non data URLs", () => {
    expect(() => stripDataUrlPrefix("/9j/4AAQ")).toThrow(ImagePrepError);
  });
});

describe("resizeImage", () => {
  it("rejects non-images before decoding", async () => {
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    await expect(resizeImage(file)).rejects.toThrow(/isn't an image/);
  });

  it("reports undecodable images with a clear message instead of crashing", async () => {
    // jsdom cannot decode images, which mimics an unsupported format such as HEIC.
    const file = new File([new Uint8Array([0, 1, 2, 3])], "photo.heic", { type: "image/heic" });
    const err = await resizeImage(file).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ImagePrepError);
    expect((err as Error).message).toMatch(/couldn't read "photo.heic"/);
  });
});
