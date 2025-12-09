import { getOpenAI } from '../utils/openai'
import { LLMError } from '../utils/errors'

/**
 * Conversation analysis schema
 * Structured output from AI analysis of chat conversations
 */
export interface ConversationAnalysis {
  summary: string // 2-3 sentence summary of the conversation
  topics: string[] // 3-5 key topics as single words or short phrases
  sentiment: 'positive' | 'neutral' | 'negative' // Overall conversation sentiment
  actionItems?: string[] // Any action items mentioned (optional)
}

// Constants
const LLM_TIMEOUT_MS = 30000 // 30 second timeout for analysis
const MIN_MESSAGES_FOR_ANALYSIS = 2 // Minimum messages needed for meaningful analysis

/**
 * Generate conversation summary using AI
 *
 * Uses gpt-4o-mini for cost-effective analysis of chat transcripts
 * Returns structured data: summary, topics, sentiment, and optional action items
 *
 * @param messages - Array of chat messages with role and content
 * @returns ConversationAnalysis object with structured insights
 * @throws LLMError if generation fails or times out
 */
export async function generateConversationSummary(
  messages: Array<{ role: string; content: string }>
): Promise<ConversationAnalysis> {
  // Validate input
  if (!messages || messages.length < MIN_MESSAGES_FOR_ANALYSIS) {
    throw new Error(`At least ${MIN_MESSAGES_FOR_ANALYSIS} messages required for analysis`)
  }

  const openai = getOpenAI()

  // Format conversation as transcript
  const transcript = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n')

  const prompt = `Analyze this conversation and provide a structured analysis.

Focus on:
1. What the viewer was trying to learn
2. Key topics discussed
3. Overall sentiment
4. Any follow-up actions

Conversation:
${transcript}

Return your analysis as JSON with this exact structure:
{
  "summary": "2-3 sentence summary of the conversation",
  "topics": ["topic1", "topic2", "topic3", "topic4", "topic5"],
  "sentiment": "positive" | "neutral" | "negative",
  "actionItems": ["action1", "action2"] (optional, only if mentioned)
}

REQUIREMENTS:
- summary: Must be 2-3 complete sentences
- topics: Array of 3-5 items, use single words or short phrases
- sentiment: Must be exactly one of: positive, neutral, negative
- actionItems: Optional array, only include if conversation mentions specific actions or follow-ups

Return valid JSON only.`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  try {
    const response = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You analyze conversations and return structured JSON analysis. Be concise and accurate.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Low temperature for consistent analysis
        max_tokens: 1000, // Sufficient for summary + topics + sentiment
      },
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new LLMError('Failed to generate conversation summary: Empty response')
    }

    // Parse and validate JSON response
    const parsed = JSON.parse(content) as Partial<ConversationAnalysis>

    // Validate required fields
    if (!parsed.summary || typeof parsed.summary !== 'string') {
      throw new LLMError('Invalid response: missing or invalid summary field')
    }

    if (!Array.isArray(parsed.topics) || parsed.topics.length === 0) {
      throw new LLMError('Invalid response: missing or invalid topics array')
    }

    if (!parsed.sentiment || !['positive', 'neutral', 'negative'].includes(parsed.sentiment)) {
      throw new LLMError('Invalid response: sentiment must be positive, neutral, or negative')
    }

    // Validate actionItems if present
    if (parsed.actionItems !== undefined && !Array.isArray(parsed.actionItems)) {
      throw new LLMError('Invalid response: actionItems must be an array if present')
    }

    return {
      summary: parsed.summary,
      topics: parsed.topics,
      sentiment: parsed.sentiment,
      actionItems: parsed.actionItems,
    }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      throw new LLMError('Conversation analysis timed out. Please try again.')
    }

    if (error instanceof LLMError) {
      throw error
    }

    if (error instanceof SyntaxError) {
      throw new LLMError('Failed to parse AI response: Invalid JSON format')
    }

    throw new LLMError(`Failed to generate conversation summary: ${(error as Error).message}`)
  }
}
