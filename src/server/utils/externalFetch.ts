export interface ExternalFetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  isIdempotent?: boolean;
}

/**
 * Robust wrapper around fetch with AbortController timeout,
 * strict error categorization, and safe exponential retries for idempotent calls.
 * CRITICAL: Never retries non-idempotent operations like payment creation.
 */
export async function externalFetch(
  url: string,
  options: ExternalFetchOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 8000,
    retries = 0,
    isIdempotent = false,
    ...fetchOptions
  } = options;

  let attempt = 0;
  // Maximum retries allowed only if explicitly declared idempotent (e.g. GET)
  const maxAttempts = isIdempotent ? Math.max(1, retries + 1) : 1;

  while (attempt < maxAttempts) {
    attempt++;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });
      clearTimeout(timeoutHandle);

      // Retry on 5xx server errors if idempotent
      if (!response.ok && response.status >= 500 && isIdempotent && attempt < maxAttempts) {
        const backoffMs = Math.min(2000, 200 * Math.pow(2, attempt - 1));
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timeoutHandle);

      const isAbort = err.name === 'AbortError' || err.message?.includes('aborted');
      if (isAbort) {
        if (isIdempotent && attempt < maxAttempts) {
          continue;
        }
        throw new Error(`PROVIDER_TIMEOUT: Requisição externa para ${new URL(url).hostname} excedeu timeout de ${timeoutMs}ms.`);
      }

      // Network failures: only retry if idempotent
      if (isIdempotent && attempt < maxAttempts) {
        const backoffMs = Math.min(2000, 200 * Math.pow(2, attempt - 1));
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }

      throw new Error(`PROVIDER_NETWORK_ERROR: Falha de comunicação com ${new URL(url).hostname}: ${err.message}`);
    }
  }

  throw new Error(`PROVIDER_UNAVAILABLE: Falha após ${maxAttempts} tentativas para ${new URL(url).hostname}.`);
}
