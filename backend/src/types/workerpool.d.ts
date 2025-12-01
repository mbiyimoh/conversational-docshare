declare module 'workerpool' {
  export interface Pool {
    exec<T>(method: string, params: unknown[], options?: { timeout?: number }): Promise<T>
    terminate(force?: boolean): Promise<void>
    stats(): { totalWorkers: number; busyWorkers: number; idleWorkers: number }
  }

  export interface PoolOptions {
    maxWorkers?: number
    workerType?: 'thread' | 'process' | 'web'
    workerTerminateTimeout?: number
  }

  type WorkerFunction = (...args: never[]) => unknown

  export function pool(workerPath: string, options?: PoolOptions): Pool
  export function worker(methods: Record<string, WorkerFunction>): void

  export class TimeoutError extends Error {}
}
