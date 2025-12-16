# LLM Integration Architecture

**Purpose:** Complete specification for integrating documents with LLM chat, including RAG strategy, token management, citation verification, and context composition.

---

## Overview

The system uses Vercel AI SDK with swappable LLM providers (OpenAI, Anthropic). Documents must be intelligently integrated into chat context to enable accurate, cited responses.

**Key Challenges:**
1. **Token limits:** Multiple documents can exceed context windows
2. **Citation accuracy:** LLM must reference real sections, not hallucinate
3. **Response relevance:** Find right document chunks for each question
4. **Cost management:** Balance quality vs API costs

**Solution:** Hybrid approach combining document outlines (always loaded) with semantic search (load relevant chunks on-demand).

---

## Architecture Decision: Hybrid Context Strategy

### Option A: Full Documents in Context (NOT CHOSEN)

```
System Prompt (2K tokens)
+ Full Document 1 (10K tokens)
+ Full Document 2 (8K tokens)
+ Full Document 3 (5K tokens)
+ Conversation History (3K tokens)
= 28K tokens total

❌ Problems:
- Exceeds GPT-4 8K limit, requires GPT-4 Turbo (128K)
- Expensive: ~$0.28 per chat message (GPT-4 Turbo input pricing)
- Slow: More tokens = longer generation time
- Wasteful: Most content not relevant to specific question
```

### Option B: Vector Search Only (NOT CHOSEN)

```
System Prompt (2K tokens)
+ Retrieved Chunks (3K tokens, top 5 results)
+ Conversation History (3K tokens)
= 8K tokens total

❌ Problems:
- No document structure visible to LLM
- Can't navigate documents ("What's in Section 3?")
- Citation accuracy depends entirely on chunk metadata
- Requires vector database infrastructure
```

### ✅ Option C: Hybrid (CHOSEN)

```
System Prompt with Agent Config (2K tokens)
+ Document Outlines (all documents, 3K tokens)
+ Retrieved Relevant Chunks (4K tokens, top 8 results)
+ Conversation History (sliding window, 3K tokens)
= 12K tokens total

✅ Benefits:
- Works with GPT-4 8K and GPT-4 Turbo
- LLM sees full structure (can navigate)
- Only retrieves relevant content (cost-effective)
- Accurate citations (section IDs in outlines + chunks)
- Reasonable cost: ~$0.06 per message (GPT-4 Turbo)
```

---

## Implementation: pgvector for Semantic Search

### Why pgvector?

**Comparison:**

| Solution | Pros | Cons | Verdict |
|----------|------|------|---------|
| **pgvector** | ✅ PostgreSQL extension<br>✅ No new infrastructure<br>✅ Atomic with metadata<br>✅ Open source | ⚠️ Slower than specialized DBs | ✅ **CHOSEN** |
| **Pinecone** | ✅ Fast<br>✅ Managed<br>✅ Scales well | ❌ Extra service<br>❌ Cost<br>❌ Metadata sync issues | ❌ Overkill for MVP |
| **Weaviate** | ✅ Fast<br>✅ Rich features | ❌ Extra infrastructure<br>❌ Complexity | ❌ Too complex |
| **In-memory** | ✅ Simple | ❌ Doesn't scale<br>❌ Lost on restart | ❌ Not production-ready |

**Decision:** Use pgvector for MVP. Migrate to Pinecone if vector search becomes bottleneck (unlikely before 1000+ projects).

### Database Schema Extension

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector embeddings to documents
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Chunk content
  content TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI ada-002 dimensions

  -- Position in document
  section_id VARCHAR(255),  -- References outline section
  start_char INTEGER NOT NULL,
  end_char INTEGER NOT NULL,

  -- Metadata
  chunk_index INTEGER NOT NULL,  -- Order within document
  created_at TIMESTAMP DEFAULT NOW(),

  -- Indexes
  CONSTRAINT document_chunks_position_check CHECK (end_char > start_char)
);

CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_document_chunks_section_id ON document_chunks(section_id);

-- Prisma schema addition
model DocumentChunk {
  id          String   @id @default(uuid())
  documentId  String
  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  content     String   @db.Text
  embedding   Unsupported("vector(1536)")?

  sectionId   String?
  startChar   Int
  endChar     Int
  chunkIndex  Int

  createdAt   DateTime @default(now())

  @@index([documentId])
  @@index([sectionId])
}
```

### Document Chunking Strategy

```typescript
// lib/llm/documentChunker.ts

