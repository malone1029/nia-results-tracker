import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limiter for expensive AI routes.
// Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.
// If not configured, rate limiting is silently skipped (no-op).

let ratelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }),
    // 20 AI requests per 60-second window per user
    limiter: Ratelimit.slidingWindow(20, "60 s"),
    prefix: "nia-ai-ratelimit",
  });
}

/**
 * Check rate limit for a user. Returns { success: true } if allowed,
 * or { success: false, response } with a 429 response to return.
 */
export async function checkRateLimit(
  userId: string
): Promise<{ success: true } | { success: false; response: Response }> {
  if (!ratelimit) {
    // No Redis configured — allow all requests
    return { success: true };
  }

  try {
    const { success, remaining, reset } = await ratelimit.limit(userId);

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return {
        success: false,
        response: Response.json(
          { error: "Too many requests. Please wait a moment before trying again." },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfter),
              "X-RateLimit-Remaining": String(remaining),
            },
          }
        ),
      };
    }

    return { success: true };
  } catch {
    // Redis connection error — fail open (allow the request)
    return { success: true };
  }
}
