import type { Context, Next } from "hono";

/**
 * API key auth middleware.
 * Checks Authorization header against the API_KEY env var.
 * If no key is configured, all requests pass through (dev mode).
 */
export async function symphonyAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const apiKey = (c.env as Record<string, unknown>).API_KEY as
    | string
    | undefined;

  // If no key is set, skip auth (allows dev/testing)
  if (!apiKey) {
    return next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      { success: false, error: "Missing Authorization: Bearer <token>" },
      401,
    );
  }

  const token = authHeader.slice(7);
  if (token !== apiKey) {
    return c.json({ success: false, error: "Invalid API key" }, 403);
  }

  return next();
}
