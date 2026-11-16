import { describe, expect, it } from "vitest";
import { dedupeServices, labelForScore } from "./format";

describe("dedupeServices", () => {
  it("removes duplicates ignoring case and extra whitespace, keeping first spelling", () => {
    expect(
      dedupeServices(["Hand wash", "hand  wash ", "Clay bar", "", "HAND WASH", "Clay Bar"]),
    ).toEqual(["Hand wash", "Clay bar"]);
  });
});

describe("labelForScore", () => {
  it.each([
    [0, "clean"],
    [24, "clean"],
    [25, "light"],
    [50, "moderate"],
    [75, "heavy"],
    [100, "heavy"],
  ] as const)("%i -> %s", (score, label) => {
    expect(labelForScore(score)).toBe(label);
  });
});
