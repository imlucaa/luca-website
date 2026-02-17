interface RateLimitConfig {
  namespace: string;
  limit: number;
  windowMs: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
  resetAt: number;
  headers: HeadersInit;
}

declare global {
  var __lucaRateLimitStore: Map<string, RateLimitBucket> | undefined;
}

const rateLimitStore = globalThis.__lucaRateLimitStore ?? new Map<string, RateLimitBucket>();
if (!globalThis.__lucaRateLimitStore) {
  globalThis.__lucaRateLimitStore = rateLimitStore;
}

function cleanupExpiredBuckets(now: number) {
  if (rateLimitStore.size < 2000) return;

  for (const [key, bucket] of rateLimitStore.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return request.headers.get('x-real-ip') || 'unknown';
}

export function rateLimit(request: Request, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const ip = getClientIp(request);
  const key = `${config.namespace}:${ip}`;

  const existingBucket = rateLimitStore.get(key);
  const bucket: RateLimitBucket =
    existingBucket && existingBucket.resetAt > now
      ? existingBucket
      : { count: 0, resetAt: now + config.windowMs };

  bucket.count += 1;
  rateLimitStore.set(key, bucket);

  const remaining = Math.max(0, config.limit - bucket.count);
  const retryAfter = Math.max(0, Math.ceil((bucket.resetAt - now) / 1000));
  const ok = bucket.count <= config.limit;

  return {
    ok,
    limit: config.limit,
    remaining,
    retryAfter,
    resetAt: bucket.resetAt,
    headers: {
      'X-RateLimit-Limit': String(config.limit),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(Math.ceil(bucket.resetAt / 1000)),
      ...(ok ? {} : { 'Retry-After': String(retryAfter) }),
    },
  };
}
