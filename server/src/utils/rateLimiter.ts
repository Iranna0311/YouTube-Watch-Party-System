/**
 * In-memory sliding window rate limiter per socket.
 * Protects against WebSocket flooding / spam attacks.
 */
export class SocketRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  public checkLimit(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    // Filter timestamps within the current sliding window
    const recent = timestamps.filter((t) => now - t < this.windowMs);

    if (recent.length >= this.maxRequests) {
      return false; // Rate limit exceeded
    }

    recent.push(now);
    this.requests.set(key, recent);
    return true;
  }

  public reset(key: string): void {
    this.requests.delete(key);
  }
}

