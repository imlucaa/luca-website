interface CacheEnvelope<T> {
  value: T;
  cachedAt: number;
}

interface MemoryEntry {
  payload: string;
  expiresAt: number;
}

interface KvReadOptions {
  freshMs: number;
  staleMs: number;
}

export interface KvReadResult<T> {
  value: T;
  ageMs: number;
  isStale: boolean;
  source: 'memory' | 'remote';
}

declare global {
  var __lucaKvMemoryStore: Map<string, MemoryEntry> | undefined;
}

const memoryStore = globalThis.__lucaKvMemoryStore ?? new Map<string, MemoryEntry>();
if (!globalThis.__lucaKvMemoryStore) {
  globalThis.__lucaKvMemoryStore = memoryStore;
}

const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;
const hasRemoteKv = Boolean(KV_REST_API_URL && KV_REST_API_TOKEN);

function nowMs() {
  return Date.now();
}

function cleanupExpiredMemoryEntries(now: number) {
  if (memoryStore.size < 1000) return;

  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
}

function parseEnvelope<T>(raw: string): CacheEnvelope<T> | null {
  try {
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!('cachedAt' in parsed) || typeof parsed.cachedAt !== 'number') return null;
    if (!('value' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeInMemory(key: string, payload: string, ttlMs: number) {
  memoryStore.set(key, {
    payload,
    expiresAt: nowMs() + ttlMs,
  });
}

async function readFromRemote(key: string): Promise<string | null> {
  if (!hasRemoteKv) return null;

  try {
    const response = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const body = await response.json() as { result?: unknown };
    if (typeof body.result === 'string') {
      return body.result;
    }

    return null;
  } catch {
    return null;
  }
}

async function writeToRemote(key: string, payload: string, ttlSec: number): Promise<void> {
  if (!hasRemoteKv) return;

  try {
    await fetch(`${KV_REST_API_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(payload)}?EX=${ttlSec}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      },
      cache: 'no-store',
    });
  } catch {
    // Keep working with local memory cache.
  }
}

export async function kvGetWithStale<T>(key: string, options: KvReadOptions): Promise<KvReadResult<T> | null> {
  const now = nowMs();
  cleanupExpiredMemoryEntries(now);

  const maxAgeMs = options.freshMs + options.staleMs;

  const memoryHit = memoryStore.get(key);
  if (memoryHit && memoryHit.expiresAt > now) {
    const parsed = parseEnvelope<T>(memoryHit.payload);
    if (parsed) {
      const ageMs = now - parsed.cachedAt;
      if (ageMs <= maxAgeMs) {
        return {
          value: parsed.value,
          ageMs,
          isStale: ageMs > options.freshMs,
          source: 'memory',
        };
      }
    }

    memoryStore.delete(key);
  }

  const remotePayload = await readFromRemote(key);
  if (!remotePayload) {
    return null;
  }

  const parsedRemote = parseEnvelope<T>(remotePayload);
  if (!parsedRemote) {
    return null;
  }

  const remoteAgeMs = now - parsedRemote.cachedAt;
  if (remoteAgeMs > maxAgeMs) {
    return null;
  }

  storeInMemory(key, remotePayload, maxAgeMs);

  return {
    value: parsedRemote.value,
    ageMs: remoteAgeMs,
    isStale: remoteAgeMs > options.freshMs,
    source: 'remote',
  };
}

export async function kvSetWithTimestamp<T>(key: string, value: T, ttlMs: number): Promise<void> {
  const envelope: CacheEnvelope<T> = {
    value,
    cachedAt: nowMs(),
  };

  const payload = JSON.stringify(envelope);
  storeInMemory(key, payload, ttlMs);

  const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
  await writeToRemote(key, payload, ttlSeconds);
}
