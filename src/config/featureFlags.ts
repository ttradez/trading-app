/**
 * Runtime feature flags. Architecture stays wired (native modules
 * installed, services exported, hooks mounted) — these toggles just
 * short-circuit the runtime behavior so v1 can ship as fully free
 * without ripping out the paid-tier plumbing.
 *
 * Flip to `true` when the corresponding system is ready to go live.
 */
export const FEATURE_FLAGS = {
  REVENUECAT_ENABLED: false, // Flip to true in v1.1 when Pro launches
  ADMOB_ENABLED: false,      // Flip to true when AdMob is wired
} as const;