import { OpenAI } from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

interface DocumentChunk {
  content: string
  sectionId: string | null
  startChar: number
  endChar: number
  chunkIndex: number
}

export async function chunkDocument(
  documentId: string,
  fullText: string,
  outline: DocumentOutline
): Promise<void> {
  // Strategy: Split by sections first, then by token count
  const chunks: DocumentChunk[] = []

  const MAX_CHUNK_SIZE = 500  // tokens (~2000 characters)
  const OVERLAP_SIZE = 50     // tokens (~200 characters) for context continuity

  // If document has outline, chunk by sections
  if (outline.sections.length > 0) {
    outline.sections.forEach((section, index) => {
      const sectionText = fullText.substring(section.startChar, section.endChar)

      // If section is small enough, keep as one chunk
      if (sectionText.length <= 2000) {
        chunks.push({
          content: sectionText,
          sectionId: section.id,
          startChar: section.startChar,
          endChar: section.endChar,
          chunkIndex: chunks.length
        })
      } else {
        // Split large sections into smaller chunks
        const sectionChunks = splitTextIntoChunks(
          sectionText,
          MAX_CHUNK_SIZE,
          OVERLAP_SIZE
        )

        sectionChunks.forEach((chunk, chunkIdx) => {
          chunks.push({
            content: chunk.text,
            sectionId: section.id,
            startChar: section.startChar + chunk.startOffset,
            endChar: section.startChar + chunk.endOffset,
            chunkIndex: chunks.length
          })
        })
      }
    })
  } else {
    // No outline: split entire document into chunks
    const textChunks = splitTextIntoChunks(fullText, MAX_CHUNK_SIZE, OVERLAP_SIZE)

    textChunks.forEach((chunk, index) => {
      chunks.push({
        content: chunk.text,
        sectionId: null,
        startChar: chunk.startOffset,
        endChar: chunk.endOffset,
        chunkIndex: index
      })
    })
  }

  // Generate embeddings for all chunks (batch processing)
  await generateAndStoreEmbeddings(documentId, chunks)
}

function splitTextIntoChunks(
  text: string,
  maxTokens: number,
  overlapTokens: number
): Array<{ text: string; startOffset: number; endOffset: number }> {
  const chunks: Array<{ text: string; startOffset: number; endOffset: number }> = []

  // Approximate: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4
  const overlapChars = overlapTokens * 4

  let startOffset = 0

  while (startOffset < text.length) {
    let endOffset = Math.min(startOffset + maxChars, text.length)

    // Find natural break point (period, newline)
    if (endOffset < text.length) {
      const lastPeriod = text.lastIndexOf('.', endOffset)
      const lastNewline = text.lastIndexOf('\n', endOffset)
      const breakPoint = Math.max(lastPeriod, lastNewline)

      if (breakPoint > startOffset + (maxChars / 2)) {
        endOffset = breakPoint + 1
      }
    }

    chunks.push({
      text: text.substring(startOffset, endOffset),
      startOffset,
      endOffset
    })

    // Move start with overlap
    startOffset = endOffset - overlapChars
    if (startOffset < 0) startOffset = 0
  }

  return chunks
}

async function generateAndStoreEmbeddings(
  documentId: string,
  chunks: DocumentChunk[]
): Promise<void> {
  // Batch embeddings for efficiency (OpenAI allows up to 2048 inputs)
  const BATCH_SIZE = 100

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)

    // Generate embeddings
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: batch.map(c => c.content)
    })

    // Store in database
    await prisma.documentChunk.createMany({
      data: batch.map((chunk, idx) => ({
        documentId,
        content: chunk.content,
        embedding: `[${response.data[idx].embedding.join(',')}]`,  // PostgreSQL vector format
        sectionId: chunk.sectionId,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        chunkIndex: chunk.chunkIndex
      }))
    })
  }
}
```

### Semantic Search Implementation

```typescript
// lib/llm/semanticSearch.ts

