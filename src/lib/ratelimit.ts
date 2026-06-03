import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Create a new ratelimiter, that allows 10 requests per 1 minute
// We use a blank fallback if env vars are missing so local dev doesn't crash
export const rateLimit = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      }),
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: '@upstash/ratelimit',
    })
  : null;

/**
 * Utility function to apply rate limiting in API routes
 * @param ip The IP address of the incoming request
 * @returns true if the request is allowed, false if rate limited
 */
export async function checkRateLimit(ip: string): Promise<boolean> {
  // If Upstash isn't configured, bypass rate limiting
  if (!rateLimit) return true;

  try {
    const { success } = await rateLimit.limit(ip);
    return success;
  } catch (error) {
    console.error('Rate Limiter Error:', error);
    // Fail open: if redis crashes, don't block legitimate users
    return true; 
  }
}
