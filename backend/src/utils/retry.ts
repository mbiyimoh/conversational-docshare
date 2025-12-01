export interface RetryOptions {
  maxAttempts?: number
  initialDelayMs?: number
  backoffMultiplier?: number
  maxDelayMs?: number
  shouldRetry?: (error: Error) => boolean
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt)
  const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs)

  // Add jitter (±20%)
  const jitter = cappedDelay * 0.2 * (Math.random() - 0.5)
  return Math.floor(cappedDelay + jitter)
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config: Required<RetryOptions> = {
    maxAttempts: options.maxAttempts ?? 3,
    initialDelayMs: options.initialDelayMs ?? 1000,
    backoffMultiplier: options.backoffMultiplier ?? 2,
    maxDelayMs: options.maxDelayMs ?? 30000,
    shouldRetry: options.shouldRetry ?? (() => true),
  }

  let lastError: Error

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Check if we should retry
      if (!config.shouldRetry(lastError)) {
        throw lastError
      }

      // Don't delay after last attempt
      if (attempt < config.maxAttempts - 1) {
        const delay = calculateDelay(attempt, config)
        await sleep(delay)
      }
    }
  }

  // All attempts failed
  throw lastError!
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  failures: number
  lastFailureTime: number
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
}

/**
 * Circuit breaker for external services
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'CLOSED',
  }

  constructor(
    private failureThreshold: number = 5,
    private resetTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - this.state.lastFailureTime

      if (timeSinceLastFailure >= this.resetTimeout) {
        // Try to close circuit
        this.state.state = 'HALF_OPEN'
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }

    try {
      const result = await fn()

      // Success - reset failures
      if (this.state.state === 'HALF_OPEN') {
        this.state.state = 'CLOSED'
      }
      this.state.failures = 0

      return result
    } catch (error) {
      // Record failure
      this.state.failures++
      this.state.lastFailureTime = Date.now()

      // Open circuit if threshold exceeded
      if (this.state.failures >= this.failureThreshold) {
        this.state.state = 'OPEN'
      }

      throw error
    }
  }

  getState(): string {
    return this.state.state
  }

  reset(): void {
    this.state = {
      failures: 0,
      lastFailureTime: 0,
      state: 'CLOSED',
    }
  }
}
