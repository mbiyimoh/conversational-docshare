import { prisma } from '../utils/prisma'
import { getOpenAI } from '../utils/openai'
import { buildSystemPrompt } from './contextService'
import { searchSimilarChunks } from './embeddingService'
import { retryWithBackoff } from '../utils/retry'
import { LLMError } from '../utils/errors'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatCompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  depth?: 'concise' | 'balanced' | 'detailed'
}

/**
 * Get conversation history
 */
async function getConversationHistory(conversationId: string, limit: number = 10): Promise<ChatMessage[]> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: {
      role: true,
      content: true,
    },
  })

  return messages.map((m: { role: string; content: string }) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }))
}

/**
 * Generate a concise summary of older conversation messages
 * Used when conversation exceeds 10 messages to provide context
 * without exceeding token limits
 */
export async function generateHistorySummary(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  if (messages.length === 0) return ''

  const transcript = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n')

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini', // Cost-effective for summaries
    messages: [
      {
        role: 'system',
        content: `Summarize this conversation history in 2-3 sentences.
Focus on: main topics discussed, key questions asked, and any conclusions reached.
Keep it concise - this will be prepended to ongoing conversation context.`,
      },
      {
        role: 'user',
        content: transcript,
      },
    ],
    temperature: 0.3,
    max_tokens: 200,
  })

  return response.choices[0].message.content || ''
}

/**
 * Build context from relevant document chunks
 * Includes document filename and section ID for proper citations
 */
export async function buildDocumentContext(projectId: string, userMessage: string): Promise<string> {
  // Search for relevant chunks
  const similarChunks = await searchSimilarChunks(projectId, userMessage, 5)

  if (similarChunks.length === 0) {
    return ''
  }

  const contextParts: string[] = []
  contextParts.push('## RELEVANT DOCUMENT SECTIONS')
  contextParts.push('')
  contextParts.push(
    'Use these sections to answer the question. CITE each section using the format shown.'
  )
  contextParts.push('')

  for (const chunk of similarChunks) {
    // Show document and section info prominently
    // Use originalName for display, but internal filename for citation matching
    const displayName = chunk.originalName || chunk.filename
    const sectionHeader = chunk.sectionTitle
      ? `${chunk.documentTitle} - ${chunk.sectionTitle}`
      : chunk.documentTitle
    contextParts.push(`### ${sectionHeader}`)
    contextParts.push(`**Document:** ${displayName}`)
    if (chunk.sectionId) {
      contextParts.push(`**Section ID:** ${chunk.sectionId}`)
      // Use internal filename in citation format for consistent resolution
      contextParts.push(`**Cite as:** \`[DOC:${chunk.filename}:${chunk.sectionId}]\``)
    }
    contextParts.push('')
    contextParts.push(chunk.content)
    contextParts.push('')
    contextParts.push(`(Relevance: ${(chunk.similarity * 100).toFixed(1)}%)`)
    contextParts.push('')
    contextParts.push('---')
    contextParts.push('')
  }

  return contextParts.join('\n')
}

/**
 * Generate chat completion with streaming
 */
export async function generateChatCompletion(
  projectId: string,
  conversationId: string,
  userMessage: string,
  options: ChatCompletionOptions = {}
): Promise<AsyncIterable<string> | string> {
  try {
    // Get agent config
    const agentConfig = await prisma.agentConfig.findUnique({
      where: { projectId },
    })

    const model = options.model || agentConfig?.preferredModel || 'gpt-4-turbo'
    const temperature = options.temperature ?? agentConfig?.temperature ?? 0.7
    const maxTokens = options.maxTokens || 2000
    const depth = options.depth || 'balanced'

    // Build system prompt with depth preference
    const systemPrompt = await buildSystemPrompt(projectId, { depth })

    // Build document context from RAG
    const documentContext = await buildDocumentContext(projectId, userMessage)

    // Get conversation history
    const history = await getConversationHistory(conversationId, 10)

    // Compose messages
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(documentContext ? [{ role: 'system' as const, content: documentContext }] : []),
      ...history,
      { role: 'user', content: userMessage },
    ]

    // Save user message and increment messageCount
    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: userMessage,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { messageCount: { increment: 1 } },
      }),
    ])

    // Generate completion
    if (options.stream) {
      // Return async iterable for streaming
      return streamChatCompletion(messages, conversationId, {
        model,
        temperature,
        maxTokens,
      })
    } else {
      // Return complete response
      const response = await retryWithBackoff(
        async () => {
          return await getOpenAI().chat.completions.create({
            model,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            temperature,
            max_tokens: maxTokens,
          })
        },
        {
          maxAttempts: 3,
          initialDelayMs: 1000,
        }
      )

      const assistantMessage = response.choices[0].message.content || ''

      // Save assistant message and increment messageCount
      await prisma.$transaction([
        prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: assistantMessage,
            metadata: {
              model,
              promptTokens: response.usage?.prompt_tokens,
              completionTokens: response.usage?.completion_tokens,
            },
          },
        }),
        prisma.conversation.update({
          where: { id: conversationId },
          data: { messageCount: { increment: 1 } },
        }),
      ])

      return assistantMessage
    }
  } catch (error) {
    throw new LLMError(`Failed to generate chat completion: ${(error as Error).message}`)
  }
}

