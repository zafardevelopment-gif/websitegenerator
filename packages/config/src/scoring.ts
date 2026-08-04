/**
 * Lead scoring engine (SRS Module 2, US-2.6).
 *
 * score = rating component + review-volume component + no-website bonus
 *       + category weight, clamped to 0–100.
 *
 * Weights are stored in aiwebsite_settings under `scoring_weights` and
 * editable in Settings → Scoring; these are the defaults.
 */

export interface ScoringWeights {
  /** Max points contributed by a 5.0 Google rating. */
  ratingWeight: number;
  /** Max points contributed by review volume (saturates at reviewSaturation). */
  reviewsWeight: number;
  /** Review count at which the volume component maxes out. */
  reviewSaturation: number;
  /** Bonus when the business has NO existing website (our best prospects). */
  noWebsiteWeight: number;
  /** Category weight applied when no override matches. */
  defaultCategoryWeight: number;
  /** Per-category overrides, e.g. { "Dental Clinic": 15 }. */
  categoryOverrides: Record<string, number>;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  ratingWeight: 35,
  reviewsWeight: 25,
  reviewSaturation: 500,
  noWebsiteWeight: 25,
  defaultCategoryWeight: 10,
  categoryOverrides: {},
};

export interface ScoringInput {
  googleRating: number | null;
  reviewCount: number | null;
  hasWebsite: boolean;
  category: string | null;
}

export function computeLeadScore(input: ScoringInput, weights: ScoringWeights): number {
  const rating = input.googleRating ?? 0;
  const reviews = Math.max(0, input.reviewCount ?? 0);
  const saturation = Math.max(1, weights.reviewSaturation);

  const ratingComponent = (rating / 5) * weights.ratingWeight;
  const reviewsComponent = (Math.min(reviews, saturation) / saturation) * weights.reviewsWeight;
  const noWebsiteComponent = input.hasWebsite ? 0 : weights.noWebsiteWeight;
  const categoryComponent =
    (input.category !== null ? weights.categoryOverrides[input.category] : undefined) ??
    weights.defaultCategoryWeight;

  const total = ratingComponent + reviewsComponent + noWebsiteComponent + categoryComponent;
  return Math.max(0, Math.min(100, Math.round(total)));
}

/** Safely merges stored (possibly partial/legacy) weights over defaults. */
export function normalizeScoringWeights(raw: unknown): ScoringWeights {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_SCORING_WEIGHTS };
  const r = raw as Partial<Record<keyof ScoringWeights, unknown>>;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  const overrides: Record<string, number> = {};
  if (typeof r.categoryOverrides === "object" && r.categoryOverrides !== null) {
    for (const [key, value] of Object.entries(r.categoryOverrides as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value)) overrides[key] = value;
    }
  }
  return {
    ratingWeight: num(r.ratingWeight, DEFAULT_SCORING_WEIGHTS.ratingWeight),
    reviewsWeight: num(r.reviewsWeight, DEFAULT_SCORING_WEIGHTS.reviewsWeight),
    reviewSaturation: num(r.reviewSaturation, DEFAULT_SCORING_WEIGHTS.reviewSaturation),
    noWebsiteWeight: num(r.noWebsiteWeight, DEFAULT_SCORING_WEIGHTS.noWebsiteWeight),
    defaultCategoryWeight: num(
      r.defaultCategoryWeight,
      DEFAULT_SCORING_WEIGHTS.defaultCategoryWeight
    ),
    categoryOverrides: overrides,
  };
}
