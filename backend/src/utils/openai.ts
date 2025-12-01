import OpenAI from 'openai'

let openaiClient: OpenAI | null = null

/**
 * Get singleton OpenAI client instance.
 * Uses lazy initialization to ensure dotenv.config() has run before accessing env vars.
 */
export function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not configured')
    }
    openaiClient = new OpenAI({
      apiKey,
    })
  }
  return openaiClient
}
