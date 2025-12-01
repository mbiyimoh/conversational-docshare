// Jest setup file
import { jest, afterAll } from '@jest/globals'

// Increase timeout for LLM calls in tests
jest.setTimeout(15000)

// Mock environment variables
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test'
process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret'

// Cleanup after all tests
afterAll(async () => {
  // Allow async cleanup
  await new Promise(resolve => setTimeout(resolve, 100))
})
