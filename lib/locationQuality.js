// Shared accuracy-quality tiers, used by both the customer's share flow and
// the staff location list, so "what counts as a good reading" only lives in
// one place.
//   0–50m    = high        (very accurate)
//   51–100m  = acceptable
//   101–500m = low         (usable, but flagged)
//   >500m    = unreliable  (not accepted as a confirmed location)
export function getAccuracyQuality(accuracy) {
  if (!Number.isFinite(accuracy)) return "unknown"
  if (accuracy <= 50) return "high"
  if (accuracy <= 100) return "acceptable"
  if (accuracy <= 500) return "low"
  return "unreliable"
}

export const ACCURACY_QUALITY_STYLE = {
  high: "text-emerald-400",
  acceptable: "text-sky-400",
  low: "text-amber-400",
  unreliable: "text-red-400",
  unknown: "text-white/50",
}
