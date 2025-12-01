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

  return messages.map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }))
}

/**
 * Build context from relevant document chunks
 */
async function buildDocumentContext(projectId: string, userMessage: string): Promise<string> {
  // Search for relevant chunks
  const similarChunks = await searchSimilarChunks(projectId, userMessage, 5)

  if (similarChunks.length === 0) {
    return ''
  }

  const contextParts: string[] = []
  contextParts.push('## RELEVANT DOCUMENT SECTIONS')
  contextParts.push('')
  contextParts.push(
    'The following sections from the documents are potentially relevant to this question:'
  )
  contextParts.push('')

  for (const chunk of similarChunks) {
    if (chunk.sectionTitle) {
      contextParts.push(`### ${chunk.sectionTitle}`)
    }
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

    // Build system prompt
    const systemPrompt = await buildSystemPrompt(projectId)

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

    // Save user message
    await prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: userMessage,
      },
    })

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

      // Save assistant message
      await prisma.message.create({
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
      })

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

  // Save complete assistant message after streaming
  await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: fullResponse,
      metadata: {
        model: options.model,
        streamed: true,
      },
    },
  })
}

/**
 * Create a new conversation
 */
export async function createConversation(
  projectId: string,
  shareLinkId?: string,
  viewerEmail?: string,
  viewerName?: string
) {
  return await prisma.conversation.create({
    data: {
      projectId,
      shareLinkId,
      viewerEmail,
      viewerName,
    },
  })
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
    },
  })
}
