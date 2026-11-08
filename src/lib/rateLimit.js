/**
 * Distributed rate limiter backed by Upstash Redis.
 *
 * Local development: if Upstash credentials are absent, rate limiting is
 * bypassed so local API routes remain usable.
 * Production: missing credentials are a configuration error; configure both
 * UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in the deployment.
 */
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { getClientIp } from "@/lib/security";

function hasRedisConfig() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

function createRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    throw new Error(
      "Rate limiter belum dikonfigurasi. Isi UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN."
    );
  }

  return new Redis({ url, token });
}

let redisClient = null;
function getRedis() {
  if (!redisClient) redisClient = createRedisClient();
  return redisClient;
}

const limiters = new Map();

function getLimiter(scope, maxRequests, windowStr) {
  const key = `${scope}:${maxRequests}:${windowStr}`;

  if (!limiters.has(key)) {
    limiters.set(
      key,
      new Ratelimit({
        redis: getRedis(),
        limiter: Ratelimit.slidingWindow(maxRequests, windowStr),
        prefix: `taacomics:rl:${scope}`,
        analytics: false,
      })
    );
  }

  return limiters.get(key);
}

export async function checkRateLimit(
  request,
  { scope = "public_api", limit = 60, window = "1 m", identifier } = {}
) {
  if (!hasRedisConfig()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Missing Upstash configuration: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
      );
    }

    return {
      success: true,
      limit,
      remaining: limit,
      reset: 0,
      headers: {
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(limit),
        "X-RateLimit-Status": "disabled-local",
      },
    };
  }

  try {
    const id = identifier || getClientIp(request);
    const limiter = getLimiter(scope, limit, window);
    const result = await limiter.limit(id);

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      headers: {
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
      },
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[rate-limit] Upstash unavailable in local development; bypassing:", error?.message);
      return {
        success: true,
        limit,
        remaining: limit,
        reset: 0,
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(limit),
          "X-RateLimit-Status": "disabled-local-error",
        },
      };
    }

    throw error;
  }
}
