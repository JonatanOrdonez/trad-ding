import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock cache module
const mockGetCached = vi.fn();
const mockSetCached = vi.fn();
vi.mock("@/lib/cache", () => ({
  getCached: (...args: unknown[]) => mockGetCached(...args),
  setCached: (...args: unknown[]) => mockSetCached(...args),
}));

// Mock supabase
const mockFrom = vi.fn();
vi.mock("@/lib/services/supabase", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

// Mock yahoo-finance2
vi.mock("yahoo-finance2", () => ({
  default: class {
    historical() {
      return [];
    }
  },
}));

// Mock @upstash/redis
vi.mock("@upstash/redis", () => ({
  Redis: class {
    del() {
      return Promise.resolve();
    }
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/train", {
    method: "POST",
    headers,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/train", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("TRAIN_API_KEY", "test-secret-key");
    vi.stubEnv("MODAL_TRAIN_URL", "https://modal.example.com/train");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token");
    mockGetCached.mockResolvedValue(null);
    mockSetCached.mockResolvedValue(undefined);
  });

  // ── Auth tests ─────────────────────────────────────────────────────────────

  describe("authentication", () => {
    it("returns 403 when no X-API-Key header is provided", async () => {
      const { POST } = await import("../route");
      const req = makeRequest();
      const res = await POST(req as any);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.detail).toBe("Forbidden");
    });

    it("returns 403 when X-API-Key is wrong", async () => {
      const { POST } = await import("../route");
      const req = makeRequest({ "x-api-key": "wrong-key" });
      const res = await POST(req as any);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.detail).toBe("Forbidden");
    });

    it("returns 403 when TRAIN_API_KEY env var is not set", async () => {
      vi.stubEnv("TRAIN_API_KEY", "");
      const { POST } = await import("../route");
      const req = makeRequest({ "x-api-key": "any-key" });
      const res = await POST(req as any);

      expect(res.status).toBe(403);
    });

    it("passes auth with correct API key", async () => {
      // Auth passes, but will hit rate limit/lock/assets query next
      mockFrom.mockReturnValue({
        select: () => ({
          execute: () => Promise.resolve({ data: [] }),
          order: () => ({ execute: () => Promise.resolve({ data: [] }) }),
        }),
      });
      // Return empty assets
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue({ data: [] }),
        }),
      });

      const { POST } = await import("../route");
      const req = makeRequest({ "x-api-key": "test-secret-key" });
      const res = await POST(req as any);

      // Should not be 403 — it gets past auth
      expect(res.status).not.toBe(403);
    });
  });

  // ── Rate limit tests ───────────────────────────────────────────────────────

  describe("rate limiting", () => {
    it("returns 429 when rate limit key exists in Redis", async () => {
      // First getCached call (rate limit) returns a timestamp
      mockGetCached.mockResolvedValueOnce("2026-01-01T00:00:00Z");

      const { POST } = await import("../route");
      const req = makeRequest({ "x-api-key": "test-secret-key" });
      const res = await POST(req as any);

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.detail).toContain("Rate limited");
    });

    it("passes rate limit when no key exists", async () => {
      // First getCached (rate limit) returns null
      mockGetCached.mockResolvedValueOnce(null);
      // Second getCached (lock) returns null
      mockGetCached.mockResolvedValueOnce(null);

      // Mock supabase to return empty assets
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue({ data: [] }),
        }),
      });

      const { POST } = await import("../route");
      const req = makeRequest({ "x-api-key": "test-secret-key" });
      const res = await POST(req as any);

      expect(res.status).not.toBe(429);
    });
  });

  // ── Concurrency lock tests ─────────────────────────────────────────────────

  describe("concurrency lock", () => {
    it("returns 409 when lock is already held", async () => {
      // First getCached (rate limit) returns null
      mockGetCached.mockResolvedValueOnce(null);
      // Second getCached (lock) returns existing lock
      mockGetCached.mockResolvedValueOnce("locked");

      const { POST } = await import("../route");
      const req = makeRequest({ "x-api-key": "test-secret-key" });
      const res = await POST(req as any);

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.detail).toContain("already in progress");
    });

    it("proceeds when lock is not held", async () => {
      // Rate limit: null, Lock: null
      mockGetCached.mockResolvedValueOnce(null);
      mockGetCached.mockResolvedValueOnce(null);

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue({ data: [] }),
        }),
      });

      const { POST } = await import("../route");
      const req = makeRequest({ "x-api-key": "test-secret-key" });
      const res = await POST(req as any);

      expect(res.status).not.toBe(409);
    });
  });

  // ── Empty assets ───────────────────────────────────────────────────────────

  describe("empty assets", () => {
    it("returns empty results when no assets exist", async () => {
      mockGetCached.mockResolvedValueOnce(null); // rate limit
      mockGetCached.mockResolvedValueOnce(null); // lock

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue({ data: [] }),
        }),
      });

      const { POST } = await import("../route");
      const req = makeRequest({ "x-api-key": "test-secret-key" });
      const res = await POST(req as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results).toEqual([]);
    });
  });

  // ── Protection order ──────────────────────────────────────────────────────

  describe("protection order", () => {
    it("checks auth before rate limit", async () => {
      // Set rate limit active
      mockGetCached.mockResolvedValueOnce("2026-01-01T00:00:00Z");

      const { POST } = await import("../route");
      // No API key — should fail auth before checking rate limit
      const req = makeRequest();
      const res = await POST(req as any);

      expect(res.status).toBe(403);
      // getCached should not have been called (auth failed first)
      expect(mockGetCached).not.toHaveBeenCalled();
    });

    it("checks rate limit before lock", async () => {
      // Rate limit active
      mockGetCached.mockResolvedValueOnce("2026-01-01T00:00:00Z");

      const { POST } = await import("../route");
      const req = makeRequest({ "x-api-key": "test-secret-key" });
      const res = await POST(req as any);

      expect(res.status).toBe(429);
      // getCached called once for rate limit, but NOT for lock
      expect(mockGetCached).toHaveBeenCalledTimes(1);
    });
  });
});