/**
 * Stream chat completion
 */
async function* streamChatCompletion(
  messages: ChatMessage[],
  conversationId: string,
  options: { model: string; temperature: number; maxTokens: number }
): AsyncIterable<string> {
  const stream = await getOpenAI().chat.completions.create({
    model: options.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: options.temperature,
    max_tokens: options.maxTokens,
    stream: true,
  })

  let fullResponse = ''

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || ''
    if (content) {
      fullResponse += content
      yield content
    }
  }

  // Save complete assistant message after streaming and increment messageCount
  await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: fullResponse,
        metadata: {
          model: options.model,
          streamed: true,
        },
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { messageCount: { increment: 1 } },
    }),
  ])
}

/**
 * Generate chat completion with optional history summary prepended
 * Extends the standard generateChatCompletion with summary support
 * Used for conversation continuation where older messages need summarization
 */
export async function generateChatCompletionWithSummary(
  projectId: string,
  conversationId: string,
  userMessage: string,
  historySummary: string | null,
  options: ChatCompletionOptions = {}
): Promise<AsyncIterable<string> | string> {
  // Get agent config
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
  })

  const model = options.model || agentConfig?.preferredModel || 'gpt-4-turbo'
  const temperature = options.temperature ?? agentConfig?.temperature ?? 0.7
  const maxTokens = options.maxTokens || 2000

  // Build system prompt
  const systemPrompt = await buildSystemPrompt(projectId)

  // Build document context from RAG
  const documentContext = await buildDocumentContext(projectId, userMessage)

  // Get recent conversation history (last 10 messages)
  const history = await getConversationHistory(conversationId, 10)

  // Compose messages with optional summary
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(documentContext ? [{ role: 'system' as const, content: documentContext }] : []),
    ...(historySummary
      ? [
          {
            role: 'system' as const,
            content: `## PREVIOUS CONVERSATION SUMMARY\n\nThe following summarizes earlier discussion in this conversation:\n\n${historySummary}`,
          },
        ]
      : []),
    ...history,
    { role: 'user', content: userMessage },
  ]

  // Save user message and increment messageCount
  await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: userMessage,
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { messageCount: { increment: 1 } },
    }),
  ])

  // Generate completion (streaming or non-streaming)
  if (options.stream) {
    return streamChatCompletion(messages, conversationId, {
      model,
      temperature,
      maxTokens,
    })
  } else {
    const response = await getOpenAI().chat.completions.create({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature,
      max_tokens: maxTokens,
    })

    const assistantMessage = response.choices[0].message.content || ''

    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: assistantMessage,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { messageCount: { increment: 1 } },
      }),
    ])

    return assistantMessage
  }
}

/**
 * Create a new conversation with optional welcome message
 */
export async function createConversation(
  projectId: string,
  shareLinkId?: string,
  viewerEmail?: string,
  viewerName?: string,
  generateWelcome: boolean = true
) {
  // Import dynamically to avoid circular dependency
  const { generateWelcomeMessage } = await import('./welcomeService')

  const conversation = await prisma.conversation.create({
    data: {
      projectId,
      shareLinkId,
      viewerEmail,
      viewerName,
    },
  })

  // Generate and save welcome message
  if (generateWelcome) {
    try {
      const welcomeMessage = await generateWelcomeMessage(projectId)
      await prisma.$transaction([
        prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: 'assistant',
            content: welcomeMessage,
            metadata: {
              isWelcomeMessage: true,
            },
          },
        }),
        prisma.conversation.update({
          where: { id: conversation.id },
          data: { messageCount: { increment: 1 } },
        }),
      ])
    } catch (error) {
      console.error('Failed to generate welcome message:', error)
      // Don't fail conversation creation if welcome message fails
    }
  }

  return conversation
}

/**
 * Get conversation by ID
 */
export async function getConversation(conversationId: string) {
  return await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
      recipientMessage: {
        select: {
          id: true,
          content: true,
          viewerEmail: true,
          viewerName: true,
          createdAt: true,
        },
      },
    },
  })
}