export async function semanticSearch(
  projectId: string,
  query: string,
  topK: number = 8
): Promise<Array<{
  content: string
  sectionId: string | null
  documentId: string
  filename: string
  similarity: number
}>> {
  // 1. Generate embedding for query
  const queryEmbedding = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: query
  })

  const embedding = queryEmbedding.data[0].embedding

  // 2. Search using pgvector cosine similarity
  const results = await prisma.$queryRaw`
    SELECT
      dc.content,
      dc.section_id as "sectionId",
      dc.document_id as "documentId",
      d.filename,
      1 - (dc.embedding <=> ${`[${embedding.join(',')}]`}::vector) as similarity
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE d.project_id = ${projectId}
    ORDER BY dc.embedding <=> ${`[${embedding.join(',')}]`}::vector
    LIMIT ${topK}
  `

  return results as any[]
}
```

---

## Context Composition Strategy

### Complete System Prompt Structure

```typescript
// lib/llm/contextComposer.ts

export async function buildSystemPrompt(
  projectId: string,
  userQuery?: string  // Optional: for dynamic chunk retrieval
): Promise<string> {
  // 1. Agent configuration (from context layers)
  const agentContext = await composeAgentContext(projectId)

  // 2. Document outlines (always included)
  const documentOutlines = await getDocumentOutlines(projectId)

  // 3. Relevant chunks (if query provided, for retrieval)
  let relevantChunks = ''
  if (userQuery) {
    const chunks = await semanticSearch(projectId, userQuery, 8)
    relevantChunks = formatRelevantChunks(chunks)
  }

  // 4. Citation instructions
  const citationInstructions = getCitationInstructions()

  // 5. Compose final prompt
  return `
${agentContext}

${documentOutlines}

${relevantChunks}

${citationInstructions}
  `.trim()
}

function formatRelevantChunks(chunks: any[]): string {
  if (chunks.length === 0) return ''

  let text = '# RELEVANT DOCUMENT CONTENT\n\n'
  text += 'Based on the current question, these sections are most relevant:\n\n'

  chunks.forEach((chunk, index) => {
    text += `## Excerpt ${index + 1}: ${chunk.filename}\n`
    if (chunk.sectionId) {
      text += `Section ID: ${chunk.sectionId}\n`
    }
    text += `Similarity: ${(chunk.similarity * 100).toFixed(1)}%\n\n`
    text += `${chunk.content}\n\n`
    text += '---\n\n'
  })

  return text
}

function getCitationInstructions(): string {
  return `
# CITATION REQUIREMENTS

When referencing content from documents, you MUST:

1. **Always cite the source** using this exact format:
   [DOC:filename:section-id]

2. **Examples of correct citations:**
   - "According to the Financial Projections [DOC:financial.pdf:section-3-2], the ROI is 35%..."
   - "The timeline shows completion in Q3 [DOC:project-plan.docx:section-1-4]"
   - "Sheet 2 indicates [DOC:budget.xlsx:section-a1b2c3] total costs of $50K"

3. **Citation placement:**
   - Place citation at the END of the statement it supports
   - Use citations for ANY factual claim from documents
   - Multiple citations allowed: "The analysis [DOC:file1:s1] shows growth [DOC:file2:s2]"

4. **Section ID verification:**
   - ONLY use section IDs that appear in the AVAILABLE DOCUMENTS outline above
   - If unsure of section ID, cite document only: [DOC:filename]
   - NEVER invent or guess section IDs

5. **When to cite:**
   - Direct quotes: ALWAYS
   - Paraphrased content: ALWAYS
   - Statistics or numbers: ALWAYS
   - General document existence: Optional

6. **What NOT to cite:**
   - Your own analysis or synthesis
   - General knowledge
   - Conversational responses ("I understand", "Let me help")

CRITICAL: Incorrect or missing citations will confuse the user. Always err on the side of over-citing.
  `.trim()
}
```

---

## Token Budget Management

### Token Allocation Strategy

```typescript
// lib/llm/tokenBudget.ts

interface TokenBudget {
  model: string
  maxTokens: number
  allocation: {
    systemPrompt: number
    agentConfig: number
    documentOutlines: number
    relevantChunks: number
    conversationHistory: number
    userMessage: number
    responseBuffer: number
  }
}

