// Generic error reporting (previously Lovable-specific, now app-generic)
export function reportAppError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  // Log to console in dev; plug in Sentry or similar for production
  console.error("[Inspire for Change] Unhandled error:", error, context);
}
