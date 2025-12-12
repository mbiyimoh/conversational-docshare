import { prisma } from '../utils/prisma'
import { getOpenAI } from '../utils/openai'
import { NotFoundError } from '../utils/errors'
import type { AudienceSynthesis } from '@prisma/client'

const openai = getOpenAI()

interface SynthesisData {
  overview: string
  commonQuestions: Array<{ pattern: string; frequency: number; documents: string[] }>
  knowledgeGaps: Array<{ topic: string; severity: string; suggestion: string }>
  documentSuggestions: Array<{ documentId: string; section: string; suggestion: string }>
  sentimentTrend: 'improving' | 'stable' | 'declining'
  insights: string[]
}

interface ConversationSummary {
  id: string
  summary: string | null
  topics: string[]
  sentiment: string | null
  messageCount: number
  startedAt: Date
  endedAt?: Date | null
}

/**
 * Get the latest synthesis version for a project
 */
export async function getLatestSynthesis(projectId: string) {
  return prisma.audienceSynthesis.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
  })
}

/**
 * Update synthesis incrementally after a conversation ends
 */
export async function updateAudienceSynthesis(
  projectId: string,
  conversationId: string
) {
  // 1. Load previous synthesis
  const previousSynthesis = await getLatestSynthesis(projectId)

  // 2. Load the new conversation
  const newConversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      summary: true,
      topics: true,
      sentiment: true,
      messageCount: true,
      startedAt: true,
    },
  })

  if (!newConversation) {
    throw new NotFoundError('Conversation')
  }

  // Skip synthesis update if conversation has no meaningful data
  if (!newConversation.summary || newConversation.topics.length === 0) {
    console.warn(`Skipping synthesis update for conversation ${conversationId} - no summary available`)
    return previousSynthesis
  }

  // 3. If no previous synthesis, do full regeneration
  if (!previousSynthesis) {
    return regenerateAudienceSynthesis(projectId)
  }

  // 4. Build incremental update prompt
  const prompt = buildIncrementalPrompt(previousSynthesis, newConversation)

  // 5. Call LLM for updated synthesis
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert at analyzing audience engagement patterns.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  })

  const synthesisData = JSON.parse(
    response.choices[0].message.content!
  ) as SynthesisData

  // 6. Store as new version
  return prisma.audienceSynthesis.create({
    data: {
      projectId,
      version: previousSynthesis.version + 1,
      overview: synthesisData.overview,
      commonQuestions: synthesisData.commonQuestions,
      knowledgeGaps: synthesisData.knowledgeGaps,
      documentSuggestions: synthesisData.documentSuggestions,
      sentimentTrend: synthesisData.sentimentTrend,
      insights: synthesisData.insights,
      conversationCount: previousSynthesis.conversationCount + 1,
      totalMessages: previousSynthesis.totalMessages + newConversation.messageCount,
      dateRangeFrom: previousSynthesis.dateRangeFrom,
      dateRangeTo: new Date(),
    },
  })
}

/**
 * Regenerate synthesis from all conversations (full analysis)
 */
export async function regenerateAudienceSynthesis(projectId: string) {
  // Load all ended conversations for project
  const conversations = await prisma.conversation.findMany({
    where: {
      projectId,
      endedAt: { not: null },
    },
    select: {
      id: true,
      summary: true,
      topics: true,
      sentiment: true,
      messageCount: true,
      startedAt: true,
      endedAt: true,
    },
    orderBy: { startedAt: 'asc' },
  })

  if (conversations.length === 0) {
    return null
  }

  // Build full analysis prompt
  const prompt = buildFullAnalysisPrompt(conversations)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert at analyzing audience engagement patterns.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  })

  const synthesisData = JSON.parse(
    response.choices[0].message.content!
  ) as SynthesisData

  // Get current max version
  const latestSynthesis = await getLatestSynthesis(projectId)
  const newVersion = (latestSynthesis?.version ?? 0) + 1

  // Calculate totals
  const totalMessages = conversations.reduce((sum: number, c) => sum + c.messageCount, 0)

  return prisma.audienceSynthesis.create({
    data: {
      projectId,
      version: newVersion,
      overview: synthesisData.overview,
      commonQuestions: synthesisData.commonQuestions,
      knowledgeGaps: synthesisData.knowledgeGaps,
      documentSuggestions: synthesisData.documentSuggestions,
      sentimentTrend: synthesisData.sentimentTrend,
      insights: synthesisData.insights,
      conversationCount: conversations.length,
      totalMessages,
      dateRangeFrom: conversations[0].startedAt,
      dateRangeTo: conversations[conversations.length - 1].endedAt!,
    },
  })
}