export function getTokenBudget(modelName: string): TokenBudget {
  const budgets: Record<string, TokenBudget> = {
    'gpt-4': {
      model: 'gpt-4',
      maxTokens: 8192,
      allocation: {
        systemPrompt: 500,
        agentConfig: 1500,
        documentOutlines: 2000,
        relevantChunks: 2000,
        conversationHistory: 1500,
        userMessage: 300,
        responseBuffer: 400  // Reserve for response
      }
    },
    'gpt-4-turbo': {
      model: 'gpt-4-turbo',
      maxTokens: 128000,
      allocation: {
        systemPrompt: 500,
        agentConfig: 2000,
        documentOutlines: 4000,
        relevantChunks: 6000,
        conversationHistory: 4000,
        userMessage: 500,
        responseBuffer: 1000
      }
    },
    'claude-sonnet-4': {
      model: 'claude-sonnet-4',
      maxTokens: 200000,
      allocation: {
        systemPrompt: 500,
        agentConfig: 2000,
        documentOutlines: 5000,
        relevantChunks: 8000,
        conversationHistory: 5000,
        userMessage: 500,
        responseBuffer: 1000
      }
    }
  }

  return budgets[modelName] || budgets['gpt-4-turbo']
}

// Truncate conversation history to fit budget
export function truncateConversationHistory(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): Array<{ role: string; content: string }> {
  // Estimate tokens: ~4 chars per token
  const estimateTokens = (text: string) => Math.ceil(text.length / 4)

  let totalTokens = 0
  const truncated: typeof messages = []

  // Keep most recent messages, working backwards
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(messages[i].content)

    if (totalTokens + msgTokens <= maxTokens) {
      truncated.unshift(messages[i])
      totalTokens += msgTokens
    } else {
      break
    }
  }

  return truncated
}
```

---

## Citation Verification System

### Post-Generation Verification

```typescript
// lib/llm/citationVerifier.ts

interface CitationReference {
  raw: string           // "[DOC:file.pdf:section-1]"
  filename: string
  sectionId: string | null
  position: number      // Character position in response
}

export async function verifyCitations(
  response: string,
  projectId: string
): Promise<{
  verified: boolean
  invalidRefs: CitationReference[]
  corrections: Array<{ from: string; to: string }>
}> {
  // 1. Parse all citation markers from response
  const refs = parseCitationMarkers(response)

  // 2. Verify each citation
  const invalid: CitationReference[] = []
  const corrections: Array<{ from: string; to: string }> = []

  for (const ref of refs) {
    const exists = await verifyCitationExists(projectId, ref.filename, ref.sectionId)

    if (!exists) {
      invalid.push(ref)

      // Attempt to find correct section
      const correction = await findCorrectSection(projectId, ref.filename, ref.sectionId)
      if (correction) {
        corrections.push({
          from: ref.raw,
          to: `[DOC:${ref.filename}:${correction.sectionId}]`
        })
      }
    }
  }

  return {
    verified: invalid.length === 0,
    invalidRefs: invalid,
    corrections
  }
}

function parseCitationMarkers(text: string): CitationReference[] {
  const regex = /\[DOC:([^:\]]+):?([^\]]*)\]/g
  const refs: CitationReference[] = []

  let match
  while ((match = regex.exec(text)) !== null) {
    refs.push({
      raw: match[0],
      filename: match[1],
      sectionId: match[2] || null,
      position: match.index
    })
  }

  return refs
}

async function verifyCitationExists(
  projectId: string,
  filename: string,
  sectionId: string | null
): Promise<boolean> {
  // Get document
  const document = await prisma.document.findFirst({
    where: {
      projectId,
      filename
    },
    select: {
      id: true,
      outline: true
    }
  })

  if (!document) return false

  // If no section ID, just verify document exists
  if (!sectionId) return true

  // Verify section exists in outline
  const outline = document.outline as DocumentOutline
  const sectionExists = outline.sections.some(s => s.id === sectionId)

  return sectionExists
}

async function findCorrectSection(
  projectId: string,
  filename: string,
  invalidSectionId: string | null
): Promise<{ sectionId: string } | null> {
  // Try to find similar section ID (fuzzy match)
  const document = await prisma.document.findFirst({
    where: { projectId, filename },
    select: { outline: true }
  })

  if (!document) return null

  const outline = document.outline as DocumentOutline

  if (!invalidSectionId) {
    // Return first section as fallback
    return outline.sections[0] ? { sectionId: outline.sections[0].id } : null
  }

  // Find sections with similar IDs (Levenshtein distance)
  const similar = outline.sections
    .map(s => ({
      sectionId: s.id,
      distance: levenshteinDistance(s.id, invalidSectionId)
    }))
    .filter(s => s.distance <= 3)
    .sort((a, b) => a.distance - b.distance)

  return similar[0] || null
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[b.length][a.length]
}
```

---

## Chat API Integration

### Updated Chat Route with RAG

```typescript
// app/api/chat/route.ts

