/**
 * SingleFlight / Promise Coalescing
 * Protects against Cache Stampede by merging concurrent identical requests
 * into a single asynchronous operation.
 */
export class SingleFlight {
  private inFlight = new Map<string, Promise<any>>();

  /**
   * Executes fn, or joins an already in-flight promise for the same key.
   */
  public async do<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = (async () => {
      try {
        return await fn();
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Returns current number of active coalesced operations.
   */
  public get activeCount(): number {
    return this.inFlight.size;
  }

  public clear(): void {
    this.inFlight.clear();
  }
}

export const singleFlight = new SingleFlight();
