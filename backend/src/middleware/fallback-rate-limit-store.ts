import { MemoryStore, type ClientRateLimitInfo, type Options, type Store } from "express-rate-limit";

/**
 * A rate-limit store that uses Redis and falls back to this instance's memory while Redis
 * is unreachable (D-063). With one instance that's exactly the old behaviour; with several
 * it's a temporary per-instance limit, which beats both failing open (no limit at all on
 * login) and failing closed (every request a 429).
 */
export class FallbackStore implements Store {
  readonly localKeys = false;
  readonly prefix?: string;
  private readonly memory = new MemoryStore();
  private warned = false;

  constructor(private readonly primary: Store, prefix?: string) {
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.primary.init?.(options);
    this.memory.init(options);
  }

  private async attempt<T>(op: string, primary: () => Promise<T> | T, fallback: () => Promise<T> | T): Promise<T> {
    try {
      const out = await primary();
      this.warned = false;
      return out;
    } catch (err) {
      if (!this.warned) {
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "rate_limit_store_fallback",
            op,
            prefix: this.prefix,
            message: (err as Error).message,
          })
        );
        this.warned = true;
      }
      return fallback();
    }
  }

  increment(key: string): Promise<ClientRateLimitInfo> {
    return this.attempt("increment", () => this.primary.increment(key), () => this.memory.increment(key));
  }

  decrement(key: string): Promise<void> {
    return this.attempt("decrement", () => this.primary.decrement(key), () => this.memory.decrement(key));
  }

  resetKey(key: string): Promise<void> {
    return this.attempt("resetKey", () => this.primary.resetKey(key), () => this.memory.resetKey(key));
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    return this.attempt(
      "get",
      () => this.primary.get?.(key),
      () => this.memory.get(key)
    );
  }
}
