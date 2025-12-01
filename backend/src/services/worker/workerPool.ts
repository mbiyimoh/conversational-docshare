import workerpool from 'workerpool'
import path from 'path'
import { spawn } from 'child_process'
import { readFileSync, unlinkSync, mkdirSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import type { ProcessedDocumentWithChunks } from './processDocumentChild'

let pool: workerpool.Pool | null = null

// Ensure temp directory exists
const TEMP_DIR = path.join(tmpdir(), 'docshare-processing')
if (!existsSync(TEMP_DIR)) {
  mkdirSync(TEMP_DIR, { recursive: true })
}

// Child process heap size in MB (8GB to handle large PDFs)
const CHILD_HEAP_SIZE_MB = 8192

/**
 * Check if running in development mode (TypeScript source)
 */
export function isDevelopment(): boolean {
  return __filename.endsWith('.ts')
}

/**
 * Resolve worker path for production (compiled JS only).
 */
function getWorkerPath(): string {
  return path.join(__dirname, 'documentWorker.js')
}

/**
 * Get child process script path for development mode
 */
function getChildProcessPath(): string {
  return path.join(__dirname, 'processDocumentChild.ts')
}

/**
 * Process document in a child process (development mode).
 * Uses spawn with tsx to run TypeScript in an isolated process.
 * Uses temp file for output to avoid OOM when parsing large JSON.
 */
export function processInChildProcess(
  filePath: string,
  mimeType: string,
  timeout: number = 120000
): Promise<ProcessedDocumentWithChunks> {
  return new Promise((resolve, reject) => {
    const childScript = getChildProcessPath()
    const outputPath = path.join(TEMP_DIR, `result-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)

    // Use node directly with tsx as ESM loader and explicit memory limit
    // This ensures --max-old-space-size is actually applied to the Node process
    const child = spawn(
      'node',
      [`--max-old-space-size=${CHILD_HEAP_SIZE_MB}`, '--import', 'tsx', childScript, filePath, mimeType, outputPath],
      {
        cwd: path.join(__dirname, '../../..'),
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout,
        env: process.env,
      }
    )

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('error', (error) => {
      reject(new Error(`Child process error: ${error.message}`))
    })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Child process exited with code ${code}: ${stderr}`))
        return
      }

      try {
        // Parse the small status output from stdout
        const lines = stdout.trim().split('\n')
        let statusResult: { success: boolean; error?: string } | null = null

        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim()
          if (line.startsWith('{')) {
            try {
              statusResult = JSON.parse(line)
              break
            } catch {
              // Not valid JSON, try previous line
            }
          }
        }

        if (!statusResult) {
          reject(new Error(`Invalid status output from child process: ${stdout}`))
          return
        }

        if (!statusResult.success) {
          reject(new Error(statusResult.error || 'Unknown error in child process'))
          return
        }

        // Read the full result from temp file
        const resultJson = readFileSync(outputPath, 'utf-8')
        const result: ProcessedDocumentWithChunks = JSON.parse(resultJson)

        // Clean up temp file
        try {
          unlinkSync(outputPath)
        } catch {
          // Ignore cleanup errors
        }

        resolve(result)
      } catch (parseError) {
        reject(new Error(`Failed to read child process output: ${(parseError as Error).message}`))
      }
    })

    // Handle timeout
    setTimeout(() => {
      child.kill('SIGKILL')
      // Clean up temp file on timeout
      try {
        unlinkSync(outputPath)
      } catch {
        // Ignore cleanup errors
      }
      reject(new Error(`Document processing timed out after ${timeout}ms`))
    }, timeout)
  })
}

/**
 * Get worker pool - only available in production with compiled JS.
 * In development, returns null and processing should use processInChildProcess instead.
 */
export function getDocumentWorkerPool(): workerpool.Pool | null {
  // In development, don't use worker pool - use child process instead
  if (isDevelopment()) {
    return null
  }

  if (!pool) {
    pool = workerpool.pool(getWorkerPath(), {
      maxWorkers: 2,
      workerType: 'thread',
      workerTerminateTimeout: 30000,
    })
  }
  return pool
}

export async function terminatePool(): Promise<void> {
  if (pool) {
    await pool.terminate()
    pool = null
  }
}
