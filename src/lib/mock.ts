import { labelForScore } from "./format";
import type { AssessRequest, AssessResponse, Category, PartResult } from "./schema";

const MOCK_PARTS: Record<Category, Omit<PartResult, "category" | "photoQuality">> = {
  door: {
    score: 42,
    issues: ["Light swirl marks on lower panels", "Road grime in door shuts"],
    services: ["Hand wash & dry", "Door shut clean"],
  },
  wheel: {
    score: 78,
    issues: ["Heavy brake dust build-up", "Tar spots on tyre wall", "Faded tyre sidewalls"],
    services: ["Wheel deep clean", "Iron fallout removal", "Tyre dressing"],
  },
  bonnet: {
    score: 55,
    issues: ["Bug residue near leading edge", "Water spotting", "Moderate swirl marks"],
    services: ["Bug & tar removal", "Single-stage machine polish"],
  },
  roof: {
    score: 30,
    issues: ["Light dust and pollen"],
    services: ["Hand wash & dry"],
  },
  bumper: {
    score: 64,
    issues: ["Bug splatter on front bumper", "Minor scuffs on lower lip"],
    services: ["Bug & tar removal", "Trim restoration"],
  },
  boot: {
    score: 18,
    issues: ["Dust on boot floor"],
    services: ["Interior vacuum"],
  },
  glass: {
    score: 48,
    issues: ["Smears on inside of windscreen", "Mineral spots on side windows"],
    services: ["Glass polish", "Glass sealant"],
  },
  interior: {
    score: 71,
    issues: ["Crumbs and debris in footwells", "Stains on driver's seat", "Dusty dashboard vents"],
    services: ["Interior vacuum", "Upholstery shampoo", "Dashboard clean & protect"],
  },
};

export function buildMockResponse(request: AssessRequest): AssessResponse {
  const parts: PartResult[] = request.parts.map((p, i) => ({
    category: p.category,
    ...MOCK_PARTS[p.category],
    // With several parts, flag the 2nd as "poor" so the photo-quality notice is visible in mock mode.
    photoQuality: request.parts.length > 1 && i === 1 ? "poor" : "good",
  }));
  const overallScore = Math.round(parts.reduce((sum, p) => sum + p.score, 0) / parts.length);
  return {
    overallScore,
    overallLabel: labelForScore(overallScore),
    parts,
    // Deliberately not deduplicated: the UI must handle duplicates from the backend.
    recommendedServices: parts.flatMap((p) => p.services),
    disclaimer:
      "This is an AI-generated estimate based on your photos (mock data). A detailer will confirm " +
      "the condition and final price in person.",
  };
}

export async function mockAssess(request: AssessRequest, delayMs = 2000): Promise<AssessResponse> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return buildMockResponse(request);
}
