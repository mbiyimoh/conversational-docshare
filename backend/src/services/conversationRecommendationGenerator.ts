import { getOpenAI } from '../utils/openai'
import { prisma } from '../utils/prisma'
import { LLMError } from '../utils/errors'
import type { ConversationRecommendationType, ImpactLevel } from '../types/recommendation'

// Constants
const LLM_TIMEOUT_MS = 60000 // 60 second timeout for recommendation generation
const MIN_MESSAGES_FOR_RECOMMENDATIONS = 5 // Minimum messages needed
const MIN_CONFIDENCE_THRESHOLD = 0.4 // Filter out low-confidence recommendations

const RECOMMENDATION_SYSTEM_PROMPT = `You are an expert analyst who reviews conversations between viewers and AI agents discussing documents.

Your task is to identify actionable improvements based on:
1. Questions that weren't fully answered
2. Confusion or misunderstanding expressed by the viewer
3. Topics the viewer asked about repeatedly
4. Gaps between what the viewer needed and what documents provide

Generate recommendations that help the document sender improve their materials.`

function buildRecommendationPrompt(
  messages: Array<{ role: string; content: string }>,
  documents: Array<{ id: string; filename: string; outline: unknown }>
): string {
  const transcript = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')

  const documentsList = documents
    .map((d) => {
      const outline = d.outline as Array<{ title: string }> | null
      const sections = outline?.map((s) => s.title).join(', ') || 'No sections'
      return `- ${d.filename} (ID: ${d.id})\n  Sections: ${sections}`
    })
    .join('\n')

  return `## Conversation Transcript

${transcript}

## Available Documents

${documentsList}

## Your Task

Analyze the conversation and generate recommendations for the document sender.

For each recommendation, provide:

1. **type**: One of:
   - "document_update": Specific change to document content
   - "consideration": General insight for sender to consider
   - "follow_up": Suggested follow-up action with viewer

2. **targetDocumentId** and **targetSectionId**: For document_update type only

3. **title**: Clear 5-10 word title

4. **description**: 1-2 sentence summary

5. **proposedContent**: For document_update type, provide COMPLETE production-ready text to add or replace. This should be usable immediately without further editing.

6. **changeHighlight**: For document_update type, just the new/changed portion for quick preview

7. **evidenceQuotes**: 2-3 EXACT quotes from the conversation that support this recommendation. Copy verbatim.

8. **reasoning**: Explain why this recommendation will help

9. **confidence**: 0.0 to 1.0 score
   - 0.9-1.0: Very clear signal from conversation
   - 0.7-0.9: Strong evidence
   - 0.5-0.7: Moderate evidence
   - 0.3-0.5: Weak evidence
   - Below 0.3: Speculative

10. **impactLevel**: low, medium, or high

CRITICAL RULES:
- proposedContent must be PRODUCTION-READY, not placeholder text
- evidenceQuotes must be EXACT matches from the transcript
- Generate 0-5 recommendations (quality over quantity)
- If no recommendations are warranted, explain why in noRecommendationsReason

Return valid JSON with this structure:
{
  "recommendations": [...],
  "noRecommendationsReason": null or "explanation"
}`
}

interface RawRecommendation {
  type: string
  targetDocumentId: string | null
  targetSectionId: string | null
  title: string
  description: string
  proposedContent: string | null
  changeHighlight: string | null
  evidenceQuotes: string[]
  reasoning: string
  confidence: number
  impactLevel: string
}

interface ParsedResponse {
  recommendations: RawRecommendation[]
  noRecommendationsReason?: string | null
}

/**
 * Generate recommendations for a conversation
 *
 * Analyzes the conversation transcript and generates actionable recommendations
 * for improving documents based on viewer questions and confusion points.
 *
 * @param conversationId - The conversation to analyze
 * @returns Array of created recommendation IDs
 */