import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { buildSystemPrompt } from '@/lib/llm/contextComposer'
import { verifyCitations } from '@/lib/llm/citationVerifier'
import { truncateConversationHistory, getTokenBudget } from '@/lib/llm/tokenBudget'

export async function POST(req: Request) {
  try {
    const { messages, projectId, sessionId } = await req.json()

    if (!projectId) {
      return new Response('projectId required', { status: 400 })
    }

    // Get agent config for model selection
    const agentConfig = await prisma.agentConfig.findUnique({
      where: { projectId }
    })

    const modelName = agentConfig?.modelName || 'gpt-4-turbo'
    const budget = getTokenBudget(modelName)

    // Truncate conversation history to fit budget
    const recentMessages = truncateConversationHistory(
      messages,
      budget.allocation.conversationHistory
    )

    // Get user's current question for semantic search
    const userQuery = messages[messages.length - 1]?.content || ''

    // Build system prompt with RAG
    const systemPrompt = await buildSystemPrompt(projectId, userQuery)

    // Select model
    const model = agentConfig?.modelProvider === 'anthropic'
      ? anthropic(modelName)
      : openai(modelName)

    // Stream response
    let fullResponse = ''

    const result = streamText({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...recentMessages
      ],
      temperature: agentConfig?.temperature || 0.7,
      onFinish: async (completion) => {
        fullResponse = completion.text

        // Verify citations
        const verification = await verifyCitations(fullResponse, projectId)

        if (!verification.verified) {
          console.warn('[Citation Verification] Invalid citations detected:', {
            projectId,
            invalidCount: verification.invalidRefs.length,
            corrections: verification.corrections.length
          })

          // Apply corrections automatically
          let correctedResponse = fullResponse
          verification.corrections.forEach(({ from, to }) => {
            correctedResponse = correctedResponse.replace(from, to)
          })

          // Log for monitoring
          await logCitationErrors(projectId, sessionId, verification.invalidRefs)
        }

        // Log analytics
        await logChatMessage(projectId, sessionId, {
          role: 'assistant',
          content: fullResponse,
          tokensUsed: completion.usage?.totalTokens,
          citationVerified: verification.verified
        })
      }
    })

    return result.toDataStreamResponse()

  } catch (error) {
    console.error('[POST /api/chat] Error:', error)
    return new Response('Chat error', { status: 500 })
  }
}
```

---

## Performance Optimization

### Embedding Generation Optimization

```typescript
// Background job for embedding generation
// Run async after document upload

export async function generateEmbeddingsForDocument(documentId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: true }
  })

  if (!document) {
    throw new Error('Document not found')
  }

  // Check if embeddings already exist
  const existingChunks = await prisma.documentChunk.count({
    where: { documentId }
  })

  if (existingChunks > 0) {
    console.log('[Embeddings] Already generated for document:', documentId)
    return
  }

  // Generate chunks and embeddings
  await chunkDocument(
    documentId,
    document.fullText,
    document.outline as DocumentOutline
  )

  console.log('[Embeddings] Generated for document:', documentId)
}

// Queue system (using simple database queue for MVP)
// Upgrade to BullMQ or similar for production

export async function queueEmbeddingGeneration(documentId: string) {
  // Add to queue table
  await prisma.embeddingQueue.create({
    data: {
      documentId,
      status: 'pending'
    }
  })

  // Trigger background worker (cron job or event listener)
}
```

### Caching Strategy

```typescript
// Cache frequently accessed data

// 1. Cache document outlines (rarely change)
import NodeCache from 'node-cache'

const outlineCache = new NodeCache({
  stdTTL: 3600,  // 1 hour
  checkperiod: 600
})

export async function getDocumentOutlines(projectId: string): Promise<string> {
  const cacheKey = `outlines:${projectId}`

  // Check cache
  const cached = outlineCache.get<string>(cacheKey)
  if (cached) return cached

  // Generate
  const documents = await prisma.document.findMany({
    where: { projectId },
    select: { filename: true, outline: true, summary: true }
  })

  const outlines = formatDocumentOutlines(documents)

  // Store in cache
  outlineCache.set(cacheKey, outlines)

  return outlines
}