function buildIncrementalPrompt(
  previousSynthesis: AudienceSynthesis,
  newConversation: ConversationSummary
): string {
  return `
You are updating an audience synthesis based on a new conversation.

## Previous Synthesis (Version ${previousSynthesis.version})
Overview: ${previousSynthesis.overview}

Common Questions:
${JSON.stringify(previousSynthesis.commonQuestions, null, 2)}

Knowledge Gaps:
${JSON.stringify(previousSynthesis.knowledgeGaps, null, 2)}

Document Suggestions:
${JSON.stringify(previousSynthesis.documentSuggestions, null, 2)}

Sentiment Trend: ${previousSynthesis.sentimentTrend}

Insights:
${JSON.stringify(previousSynthesis.insights, null, 2)}

Conversation Count: ${previousSynthesis.conversationCount}

## New Conversation Summary
Summary: ${newConversation.summary || 'No summary available'}
Topics: ${(newConversation.topics || []).join(', ')}
Sentiment: ${newConversation.sentiment || 'neutral'}
Message Count: ${newConversation.messageCount}

## Instructions
Update the synthesis to incorporate insights from this new conversation.

Return JSON with this structure:
{
  "overview": "Updated overall pattern description (1-2 paragraphs)",
  "commonQuestions": [
    { "pattern": "Question pattern", "frequency": 5, "documents": ["doc1.pdf"] }
  ],
  "knowledgeGaps": [
    { "topic": "Area of confusion", "severity": "high", "suggestion": "How to address" }
  ],
  "documentSuggestions": [
    { "documentId": "...", "section": "Section name", "suggestion": "What to improve" }
  ],
  "sentimentTrend": "improving|stable|declining",
  "insights": ["Specific insight 1", "Specific insight 2"]
}

Important:
- Preserve patterns that still hold true
- Update frequencies where relevant
- Add new patterns if they emerge
- Remove patterns that are no longer supported
- Keep insights actionable and specific
- sentimentTrend should reflect direction across all conversations
`
}

function buildFullAnalysisPrompt(conversations: ConversationSummary[]): string {
  const conversationSummaries = conversations
    .map(
      (c, i) => `
Conversation ${i + 1}:
- Summary: ${c.summary || 'No summary'}
- Topics: ${(c.topics || []).join(', ')}
- Sentiment: ${c.sentiment || 'neutral'}
- Messages: ${c.messageCount}
`
    )
    .join('\n')

  return `
Analyze all conversations to create an audience synthesis.

## All Conversations (${conversations.length} total)
${conversationSummaries}

## Instructions
Create a comprehensive synthesis of audience engagement patterns.

Return JSON with this structure:
{
  "overview": "Overall pattern description (1-2 paragraphs)",
  "commonQuestions": [
    { "pattern": "Question pattern", "frequency": 5, "documents": ["doc1.pdf"] }
  ],
  "knowledgeGaps": [
    { "topic": "Area of confusion", "severity": "high", "suggestion": "How to address" }
  ],
  "documentSuggestions": [
    { "documentId": "...", "section": "Section name", "suggestion": "What to improve" }
  ],
  "sentimentTrend": "improving|stable|declining",
  "insights": ["Specific insight 1", "Specific insight 2"]
}

Guidelines:
- Identify recurring question patterns
- Note areas where multiple people struggle
- Suggest specific document improvements
- Track overall sentiment direction
- Provide actionable insights
`
}