export async function generateConversationRecommendations(
  conversationId: string
): Promise<Array<{ id: string }>> {
  // Using warn for info-level logging (log is not allowed by linter)
  console.warn(`[ConvRec] Generating recommendations for conversation ${conversationId}`)

  // 1. Load conversation with messages and project documents
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true },
      },
      project: {
        include: {
          documents: {
            select: { id: true, filename: true, outline: true },
          },
        },
      },
    },
  })

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`)
  }

  // Skip if insufficient messages
  if (conversation.messages.length < MIN_MESSAGES_FOR_RECOMMENDATIONS) {
    console.warn(
      `[ConvRec] Skipping: only ${conversation.messages.length} messages (need ${MIN_MESSAGES_FOR_RECOMMENDATIONS})`
    )
    return []
  }

  // 2. Build prompt
  const prompt = buildRecommendationPrompt(conversation.messages, conversation.project.documents)

  const openai = getOpenAI()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  try {
    // 3. Call GPT-4o with JSON output
    const response = await openai.chat.completions.create(
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: RECOMMENDATION_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 4000,
      },
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    // 4. Parse and validate
    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new LLMError('No content in OpenAI response')
    }

    const parsed = JSON.parse(content) as ParsedResponse

    if (!Array.isArray(parsed.recommendations)) {
      console.warn(`[ConvRec] Invalid response structure, no recommendations array`)
      return []
    }

    // 5. Filter by confidence threshold
    const filtered = parsed.recommendations.filter((r) => r.confidence >= MIN_CONFIDENCE_THRESHOLD)

    if (filtered.length === 0) {
      console.warn(`[ConvRec] No recommendations above confidence threshold`)
      return []
    }

    // 6. Validate and clean evidence quotes
    const transcript = conversation.messages.map((m: { content: string }) => m.content.toLowerCase()).join(' ')

    filtered.forEach((rec) => {
      rec.evidenceQuotes = rec.evidenceQuotes.filter((quote) => {
        // Check if first 50 chars of quote appear in transcript (case insensitive)
        const exists = transcript.includes(quote.toLowerCase().slice(0, 50))
        if (!exists) {
          console.warn(`[ConvRec] Quote not found in transcript: "${quote.slice(0, 50)}..."`)
        }
        return exists
      })
    })

    // 7. Validate recommendation types
    const validTypes = ['document_update', 'consideration', 'follow_up'] as const
    const validImpacts = ['low', 'medium', 'high'] as const

    // Build set of valid document IDs from the project
    const validDocumentIds = new Set(conversation.project.documents.map((d: { id: string }) => d.id))

    const validatedRecs = filtered.filter((rec) => {
      if (!validTypes.includes(rec.type as ConversationRecommendationType)) {
        console.warn(`[ConvRec] Invalid type: ${rec.type}`)
        return false
      }
      if (!validImpacts.includes(rec.impactLevel as ImpactLevel)) {
        console.warn(`[ConvRec] Invalid impact: ${rec.impactLevel}`)
        return false
      }
      // Validate targetDocumentId if provided - must exist in project
      if (rec.targetDocumentId && !validDocumentIds.has(rec.targetDocumentId)) {
        console.warn(`[ConvRec] Invalid targetDocumentId: ${rec.targetDocumentId} - not found in project`)
        // Clear the invalid ID rather than rejecting the whole recommendation
        rec.targetDocumentId = null
        rec.targetSectionId = null
      }
      return true
    })

    // 8. Store in database
    const created = await prisma.$transaction(
      validatedRecs.map((rec, index) =>
        prisma.conversationRecommendation.create({
          data: {
            conversationId,
            type: rec.type,
            targetDocumentId: rec.targetDocumentId,
            targetSectionId: rec.targetSectionId,
            title: rec.title,
            description: rec.description,
            proposedContent: rec.proposedContent,
            changeHighlight: rec.changeHighlight,
            evidenceQuotes: rec.evidenceQuotes,
            reasoning: rec.reasoning,
            confidence: rec.confidence,
            impactLevel: rec.impactLevel,
            priority: index,
            status: 'pending',
          },
          select: { id: true },
        })
      )
    )

    console.warn(`[ConvRec] Created ${created.length} recommendations for ${conversationId}`)
    return created
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      throw new LLMError('Recommendation generation timed out')
    }

    if (error instanceof SyntaxError) {
      throw new LLMError('Failed to parse AI response: Invalid JSON format')
    }

    throw error
  }
}