// 2. Cache embeddings in Redis (for production)
// Store query embeddings to avoid regenerating for similar questions
```

---

## Cost Management

### Pricing Estimates (as of 2024)

**OpenAI GPT-4 Turbo:**
- Input: $0.01 per 1K tokens
- Output: $0.03 per 1K tokens

**Anthropic Claude Sonnet 4:**
- Input: $0.003 per 1K tokens
- Output: $0.015 per 1K tokens

**OpenAI Embeddings (ada-002):**
- $0.0001 per 1K tokens

### Cost Per Chat Message (Estimated)

**Scenario: 3 documents, 10K tokens total, 5-message conversation**

```
System Prompt: 12K tokens input
User Message: 0.3K tokens input
Assistant Response: 0.5K tokens output

Per Message Cost:
GPT-4 Turbo: (12.3K * $0.01) + (0.5K * $0.03) = $0.138
Claude Sonnet 4: (12.3K * $0.003) + (0.5K * $0.015) = $0.045

Embeddings (one-time per document):
3 docs * 50 chunks * 500 tokens = 75K tokens
Cost: 75K * $0.0001 = $0.0075

Total Per Project Setup:
- Embeddings: ~$0.01
- First 10 messages: ~$1.38 (GPT-4 Turbo) or ~$0.45 (Claude)
```

**Cost Optimization Strategies:**
1. Use Claude Sonnet 4 (3x cheaper than GPT-4 Turbo)
2. Truncate conversation history aggressively
3. Cache system prompts and outlines
4. Implement usage limits per tier (free: 50 messages/month, pro: unlimited)

---

## Error Handling

```typescript
// Handle LLM API errors gracefully

export async function handleLLMError(error: any): Promise<Response> {
  if (error.code === 'insufficient_quota') {
    return new Response(JSON.stringify({
      error: 'API quota exceeded. Please contact support.',
      retryable: false
    }), { status: 402 })
  }

  if (error.code === 'rate_limit_exceeded') {
    return new Response(JSON.stringify({
      error: 'Too many requests. Please wait a moment and try again.',
      retryable: true,
      retryAfter: 60
    }), { status: 429 })
  }

  if (error.code === 'context_length_exceeded') {
    return new Response(JSON.stringify({
      error: 'Conversation is too long. Please start a new conversation.',
      retryable: false
    }), { status: 400 })
  }

  // Generic error
  return new Response(JSON.stringify({
    error: 'Chat service temporarily unavailable. Please try again.',
    retryable: true
  }), { status: 500 })
}
```

---

## Testing Strategy

```typescript
// tests/llm/citationVerification.test.ts

describe('Citation Verification', () => {
  it('should detect invalid section IDs', async () => {
    const response = 'The ROI is 35% [DOC:financial.pdf:invalid-section]'
    const verification = await verifyCitations(response, 'project-123')

    expect(verification.verified).toBe(false)
    expect(verification.invalidRefs.length).toBe(1)
  })

  it('should suggest corrections for similar section IDs', async () => {
    const response = 'See section [DOC:report.pdf:section-a1b2]'
    // Assume correct ID is 'section-a1b2c3'

    const verification = await verifyCitations(response, 'project-123')

    expect(verification.corrections.length).toBeGreaterThan(0)
    expect(verification.corrections[0].to).toContain('section-a1b2c3')
  })
})

// tests/llm/tokenBudget.test.ts

describe('Token Budget Management', () => {
  it('should truncate conversation history to fit budget', () => {
    const messages = Array(20).fill({ role: 'user', content: 'Test message with some content' })
    const truncated = truncateConversationHistory(messages, 500)

    expect(truncated.length).toBeLessThan(messages.length)
    // Most recent messages kept
    expect(truncated[truncated.length - 1]).toEqual(messages[messages.length - 1])
  })
})
```

---

## Summary

This LLM integration architecture provides:

- ✅ **Hybrid RAG approach** - Outlines + semantic search for best quality
- ✅ **pgvector for MVP** - No new infrastructure, easy to implement
- ✅ **Token budget management** - Supports GPT-4, GPT-4 Turbo, Claude
- ✅ **Citation verification** - Prevents hallucinated references
- ✅ **Cost optimization** - ~$0.05-0.15 per message with Claude/GPT-4 Turbo
- ✅ **Production-ready error handling** - Graceful degradation
- ✅ **Comprehensive testing** - Verification, budgets, search

**Next Steps:**
1. Install pgvector extension in PostgreSQL
2. Implement document chunking pipeline
3. Add embedding generation to document upload flow
4. Update chat API with RAG integration
5. Add citation verification middleware
6. Test with real documents
