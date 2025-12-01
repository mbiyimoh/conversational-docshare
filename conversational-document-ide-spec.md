# Conversational Document IDE - Project Specification

**📊 COMPANION DOCUMENT**: This specification works in tandem with the [User Journey Flows](user-journey-flows.xlsx) spreadsheet, which maps all user types, phases, and interactions. Reference specific flows and phases throughout this document.

## Executive Summary

A chat-first document sharing platform that creates personalized AI agents to represent document collections. Users upload documents, configure an AI representative through an interactive interview process, and share with recipients who interact with documents through natural conversation. The platform features an IDE-like interface optimized for professional document sharing with board members, investors, and stakeholders.

**Key Differentiator**: AI agent onboarding system that transforms static document sets into intelligent, conversational experiences customized for specific audiences and communication styles.

---

## Product Vision

**📊 See User Journey Flow 1 (Document Creator) in companion spreadsheet**

### Core Use Case
A consultant creates an IP framework documentation set and needs to share it with their board and investors. Instead of hoping they read everything, they upload documents to the platform (Phase 2), configure an AI representative through a guided interview (Phase 4), and share a link (Phase 6). Recipients engage in natural conversation (Phase 8) with an AI that knows the documents intimately and communicates in the exact tone and style the consultant specified.

**End-to-End Timeline**: 30-45 minutes from sign-up to first share (see Flow 1 in User Journey Flows sheet)

### User Types
**📊 See User Journeys Matrix sheet for complete interaction map**

1. **Document Creators** (primary): Consultants, founders, executives who need to share complex document sets
   - Journey: Discovery → Upload → Configure → Share → Monitor → Iterate
   - Key phases: 1-6, 10-12
   
2. **Document Viewers** (secondary): Board members, investors, clients, stakeholders who need to understand shared content
   - Journey: Access → Engage → (Optional) Convert
   - Key phases: 7-9
   
3. **Platform Users** (future): Anyone wanting to create their own conversational document experiences
   - Journey: Viewer → Converter → Creator
   - Key phases: All phases

---

## Existing System Integration

**This project builds on a proven LLM architecture** with context layers and knowledge management. See `context-and-knowledge-LLM-synthesis.md` for the complete foundational system.

### Core Architecture We're Reusing

**From Existing System:**
- Multi-layer context composition (Vercel AI SDK)
- PostgreSQL + Prisma ORM
- Priority-based context layer ordering
- Knowledge file storage in database
- Streaming chat with `useChat` hook
- Context caching and graceful degradation

**What We're Extending:**
- Multi-tenant user model (multiple creators)
- Agent configuration via interview → context layers
- Document-centric knowledge (vs. general knowledge)
- Share-link specific configurations
- Document outline extraction and section mapping
- Viewer conversation tracking and analytics

### Enhanced Database Schema

Building on the existing Project/ContextLayer/KnowledgeFile pattern:

```prisma
// prisma/schema.prisma

// ============================================================================
// USER & AUTHENTICATION
// ============================================================================

model User {
  id                String        @id @default(cuid())
  email             String        @unique
  name              String?
  passwordHash      String?       // Optional: for email/password auth
  
  // OAuth fields (optional)
  oauthProvider     String?       // "google", "github", etc.
  oauthId           String?
  
  // User type
  role              String        @default("creator")  // "creator", "viewer", "admin"
  
  // Owned projects
  projects          Project[]
  
  // Saved conversations (when viewer creates account)
  savedConversations Conversation[]
  
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  
  @@index([email])
}

// ============================================================================
// PROJECTS & DOCUMENTS
// ============================================================================

model Project {
  id              String           @id @default(cuid())
  ownerId         String
  owner           User             @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  
  name            String
  description     String?
  
  // Documents in this project
  documents       Document[]
  
  // Agent configuration (from interview)
  agentConfig     AgentConfig?
  
  // Context layers (from interview responses)
  contextLayers   ContextLayer[]
  
  // Share links for this project
  shareLinks      ShareLink[]
  
  // Analytics
  totalViews      Int              @default(0)
  totalConversations Int           @default(0)
  
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  
  @@index([ownerId])
}

model Document {
  id              String   @id @default(cuid())
  projectId       String
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // File metadata
  filename        String
  filepath        String          // Path in storage (file system or S3)
  filetype        String          // "pdf", "docx", "xlsx", "md"
  filesize        Int             // Bytes
  
  // Extracted content (stored in DB for fast retrieval)
  fullText        String   @db.Text
  
  // Document structure for navigation
  outline         Json            // { sections: [{ id: string, title: string, level: number, pageNum?: number, startChar: number, endChar: number }] }
  
  // Analysis results (from initial upload)
  summary         String?  @db.Text
  keyTopics       String[] // Extracted topics
  
  uploadedAt      DateTime @default(now())
  
  @@index([projectId])
  @@index([projectId, filetype])
}

// ============================================================================
// AGENT CONFIGURATION (From Interview Process)
// ============================================================================

model AgentConfig {
  id              String   @id @default(cuid())
  projectId       String   @unique
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Analysis summary (Phase 3)
  analysisSummary String   @db.Text
  
  // Interview responses (Phase 4) - stored as structured data
  interviewData   Json     // Complete interview responses
  
  // Compiled configuration
  configJson      Json     // Structured agent configuration
  /*
  {
    "audience": {
      "primary": "board_members",
      "expertiseLevel": "business_executive",
      "relationship": "advisory"
    },
    "communication": {
      "tone": "professional_approachable",
      "formalityLevel": 7,
      "useExamples": true,
      "referenceStyle": "precise_citations"
    },
    "content": {
      "emphasisAreas": ["ROI projections", "risk mitigation"],
      "sensitiveTopics": ["competitive analysis"],
      "speculationAllowed": false,
      "contextBoundaries": "strict"
    },
    "engagement": {
      "proactiveQuestions": ["How does this align with Q3?"],
      "suggestedActions": ["Schedule follow-up meeting"]
    }
  }
  */
  
  // Model selection
  modelProvider   String   @default("openai")  // "openai", "anthropic"
  modelName       String   @default("gpt-4")   // "gpt-4", "claude-sonnet-4", etc.
  temperature     Float    @default(0.7)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model ContextLayer {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Layer identity
  name        String              // e.g., "Audience Profile"
  category    String              // "audience", "communication", "content", "engagement"
  description String?
  priority    Int                 // 1 = first, lower numbers = higher priority
  
  // Content (generated from interview)
  content     String   @db.Text
  
  // Metadata from interview
  metadata    Json?               // Original interview responses for this category
  
  // Layer behavior
  isActive    Boolean  @default(true)   // Can be toggled without deletion
  isBuiltIn   Boolean  @default(false)  // Protect system layers
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([projectId, priority])
  @@index([projectId, isActive])
  @@index([projectId, category])
}

// ============================================================================
// SHARING & ACCESS CONTROL
// ============================================================================

model ShareLink {
  id              String   @id @default(cuid())
  projectId       String
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  shareCode       String   @unique         // Used in URL: /s/{shareCode}
  
  // Access control
  accessType      String                   // "public_password", "email_required", "whitelist"
  password        String?                  // Optional password for access
  whitelist       String[]                 // Allowed email addresses
  
  // Expiration
  expiresAt       DateTime?
  maxViews        Int?                     // Optional view limit
  currentViews    Int      @default(0)
  
  // Future: Share-specific agent config overrides
  customContext   Json?                    // Not implemented in MVP
  /*
  Future feature: Override base agent config for specific audiences
  Example: {
    "emphasisAreas": ["technical_implementation", "architecture"],
    "tone": "technical_detailed"
  }
  */
  
  // Analytics
  accessLogs      AccessLog[]
  conversations   Conversation[]
  
  createdAt       DateTime @default(now())
  
  @@index([projectId])
  @@index([shareCode])
  @@index([expiresAt])
}

model AccessLog {
  id              String    @id @default(cuid())
  shareLinkId     String
  shareLink       ShareLink @relation(fields: [shareLinkId], references: [id], onDelete: Cascade)
  
  viewerEmail     String?               // If email was required
  viewerIp        String?
  sessionId       String                // Unique per viewing session
  
  // Geographic data (optional)
  country         String?
  city            String?
  
  accessedAt      DateTime  @default(now())
  
  @@index([shareLinkId])
  @@index([sessionId])
  @@index([accessedAt])
}

// ============================================================================
// CONVERSATIONS & ANALYTICS
// ============================================================================

model Conversation {
  id              String    @id @default(cuid())
  projectId       String
  shareLinkId     String
  shareLink       ShareLink @relation(fields: [shareLinkId], references: [id], onDelete: Cascade)
  
  // Session identification
  sessionId       String                // Links to AccessLog
  viewerEmail     String?               // If provided during access
  
  // Saved by user (optional)
  userId          String?               // If viewer created account and saved
  user            User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  // Conversation data
  messages        Json                  // Array of message objects
  /*
  [
    { role: "assistant", content: "Hi! How can I help...", timestamp: "..." },
    { role: "user", content: "What's the ROI?", timestamp: "..." },
    { role: "assistant", content: "According to...", timestamp: "..." }
  ]
  */
  
  // Analytics
  duration        Int?                  // Seconds
  messageCount    Int       @default(0)
  documentsViewed String[]              // Array of document IDs
  
  // AI-generated summary (for creator)
  summary         String?   @db.Text
  keyTopics       String[]              // Topics discussed
  questions       String[]              // Questions asked
  sentiment       String?               // "positive", "neutral", "concerned"
  actionItems     String[]              // Suggested follow-ups
  
  createdAt       DateTime  @default(now())
  savedAt         DateTime?             // When user saved to account
  
  @@index([shareLinkId])
  @@index([sessionId])
  @@index([userId])
  @@index([createdAt])
}

model AnalyticsEvent {
  id              String    @id @default(cuid())
  conversationId  String
  
  eventType       String                // "document_opened", "section_viewed", "message_sent"
  eventData       Json                  // Event-specific data
  /*
  Examples:
  - document_opened: { documentId: "...", filename: "..." }
  - section_viewed: { documentId: "...", sectionId: "...", sectionTitle: "..." }
  - message_sent: { messageLength: 150, tokensUsed: 200 }
  */
  
  timestamp       DateTime  @default(now())
  
  @@index([conversationId])
  @@index([eventType])
  @@index([timestamp])
}
```

### Context Layer Categories

Interview responses map to four context layer categories:

**1. Audience (`category: "audience"`)**
- Primary audience type (board members, investors, technical team)
- Expertise level
- Relationship dynamic (formal, advisory, collaborative)
- Anticipated questions

**2. Communication (`category: "communication"`)**
- Tone (professional, casual, technical)
- Formality level (1-10 scale)
- Use of examples and analogies
- Citation style (precise, general, informal)

**3. Content (`category: "content"`)**
- Emphasis areas (what to highlight)
- Sensitive topics (handle carefully)
- Speculation allowed (yes/no)
- Context boundaries (strict adherence to docs vs. broader inferences)

**4. Engagement (`category: "engagement"`)**
- Proactive questions to ask viewers
- Suggested follow-up actions
- Interactive vs. passive style

### Context Composition Logic

Adapted from existing system, enhanced for agent configuration:

```typescript
// lib/contextComposer.ts
import { prisma } from './db'

const DEFAULT_CONTEXT = `
You are a helpful AI assistant representing a document collection.
Provide accurate responses based on the provided documents.
When referencing content, cite specific sections using the format: [DOC:filename:section-id]
`.trim()

export async function composeAgentContext(
  projectId: string,
  options?: {
    includeCategories?: string[]  // Filter by category
    shareLinkId?: string          // Future: share-specific overrides
  }
): Promise<string> {
  try {
    // 1. Fetch agent configuration
    const agentConfig = await prisma.agentConfig.findUnique({
      where: { projectId }
    })
    
    if (!agentConfig) {
      console.warn('[composeAgentContext] No agent config found, using default')
      return DEFAULT_CONTEXT
    }
    
    // 2. Fetch active context layers, ordered by priority
    const layers = await prisma.contextLayer.findMany({
      where: {
        projectId,
        isActive: true,
        ...(options?.includeCategories && {
          category: { in: options.includeCategories }
        })
      },
      orderBy: { priority: 'asc' }
    })
    
    if (layers.length === 0) {
      return DEFAULT_CONTEXT
    }
    
    // 3. Build structured system prompt
    let prompt = '# AI AGENT CONFIGURATION\n\n'
    prompt += 'You are an AI representative for a document collection. '
    prompt += 'Your behavior is configured based on the following layers:\n\n'
    
    // Add layers by category
    const categorizedLayers = {
      audience: layers.filter(l => l.category === 'audience'),
      communication: layers.filter(l => l.category === 'communication'),
      content: layers.filter(l => l.category === 'content'),
      engagement: layers.filter(l => l.category === 'engagement')
    }
    
    for (const [category, categoryLayers] of Object.entries(categorizedLayers)) {
      if (categoryLayers.length === 0) continue
      
      prompt += `## ${category.toUpperCase()} CONFIGURATION\n\n`
      categoryLayers.forEach(layer => {
        prompt += `### ${layer.name}\n\n`
        prompt += `${layer.content}\n\n`
      })
      prompt += '---\n\n'
    }
    
    // 4. Add document reference instructions
    prompt += '## DOCUMENT REFERENCING\n\n'
    prompt += 'When citing content from documents:\n'
    prompt += '1. Always cite the specific document and section\n'
    prompt += '2. Use the format: [DOC:filename:section-id] after your statement\n'
    prompt += '3. Example: "The projected ROI is 35% over 18 months [DOC:financial.pdf:section-3-2]"\n'
    prompt += '4. The frontend will automatically open and highlight the referenced section\n\n'
    
    // 5. Add behavioral guidelines
    prompt += '## BEHAVIORAL GUIDELINES\n\n'
    const config = agentConfig.configJson as any
    
    if (config.content?.speculationAllowed === false) {
      prompt += '- CRITICAL: Only provide information explicitly stated in the documents\n'
      prompt += '- Do not make inferences or speculate beyond document content\n'
      prompt += '- If asked about something not in documents, politely state you can only address documented content\n\n'
    }
    
    if (config.engagement?.proactiveQuestions?.length > 0) {
      prompt += '- Proactively ask relevant questions to guide the conversation:\n'
      config.engagement.proactiveQuestions.forEach((q: string) => {
        prompt += `  - "${q}"\n`
      })
      prompt += '\n'
    }
    
    prompt += 'Always maintain the communication style and emphasis areas specified above.\n'
    
    return prompt
    
  } catch (error) {
    console.error('[composeAgentContext] Error:', error)
    return DEFAULT_CONTEXT
  }
}

// Get document outlines for LLM context
export async function getDocumentOutlines(projectId: string): Promise<string> {
  const documents = await prisma.document.findMany({
    where: { projectId },
    select: { filename: true, outline: true, summary: true }
  })
  
  if (documents.length === 0) {
    return 'No documents available.'
  }
  
  let outlinesText = '# AVAILABLE DOCUMENTS\n\n'
  
  documents.forEach(doc => {
    outlinesText += `## ${doc.filename}\n\n`
    
    if (doc.summary) {
      outlinesText += `Summary: ${doc.summary}\n\n`
    }
    
    const outline = doc.outline as any
    if (outline?.sections) {
      outlinesText += 'Sections:\n'
      outline.sections.forEach((section: any) => {
        const indent = '  '.repeat(section.level - 1)
        outlinesText += `${indent}- ${section.title} [section-id: ${section.id}]\n`
      })
      outlinesText += '\n'
    }
  })
  
  return outlinesText
}

// Complete system prompt for chat
export async function buildSystemPrompt(projectId: string): Promise<string> {
  const agentContext = await composeAgentContext(projectId)
  const documentOutlines = await getDocumentOutlines(projectId)
  
  return `${agentContext}\n\n${documentOutlines}`
}
```

### Interview to Context Layer Mapping

**Phase 4: Agent Configuration Interview** generates context layers:

```typescript
// lib/interviewProcessor.ts

interface InterviewResponses {
  // Essential questions
  primaryAudience: string
  communicationStyle: string
  emphasisAreas: string[]
  speculationAllowed: boolean
  mainPurpose: string
  
  // Deep dive questions (optional)
  anticipatedQuestions?: string[]
  expertiseLevel?: string
  sensitivTopics?: string[]
  suggestedActions?: string[]
  proactiveQuestions?: string[]
  relationshipDynamic?: string
}

export async function createContextLayersFromInterview(
  projectId: string,
  responses: InterviewResponses
): Promise<void> {
  // 1. Create Audience layer
  await prisma.contextLayer.create({
    data: {
      projectId,
      name: 'Audience Profile',
      category: 'audience',
      priority: 1,
      content: `
Primary Audience: ${responses.primaryAudience}
Expertise Level: ${responses.expertiseLevel || 'general'}
Relationship: ${responses.relationshipDynamic || 'professional'}

${responses.anticipatedQuestions ? `
Anticipated Questions:
${responses.anticipatedQuestions.map(q => `- ${q}`).join('\n')}
` : ''}
      `.trim(),
      metadata: {
        primaryAudience: responses.primaryAudience,
        expertiseLevel: responses.expertiseLevel,
        relationshipDynamic: responses.relationshipDynamic
      }
    }
  })
  
  // 2. Create Communication layer
  await prisma.contextLayer.create({
    data: {
      projectId,
      name: 'Communication Style',
      category: 'communication',
      priority: 2,
      content: `
Tone: ${responses.communicationStyle}
Style: ${responses.communicationStyle === 'professional' ? 'Business-focused, clear, and direct' : 'Conversational and approachable'}

Citation Style: Always cite specific document sections
Use concrete examples when explaining concepts
      `.trim(),
      metadata: {
        tone: responses.communicationStyle
      }
    }
  })
  
  // 3. Create Content layer
  await prisma.contextLayer.create({
    data: {
      projectId,
      name: 'Content Strategy',
      category: 'content',
      priority: 3,
      content: `
Main Purpose: ${responses.mainPurpose}

Emphasis Areas:
${responses.emphasisAreas.map(area => `- ${area}`).join('\n')}

Speculation: ${responses.speculationAllowed ? 'Allowed with clear disclaimers' : 'Not allowed - stick to documented facts only'}

${responses.sensitivTopics ? `
Sensitive Topics (handle carefully):
${responses.sensitivTopics.map(t => `- ${t}`).join('\n')}
` : ''}
      `.trim(),
      metadata: {
        emphasisAreas: responses.emphasisAreas,
        speculationAllowed: responses.speculationAllowed,
        sensitivTopics: responses.sensitivTopics
      }
    }
  })
  
  // 4. Create Engagement layer (if proactive)
  if (responses.proactiveQuestions || responses.suggestedActions) {
    await prisma.contextLayer.create({
      data: {
        projectId,
        name: 'Engagement Strategy',
        category: 'engagement',
        priority: 4,
        content: `
${responses.proactiveQuestions ? `
Proactive Questions to Guide Conversation:
${responses.proactiveQuestions.map(q => `- "${q}"`).join('\n')}
` : ''}

${responses.suggestedActions ? `
Suggested Follow-up Actions:
${responses.suggestedActions.map(a => `- ${a}`).join('\n')}
` : ''}
        `.trim(),
        metadata: {
          proactiveQuestions: responses.proactiveQuestions,
          suggestedActions: responses.suggestedActions
        }
      }
    })
  }
}
```

### Document Processing & Knowledge Storage

**Phase 2-3: Document Upload & Analysis**

```typescript
// lib/documentProcessor.ts
import { PDFExtract } from 'pdf.js-extract'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

interface DocumentOutline {
  sections: Array<{
    id: string
    title: string
    level: number
    pageNum?: number
    startChar: number
    endChar: number
  }>
}

export async function processDocument(
  projectId: string,
  file: File
): Promise<void> {
  const filename = file.name
  const filetype = filename.split('.').pop()?.toLowerCase() || ''
  
  let fullText = ''
  let outline: DocumentOutline = { sections: [] }
  
  // Extract based on file type
  switch (filetype) {
    case 'pdf':
      ({ fullText, outline } = await extractFromPDF(file))
      break
    case 'docx':
      ({ fullText, outline } = await extractFromDOCX(file))
      break
    case 'xlsx':
      fullText = await extractFromXLSX(file)
      outline = { sections: [] } // Spreadsheets don't have traditional outlines
      break
    case 'md':
      ({ fullText, outline } = await extractFromMarkdown(file))
      break
    default:
      throw new Error(`Unsupported file type: ${filetype}`)
  }
  
  // Generate AI summary
  const summary = await generateDocumentSummary(fullText)
  const keyTopics = await extractKeyTopics(fullText)
  
  // Store in database
  await prisma.document.create({
    data: {
      projectId,
      filename,
      filepath: `/documents/${projectId}/${filename}`, // Store path
      filetype,
      filesize: file.size,
      fullText,
      outline,
      summary,
      keyTopics
    }
  })
}

async function extractFromPDF(file: File): Promise<{ fullText: string; outline: DocumentOutline }> {
  // Use pdf-parse or pdf.js-extract
  // Extract text and identify headings by font size/style
  // Return structured outline
  // Implementation details in Phase 1
  return { fullText: '', outline: { sections: [] } }
}

async function extractFromDOCX(file: File): Promise<{ fullText: string; outline: DocumentOutline }> {
  // Use mammoth.js which preserves heading structure
  const result = await mammoth.extractRawText({ buffer: await file.arrayBuffer() })
  
  // Parse headings from HTML structure
  // Mammoth provides heading levels natively
  
  return { fullText: result.value, outline: { sections: [] } }
}

async function generateDocumentSummary(text: string): Promise<string> {
  // Use LLM to generate concise summary
  // Truncate text if too long (use first 10k chars)
  return '' // Implementation in Phase 1
}
```

### Chat API Integration

**Phase 8: Viewer Conversation**

```typescript
// app/api/chat/route.ts
import { streamText, convertToCoreMessages } from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { buildSystemPrompt } from '@/lib/contextComposer'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { 
      messages: uiMessages, 
      projectId,
      sessionId 
    } = await req.json()
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId required' }, 
        { status: 400 }
      )
    }
    
    // 1. Compose system prompt from context layers + document outlines
    const systemPrompt = await buildSystemPrompt(projectId)
    
    // 2. Get agent config for model selection
    const agentConfig = await prisma.agentConfig.findUnique({
      where: { projectId }
    })
    
    // 3. Select appropriate model
    const model = agentConfig?.modelProvider === 'anthropic'
      ? anthropic(agentConfig.modelName || 'claude-sonnet-4-20250514')
      : openai(agentConfig?.modelName || 'gpt-4')
    
    // 4. Convert messages and stream
    const coreMessages = convertToCoreMessages(uiMessages || [])
    
    const result = streamText({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...coreMessages
      ],
      temperature: agentConfig?.temperature || 0.7,
      onFinish: async (result) => {
        // Log analytics event
        await logChatMessage(projectId, sessionId, {
          role: 'assistant',
          content: result.text,
          tokensUsed: result.usage?.totalTokens
        })
      }
    })
    
    return result.toUIMessageStreamResponse()
    
  } catch (error) {
    console.error('[POST /api/chat] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat' }, 
      { status: 500 }
    )
  }
}

async function logChatMessage(
  projectId: string, 
  sessionId: string, 
  message: any
) {
  // Find or create conversation
  // Log message
  // Update analytics
  // Implementation in Phase 1
}
```

### Key Differences from Base System

| Aspect | Base System | This Project |
|--------|-------------|--------------|
| **User Model** | Single project owner | Multi-tenant with creators & viewers |
| **Context Editing** | User edits directly | Creator configures via interview, viewers read-only |
| **Knowledge Source** | General knowledge files | Document-specific with extraction & outlines |
| **Context Purpose** | General AI behavior | Agent persona for specific audience |
| **Sharing** | N/A | Share links with access control |
| **Analytics** | N/A | Conversation tracking & summaries |

### Future Enhancement: Share-Link Context Override

**Not in MVP, documented for future:**

```typescript
// Future feature: Override agent config per share link
model ShareLink {
  // ... existing fields ...
  
  customContext   Json?
  /*
  Example: Share same docs with different emphasis
  
  Board share link:
  {
    "contentOverrides": {
      "emphasisAreas": ["ROI", "risk mitigation", "timeline"]
    }
  }
  
  Technical team share link:
  {
    "contentOverrides": {
      "emphasisAreas": ["implementation", "architecture", "technical debt"]
    },
    "communicationOverrides": {
      "tone": "technical_detailed"
    }
  }
  */
}
```

To implement this later:
1. Check if `shareLink.customContext` exists in `composeAgentContext()`
2. Merge overrides with base agent config
3. Generate modified context layers on-the-fly
4. No DB changes needed, just composition logic

---

## Technical Architecture

### System Overview

**Multi-Tenant B2B SaaS Architecture**
- Frontend: React/Vite web application
- Backend: Express.js API + existing LLM system (Vercel AI SDK with swappable models)
- Storage: File system with document metadata
- Database: PostgreSQL for user accounts, projects, permissions, analytics
- Deployment: Docker Compose (frontend container, backend container, document storage volume)

### Frontend Architecture: Chat-First IDE Layout

**Layout Inspired by**: Cursor IDE, Claude.ai artifacts panel, VS Code

**Primary Panels**:
1. **Main Chat Panel** (60-70% width)
   - Conversational interface with AI agent
   - Message history
   - Input area with document upload capability
   - Markdown rendering for AI responses

2. **Document Viewer Panel** (30-40% width)
   - Multi-tab document rendering
   - Each document type gets appropriate renderer:
     - **PDF**: PDF.js
     - **Word**: Mammoth.js
     - **Excel**: SheetJS
     - **Markdown**: Native rendering
   - Synchronized highlighting when chat references sections
   - Auto-scroll to referenced sections
   - Tab management (open multiple, switch between)

3. **File Explorer Sidebar** (collapsible, ~200px)
   - Tree view of document collection
   - Click to open in viewer panel
   - Visual indicators for document type
   - Search/filter functionality

**Layout Framework**: Monaco Editor base architecture or React with Golden Layout/React Grid Layout for docking panels

**Responsive Design**: 
- Desktop: Full three-panel layout
- Tablet: Collapsible sidebar, panel switching
- Mobile: Single panel focus with modal document viewing

### Backend Architecture

**Express.js REST API** with the following endpoints:

**Authentication & User Management**:
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Authenticate
- `GET /api/auth/me` - Current user info

**Project Management** (Document Creators):
- `POST /api/projects` - Create new project
- `GET /api/projects` - List user's projects
- `PUT /api/projects/:id` - Update project settings
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/documents` - Upload documents
- `DELETE /api/projects/:id/documents/:docId` - Remove document

**AI Agent Configuration**:
- `POST /api/projects/:id/analyze` - Trigger document analysis
- `GET /api/projects/:id/analysis` - Get analysis results
- `POST /api/projects/:id/context-interview` - Submit interview responses
- `GET /api/projects/:id/agent-config` - Get configured agent context

**Sharing & Access**:
- `POST /api/projects/:id/share` - Generate share link with permissions
- `GET /api/share/:shareId` - Access shared project (validates permissions)
- `POST /api/share/:shareId/access` - Log access attempt (email gating)

**Chat & Conversation**:
- `POST /api/chat/:projectId/message` - Send message to AI agent
- `GET /api/chat/:projectId/history` - Get conversation history
- `POST /api/chat/:projectId/save` - Save conversation (requires account)
- `GET /api/conversations` - List user's saved conversations

**Analytics & Reporting**:
- `GET /api/projects/:id/analytics` - View engagement metrics
- `GET /api/projects/:id/conversations` - List all viewer conversations
- `GET /api/projects/:id/summaries` - Get AI-generated summaries

**Document Processing**:
- `GET /api/documents/:id/render` - Serve document with appropriate renderer
- `GET /api/documents/:id/extract` - Extract text/metadata
- `GET /api/documents/:id/outline` - Get document structure (headings, TOC)

### Database Schema

**Users Table**:
```sql
users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  name VARCHAR,
  created_at TIMESTAMP,
  subscription_tier VARCHAR
)
```

**Projects Table**:
```sql
projects (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES users(id),
  name VARCHAR NOT NULL,
  description TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Documents Table**:
```sql
documents (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  filename VARCHAR NOT NULL,
  file_path VARCHAR NOT NULL,
  file_type VARCHAR NOT NULL,
  file_size INTEGER,
  outline JSONB, -- extracted headings/structure
  uploaded_at TIMESTAMP
)
```

**Agent Configurations Table**:
```sql
agent_configs (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  analysis_summary TEXT,
  context_data JSONB, -- all interview responses
  created_at TIMESTAMP
)
```

**Share Links Table**:
```sql
share_links (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  share_code VARCHAR UNIQUE NOT NULL,
  password VARCHAR, -- optional project password
  access_type VARCHAR NOT NULL, -- 'public', 'email_required', 'whitelist'
  whitelist JSONB, -- array of allowed emails
  expires_at TIMESTAMP,
  created_at TIMESTAMP
)
```

**Access Logs Table**:
```sql
access_logs (
  id UUID PRIMARY KEY,
  share_link_id UUID REFERENCES share_links(id),
  viewer_email VARCHAR,
  viewer_ip VARCHAR,
  accessed_at TIMESTAMP,
  session_id VARCHAR
)
```

**Conversations Table**:
```sql
conversations (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  share_link_id UUID REFERENCES share_links(id),
  session_id VARCHAR NOT NULL,
  viewer_email VARCHAR,
  user_id UUID REFERENCES users(id), -- if saved to account
  messages JSONB NOT NULL,
  summary TEXT,
  created_at TIMESTAMP,
  saved_at TIMESTAMP
)
```

**Analytics Events Table**:
```sql
analytics_events (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  event_type VARCHAR NOT NULL, -- 'document_opened', 'section_viewed', 'message_sent'
  event_data JSONB,
  timestamp TIMESTAMP
)
```

---

## Core Features & Workflows

### 1. AI Agent Onboarding System

**📊 Corresponds to Phases 2-5 in User Journey Matrix | See Flow 1 detailed breakdown**

**Goal**: Transform document uploads into personalized AI representatives through guided configuration.

**Workflow**:

**Step 1: Document Upload & Analysis (Phase 2-3: 4-7 minutes)**
**📊 Creator Journey Phase 2-3 | 95% completion rate**

1. User creates new project, uploads documents (PDF, DOCX, XLSX, MD)
2. System triggers automatic analysis:
   - Extract text from all documents using:
     - **pdf-parse** for PDFs
     - **Mammoth.js** for Word docs
     - **SheetJS** for spreadsheets
     - Native parsing for markdown
   - Generate document summaries using LLM
   - Extract document structure (headings, sections, key topics)
   - Identify document relationships and dependencies
   - Store in knowledge layer

**Step 2: Context Interview - Progressive Questioning (Phase 4: 10-15 minutes)**
**📊 Creator Journey Phase 4 | 90% completion rate for essentials | 40% complete deep dive**

LLM conducts interview to build agent configuration. Questions are prioritized - critical ones first, then progressively deeper.

**Essential Questions (Quick Path - 5 minutes | 80% of creators stop here)**:
1. "Who is the primary audience for these documents?" 
   → `audience` field
2. "What's the main purpose of sharing these documents?"
   → `purpose` field
3. "What communication style should I use? (professional, casual, technical, etc.)"
   → `tone` field
4. "What are the 2-3 most important points you want me to emphasize?"
   → `emphasis_areas` array
5. "Should I only answer based on what's explicitly in the documents, or can I make reasonable inferences?"
   → `speculation_allowed` boolean

**Deep Dive Questions (Optional - 10-15 minutes)**:
6. "What specific questions do you anticipate from your audience?"
   → `anticipated_questions` array
7. "What's their expertise level with this topic?"
   → `expertise_level` field
8. "Are there any sensitive topics I should handle carefully?"
   → `sensitive_topics` array
9. "What follow-up actions would you like me to suggest?"
   → `suggested_actions` array
10. "Should I ask proactive questions to guide the conversation?"
    → `proactive_questions` array
11. "What's the relationship dynamic? (formal, collaborative, advisory, etc.)"
    → `relationship_dynamic` field

**Interview UX**:
- Chat-based interface (feels natural, not like a form)
- Smart skip logic ("That's enough" → saves with essentials)
- Progress indicator showing completion level
- Ability to edit/refine responses
- Preview mode: "Let me show you how I'll respond with current settings"

**Step 3: Agent Configuration Generation**

System compiles all responses into structured context JSON:

```json
{
  "agent_id": "uuid",
  "project_id": "uuid",
  "analysis_summary": "Summary of document collection...",
  "audience": {
    "primary": "board_members",
    "expertise_level": "business_executive",
    "relationship": "advisory"
  },
  "communication": {
    "tone": "professional_approachable",
    "formality_level": 7,
    "use_examples": true,
    "reference_style": "precise_citations"
  },
  "content_strategy": {
    "emphasis_areas": ["ROI projections", "risk mitigation", "timeline"],
    "sensitive_topics": ["competitive analysis"],
    "speculation_allowed": false,
    "context_boundaries": "strict"
  },
  "engagement": {
    "proactive_questions": [
      "How does this align with your Q3 strategy?",
      "What concerns do you have about implementation?"
    ],
    "suggested_actions": [
      "Schedule follow-up to discuss section 3",
      "Review competitive positioning with team"
    ]
  },
  "documents": {
    "key_sections": {
      "doc_1.pdf": ["Section 2: Market Analysis", "Section 5: Financial Projections"],
      "doc_2.docx": ["IP Strategy Overview"]
    }
  }
}
```

This JSON becomes part of the **context layer** for the LLM when viewers interact with documents.

### 2. Document Sharing & Access Control

**📊 Corresponds to Phases 6-7 in User Journey Matrix | See Flow 1 & Flow 2**

**Sharing Workflow (Phase 6: 5-7 minutes)**:
**📊 Creator Journey Phase 6 | 95% complete share setup**

1. Creator clicks "Share" on configured project
2. Share modal presents options:

**Access Level**:
- ☐ Public + Password: Anyone with link and password
- ☐ Email Required: Must provide email (no account needed)
- ☐ Whitelist Only: Pre-approved email list

**Additional Settings**:
- Optional expiration date
- Optional view limit (X views then expires)
- Custom password (if selected)
- Email whitelist (if selected)

3. System generates unique share link: `https://app.com/s/{share_code}`
4. Creator can copy link, send via email, or generate QR code

**Access Flow for Viewers (Phase 7: 1-2 minutes)**:
**📊 Board Member Journey Phase 7 | 70% provide email when required | 30% bounce**

1. Viewer visits share link
2. System checks access type:
   - **Public + Password**: Prompt for password → grant access
   - **Email Required**: Prompt for email → log access → grant access
   - **Whitelist**: Prompt for email → verify against whitelist → grant or deny

3. If granted, create anonymous session (no account required)
4. Load project with AI agent configuration
5. Begin conversation

### 3. Chat-First Document Interaction

**📊 Corresponds to Phase 8 in User Journey Matrix | See Flow 2 detailed breakdown**

**Core Interaction Pattern (Phase 8: 15-25 minutes)**:
**📊 Board Member Journey Phase 8 | Avg 5-8 questions | 15-20 min first-time | 25-30 min return visitors**

Viewers primarily interact through chat. Documents open automatically when relevant.

**AI Agent Behavior**:

1. **Welcome Message**: Personalized based on agent configuration
   ```
   "Hi! I'm here to help you understand [Creator]'s IP framework documentation. 
   I've been configured to focus on ROI projections and risk mitigation, which 
   I know are important for board members like you. What would you like to explore?"
   ```

2. **Contextual Document Opening**: When AI references content, it automatically:
   - Opens relevant document in side panel
   - Scrolls to specific section
   - Highlights referenced text
   - Keeps chat in focus

   **Technical Implementation**:
   - AI response includes markup: `[DOC:doc_1.pdf:section-3-2]`
   - Frontend parser detects markup, triggers document viewer
   - Document loads in panel, scrolls to anchor
   - Highlight animation on referenced section

3. **Proactive Guidance**: Based on agent config, asks strategic questions
   ```
   "Before we dive deeper, would it help if I walked you through the key 
   sections in order, or would you prefer to jump to specific topics?"
   ```

4. **Citation Style**: Always cites sources clearly
   ```
   "According to the Financial Projections document (page 12), 
   the projected ROI is 35% over 18 months..."
   ```

**Document Parsing for Precise References**:

**PDF Processing**:
```javascript
// Extract headings and create outline
const pdfParse = require('pdf-parse');
const extractOutline = async (pdfPath) => {
  const data = await pdfParse(pdfPath);
  // Analyze text for heading patterns
  // Look for: larger fonts, bold text, numbering (1., 1.1, etc.)
  const outline = detectHeadings(data.text);
  return {
    sections: outline,
    pageMapping: createPageMap(data)
  };
};
```

**Word Doc Processing**:
```javascript
// Mammoth.js preserves heading structure
const mammoth = require('mammoth');
const extractWordOutline = async (docxPath) => {
  const result = await mammoth.convertToHtml({path: docxPath});
  // Extract <h1>, <h2>, etc. tags = document structure
  const outline = parseHtmlHeadings(result.value);
  return outline;
};
```

**Knowledge Layer Integration**:
Store outlines so LLM knows document structure:
```
Context: "Available documents and their structure:
- IP_Framework.pdf: 
  - Section 1: Overview
  - Section 2: Market Analysis  
  - Section 3: Financial Projections
    - 3.1 Revenue Model
    - 3.2 ROI Analysis
"
```

### 4. Analytics & Creator Dashboard

**📊 Corresponds to Phase 10 in User Journey Matrix | See Flow 3 detailed breakdown**

**Real-Time Analytics for Creators (Phase 10: Daily 5-10 min check-ins)**:
**📊 Creator Journey Phase 10 | 85% return within 24 hours | 80% check weekly**

Dashboard shows engagement metrics:

**Overview Cards**:
- Total views
- Active conversations
- Average time spent
- Documents most accessed

**Conversation List**:
For each viewer session:
- Viewer email (if provided)
- Access timestamp
- Duration
- Documents viewed
- Key topics discussed
- Engagement score (calculated from interaction patterns)

**Conversation Details**:
Click into specific conversation:
- Full message history
- AI-generated summary
- Key questions/concerns raised
- Action items identified
- Sentiment analysis (positive/neutral/concerned)

**AI-Generated Summaries**:

After each conversation, system generates summary for creator:

```
Summary for: john@investor.com
Date: Nov 22, 2025
Duration: 23 minutes

Key Topics Explored:
- Financial projections (Section 3.2) - spent 8 minutes
- Risk mitigation strategies (Section 4) - spent 7 minutes  
- Timeline concerns (Section 6) - spent 5 minutes

Questions Raised:
1. "What happens if regulatory approval delays by 6 months?" 
   → Viewer seemed concerned about timeline buffers
2. "How does this compare to competitor X's approach?"
   → Viewer interested in competitive positioning

Action Items for You:
- Consider preparing contingency timeline document
- Schedule follow-up call to discuss competitive analysis in detail

Overall Sentiment: Engaged and interested, some concerns about timeline
```

**Email Notifications**:
- When someone accesses documents
- When conversation ends (with summary)
- When viewer saves conversation (signal of high engagement)

### 5. Viewer Conversion Strategy

**📊 Corresponds to Phase 9 in User Journey Matrix | See Flow 2 conversion decision point**

**Conversion Hook - Save Your Conversation (Phase 9: 1-2 minutes)**:
**📊 Viewer Journey Phase 9 | 40% convert first-time | 90% convert on return visit**

At end of conversation (or when viewer tries to leave), present modal:

```
┌─────────────────────────────────────────────┐
│  Save this conversation?                     │
│                                              │
│  Create a free account to:                  │
│  ✓ Save this conversation and summary       │
│  ✓ Return anytime to ask more questions     │
│  ✓ Get notified of document updates         │
│  ✓ Create your own document experiences     │
│                                              │
│  [Create Account]  [No Thanks]              │
└─────────────────────────────────────────────┘
```

**Quick Signup Flow**:
1. Email + password (or OAuth)
2. Conversation automatically linked to new account
3. AI generates downloadable summary PDF
4. Upsell: "Want to create experiences like this? Start free project →"

**Account Benefits**:
- **Free Tier**: Save conversations, 1 project, up to 10 documents
- **Pro Tier**: Unlimited projects, unlimited documents, white-label, custom domain, advanced analytics

---

## Existing System Integration

**Your Current Architecture** (preserved):
- LLM via Vercel AI SDK with swappable models
- Context layers (system prompts, always-loaded instructions)
- Knowledge files (referenced when relevant, not always in context)

**Integration Points**:

1. **Agent Configuration → Context Layer**
   - Interview results compile into structured context
   - Injected as system prompt when viewer chats
   - Example context layer:
   ```
   You are an AI assistant representing [Creator Name]'s document collection.
   
   Audience: Board members with business executive expertise
   Communication Style: Professional but approachable, use concrete examples
   
   Key Emphasis Areas: ROI projections, risk mitigation, timeline
   
   When answering:
   - Always cite specific documents and sections
   - Use format [DOC:filename:section-id] to reference content
   - Ask proactive questions: "How does this align with your Q3 strategy?"
   - Do not speculate beyond document content
   
   Available Documents:
   [List of documents with outlines]
   ```

2. **Document Content → Knowledge Layer**
   - Full text extraction stored as knowledge files
   - LLM retrieves relevant sections as needed
   - Not all loaded into context simultaneously (smart about token usage)

3. **Model Selection**
   - Creator can choose preferred model for their project
   - Options: GPT-4, Claude Sonnet 4, etc.
   - Vercel AI SDK handles swapping

---

## UI/UX Specifications

### Design Principles

1. **Chat-First**: Conversation is primary interaction, documents are supporting
2. **Clean & Professional**: DocuSign-like polish, not code-editor aesthetic
3. **Minimal Friction**: Viewers need zero setup to start engaging
4. **Contextual Guidance**: AI proactively helps navigate content

### Component Library

**Recommended**: 
- **Shadcn/ui** for consistent, professional components
- **shadcn MCP** - Use the shadcn Model Context Protocol for AI-assisted component generation and design iteration
- **Tailwind CSS** for styling
- **Framer Motion** for smooth transitions

**shadcn MCP Integration**:
The shadcn MCP enables Claude Code to rapidly prototype and iterate on UI components using shadcn's design system. This is particularly valuable for:
- Generating consistent, accessible components
- Rapid prototyping of complex layouts
- Maintaining design system consistency across the application
- AI-assisted component refinement and customization

### Key Screens

**1. Creator Dashboard**
```
┌────────────────────────────────────────────────────────┐
│ [Logo] My Projects                        [+ New Project] │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────┐             │
│  │ IP Framework Documentation            │             │
│  │ 5 documents • 12 views • 3 conversations            │
│  │ Created Nov 15, 2025                               │
│  │                                                     │
│  │ [View] [Share] [Analytics]                         │
│  └──────────────────────────────────────┘             │
│                                                         │
│  ┌──────────────────────────────────────┐             │
│  │ Q4 Board Presentation                 │             │
│  │ 8 documents • 25 views • 8 conversations            │
│  │ Created Nov 10, 2025                               │
│  │                                                     │
│  │ [View] [Share] [Analytics]                         │
│  └──────────────────────────────────────┘             │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**2. Project Setup - Document Upload**
```
┌────────────────────────────────────────────────────────┐
│ New Project: IP Framework Documentation               │
├────────────────────────────────────────────────────────┤
│                                                         │
│  Step 1 of 3: Upload Documents                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━     │
│                                                         │
│  ┌─────────────────────────────────────┐              │
│  │  [Upload Icon]                       │              │
│  │                                       │              │
│  │  Drag files here or click to browse  │              │
│  │                                       │              │
│  │  Supported: PDF, DOCX, XLSX, MD      │              │
│  └─────────────────────────────────────┘              │
│                                                         │
│  Uploaded Documents:                                   │
│  ✓ IP_Framework_Overview.pdf (2.3 MB)                 │
│  ✓ Financial_Projections.xlsx (456 KB)                │
│  ✓ Market_Analysis.docx (1.1 MB)                      │
│                                                         │
│  [← Back]                    [Next: Configure Agent →] │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**3. AI Agent Interview**
```
┌────────────────────────────────────────────────────────┐
│ Configure Your AI Agent                                │
├────────────────────────────────────────────────────────┤
│                                                         │
│  Step 2 of 3: Agent Configuration                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━     │
│                                                         │
│  Chat with me to configure how I'll represent your     │
│  documents. Answer as many questions as you'd like -   │
│  you can always refine this later.                     │
│                                                         │
│  ┌────────────────────────────────────────┐           │
│  │ [AI Avatar]                             │           │
│  │ I've analyzed your 3 documents. They    │           │
│  │ appear to be a comprehensive IP         │           │
│  │ framework covering market analysis,     │           │
│  │ financial projections, and strategy.    │           │
│  │                                          │           │
│  │ To help me represent these effectively, │           │
│  │ who will you be sharing these with?     │           │
│  └────────────────────────────────────────┘           │
│                                                         │
│  ┌────────────────────────────────────────┐           │
│  │ [You]                                   │           │
│  │ My board members and key investors      │           │
│  └────────────────────────────────────────┘           │
│                                                         │
│  ┌────────────────────────────────────────┐           │
│  │ [AI Avatar]                             │           │
│  │ Great! What communication style would   │           │
│  │ work best for board members? Should I   │           │
│  │ be formal, conversational, or somewhere │           │
│  │ in between?                              │           │
│  └────────────────────────────────────────┘           │
│                                                         │
│  [Type your response...]              [Skip This Step] │
│                                                         │
│  Progress: ████████░░░░░░ 40% Essential Complete       │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**4. Viewer Experience - Chat-First Layout**
```
┌──────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  MAIN CHAT PANEL              │  DOC VIEWER     │
│            │                                │                 │
│ Documents  │  [AI Avatar]                   │  [Tab: IP.pdf]  │
│ ──────     │  Hi! I'm here to help you     │                 │
│            │  understand the IP framework   │  ┌───────────┐ │
│ □ Overview │  documentation. I've been      │  │           │ │
│ □ Financial│  configured to focus on ROI    │  │  Section  │ │
│ □ Market   │  and risk mitigation. What     │  │  3.2:     │ │
│            │  would you like to explore?    │  │           │ │
│            │                                 │  │  ROI      │ │
│            │  [You]                          │  │  Analysis │ │
│            │  What's the projected ROI?     │  │           │ │
│            │                                 │  │  Projected│ │
│            │  [AI Avatar]                   │  │  35% over │ │
│            │  According to Financial        │  │  18 months│ │
│            │  Projections (Section 3.2),    │  │           │ │
│            │  the projected ROI is 35% over │  │ [Highlight]│ │
│            │  18 months... [DOC reference]   │  │           │ │
│            │                                 │  └───────────┘ │
│            │  [Type message...]             │                 │
│            │                                 │                 │
└──────────────────────────────────────────────────────────────┘
      ↑              ↑                              ↑
  Collapsible    Primary Focus              Auto-opens &
  File Tree      (60-70% width)             scrolls to ref
                                            (30-40% width)
```

**5. Share Modal - Access Configuration**
```
┌─────────────────────────────────────────────────────┐
│  Share: IP Framework Documentation                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Choose Access Level:                               │
│                                                      │
│  ○ Public + Password                                │
│    Anyone with the link and password can view       │
│                                                      │
│  ● Email Required                                   │
│    Viewers must provide email (no account needed)   │
│                                                      │
│  ○ Whitelist Only                                   │
│    Only pre-approved email addresses can view       │
│                                                      │
│  ────────────────────────────────────────────────   │
│                                                      │
│  Additional Settings:                               │
│                                                      │
│  Password (optional): [••••••••••]  [Generate]      │
│                                                      │
│  Expiration:  [No Expiration ▼]                     │
│               □ Expire after 7 days                 │
│               □ Expire after 30 days                │
│               □ Custom date...                      │
│                                                      │
│  View Limit:  [No Limit ▼]                          │
│               □ 10 views                            │
│               □ 50 views                            │
│               □ Custom...                           │
│                                                      │
│  ────────────────────────────────────────────────   │
│                                                      │
│  Share Link:                                        │
│  ┌────────────────────────────────────────────┐    │
│  │ https://app.com/s/xyz123abc              [📋] │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  [Copy Link]  [Send via Email]  [Generate QR]       │
│                                                      │
│                                  [Cancel]  [Done]   │
└─────────────────────────────────────────────────────┘
```

**6. Viewer Access Gate - Email Required**
```
┌─────────────────────────────────────────────────────┐
│                                                      │
│                 [Document Icon]                      │
│                                                      │
│         IP Framework Documentation                   │
│         Shared by John Smith                        │
│                                                      │
│  To access these documents, please provide          │
│  your email address:                                │
│                                                      │
│  Email: [_________________________________]          │
│                                                      │
│  ☑ I agree to the terms and privacy policy          │
│                                                      │
│              [Access Documents]                      │
│                                                      │
│  Your email will only be used to track              │
│  document access and will not be shared.            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**7. Analytics Dashboard - Creator View**
```
┌──────────────────────────────────────────────────────────────┐
│ Analytics: IP Framework Documentation           [Export ▼]   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Overview                                  Last 30 Days      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   12        │  │    8        │  │   156       │         │
│  │ Total Views │  │Conversations│  │Avg. Time (s)│         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                               │
│  ────────────────────────────────────────────────────────    │
│                                                               │
│  Recent Conversations                                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ john@investor.com                   Nov 22, 2:35 PM  │   │
│  │ Duration: 23 min • 3 docs viewed                     │   │
│  │ Key topics: ROI projections, timeline, risks         │   │
│  │ Status: 😊 Engaged, some concerns                    │   │
│  │ [View Details] [View Summary]                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ sarah@fund.com                      Nov 21, 4:12 PM  │   │
│  │ Duration: 15 min • 2 docs viewed                     │   │
│  │ Key topics: Market analysis, competitive landscape   │   │
│  │ Status: 😊 Positive feedback                         │   │
│  │ [View Details] [View Summary]                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ────────────────────────────────────────────────────────    │
│                                                               │
│  Document Engagement                                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ IP_Framework_Overview.pdf          ████████░░ 8 views│   │
│  │ Financial_Projections.xlsx         ████████░░ 7 views│   │
│  │ Market_Analysis.docx               ██████░░░░ 5 views│   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**8. Conversation Detail View - Creator Insight**
```
┌──────────────────────────────────────────────────────────────┐
│ ← Back to Analytics                                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Conversation with john@investor.com                         │
│  November 22, 2025 • 2:35 PM • Duration: 23 minutes         │
│                                                               │
│  ────────────────────────────────────────────────────────    │
│                                                               │
│  AI-Generated Summary                         [Export PDF]   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Key Topics Explored:                                 │   │
│  │ • Financial projections (8 min) - deep dive into    │   │
│  │   Section 3.2, asked multiple clarifying questions  │   │
│  │ • Risk mitigation (7 min) - concerned about         │   │
│  │   regulatory delays                                  │   │
│  │ • Timeline (5 min) - questioned 18-month projection │   │
│  │                                                       │   │
│  │ Questions Raised:                                    │   │
│  │ 1. "What if regulatory approval delays 6 months?"   │   │
│  │    → Concern about contingency planning             │   │
│  │ 2. "How does this compare to competitor X?"         │   │
│  │    → Interested in competitive positioning          │   │
│  │                                                       │   │
│  │ Action Items for You:                                │   │
│  │ • Prepare contingency timeline document              │   │
│  │ • Schedule follow-up on competitive analysis        │   │
│  │                                                       │   │
│  │ Overall Sentiment: Engaged & interested, some       │   │
│  │ concerns about timeline. Strong interest in ROI.    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ────────────────────────────────────────────────────────    │
│                                                               │
│  Documents Viewed                                            │
│  ✓ Financial_Projections.xlsx (viewed 3 times)              │
│  ✓ IP_Framework_Overview.pdf (viewed 2 times)               │
│  ✓ Market_Analysis.docx (viewed 1 time)                     │
│                                                               │
│  ────────────────────────────────────────────────────────    │
│                                                               │
│  Conversation Timeline                        [View Full]    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 2:35 PM - Conversation started                       │   │
│  │ 2:37 PM - Opened Financial_Projections.xlsx         │   │
│  │ 2:42 PM - Asked about ROI calculations              │   │
│  │ 2:45 PM - Opened IP_Framework_Overview.pdf          │   │
│  │ 2:50 PM - Asked about regulatory risks              │   │
│  │ 2:58 PM - Conversation ended                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**9. Viewer Conversion Modal - Save Conversation**
```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              Save this conversation?                 │
│                                                      │
│  You've had a great discussion about the IP         │
│  Framework documentation. Create a free account to: │
│                                                      │
│  ✓ Save this conversation and AI summary            │
│  ✓ Return anytime to ask follow-up questions        │
│  ✓ Get notified when documents are updated          │
│  ✓ Create your own conversational doc experiences   │
│                                                      │
│  ────────────────────────────────────────────────   │
│                                                      │
│  Email:    [_________________________________]       │
│  Password: [_________________________________]       │
│                                                      │
│  Or continue with:                                  │
│  [Google]  [GitHub]  [Microsoft]                    │
│                                                      │
│  ────────────────────────────────────────────────   │
│                                                      │
│        [Create Free Account]  [No Thanks]           │
│                                                      │
│  By creating an account, you agree to our           │
│  Terms of Service and Privacy Policy                │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**10. Document Viewer - Multi-Tab with Highlight**
```
┌─────────────────────────────────────────────────────┐
│ [IP.pdf] [Financial.xlsx] [Market.docx] +           │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Page 12 of 45                          [🔍] [⚙️]   │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │ 3.2 ROI Analysis                           │    │
│  │ ──────────────────────────────────────     │    │
│  │                                             │    │
│  │ Based on our market research and           │    │
│  │ competitive analysis, we project a         │    │
│  │ 【━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━】   │    │
│  │ 【return on investment of 35% over an    】│    │
│  │ 【18-month period, assuming baseline     】│    │
│  │ 【market conditions.                     】│    │
│  │ 【━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━】   │    │
│  │          ↑ Currently referenced by AI       │    │
│  │                                             │    │
│  │ This projection accounts for:              │    │
│  │ • Customer acquisition costs               │    │
│  │ • Marketing spend                          │    │
│  │ • Infrastructure investments               │    │
│  │                                             │    │
│  │ See Appendix C for detailed breakdown.     │    │
│  │                                             │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  [← Previous Page]  [Jump to Section ▼]  [Next →]  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**11. Mobile View - Chat Focused**
```
┌────────────────────┐
│ [☰] IP Framework   │
├────────────────────┤
│                    │
│  [AI Avatar]       │
│  Hi! I'm here to   │
│  help you explore  │
│  the IP framework. │
│  What interests    │
│  you most?         │
│                    │
│  [You]             │
│  Tell me about     │
│  the ROI           │
│                    │
│  [AI Avatar]       │
│  The projected ROI │
│  is 35% over 18    │
│  months. Tap to    │
│  view details:     │
│  [📄 View Section] │
│                    │
│  [Type message...] │
│                    │
└────────────────────┘
     ↑
  Chat-only view
  Tap doc links
  to view full-screen
```

**12. Agent Preview - During Configuration**
```
┌─────────────────────────────────────────────────────┐
│  Agent Preview                            [Edit ✏️]  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Test how your agent will interact with viewers:    │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │ [AI Avatar - Preview Mode]                 │    │
│  │ Hi! I'm here to help you understand the    │    │
│  │ IP framework documentation. I've been      │    │
│  │ configured to focus on ROI projections     │    │
│  │ and risk mitigation strategies, which I    │    │
│  │ know are priorities for board members.     │    │
│  │                                             │    │
│  │ I can explain concepts in business terms   │    │
│  │ and will always cite specific sections.    │    │
│  │                                             │    │
│  │ What would you like to explore first?      │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  Configuration Summary:                             │
│  • Audience: Board members & investors              │
│  • Tone: Professional but approachable              │
│  • Focus Areas: ROI, risk mitigation, timeline      │
│  • Speculation: Not allowed                         │
│                                                      │
│  [Looks good!]  [Refine Agent →]                    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**13. Email Whitelist Management**
```
┌─────────────────────────────────────────────────────┐
│  Whitelist Settings                                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Only these email addresses can access:             │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │ john@investor.com                     [×]  │    │
│  └────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────┐    │
│  │ sarah@fund.com                        [×]  │    │
│  └────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────┐    │
│  │ michael@board.org                     [×]  │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  Add email: [_____________________] [+ Add]         │
│                                                      │
│  ────────────────────────────────────────────────   │
│                                                      │
│  Bulk Import:                                       │
│  Paste comma-separated emails or upload CSV         │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │ email1@domain.com, email2@domain.com,     │    │
│  │ email3@domain.com                          │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  [📤 Upload CSV]  [Import from Paste]               │
│                                                      │
│                                  [Cancel]  [Save]   │
└─────────────────────────────────────────────────────┘
```

**14. Document Analysis Results - After Upload**
```
┌─────────────────────────────────────────────────────┐
│  Document Analysis Complete              ✓          │
├─────────────────────────────────────────────────────┤
│                                                      │
│  I've analyzed your 3 documents. Here's what I      │
│  found:                                             │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │ 📄 IP_Framework_Overview.pdf               │    │
│  │    • 25 pages                               │    │
│  │    • Main topics: Strategy, vision,         │    │
│  │      market positioning                     │    │
│  │    • Key sections: 5                        │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │ 📊 Financial_Projections.xlsx              │    │
│  │    • 3 sheets: Revenue, Costs, ROI          │    │
│  │    • Main data: 18-month projections,       │    │
│  │      35% ROI calculation                    │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │ 📝 Market_Analysis.docx                    │    │
│  │    • 15 pages                               │    │
│  │    • Main topics: Competitive landscape,    │    │
│  │      TAM/SAM/SOM, customer segments         │    │
│  │    • Key sections: 4                        │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  Overall Summary:                                   │
│  This appears to be a comprehensive business        │
│  framework focused on intellectual property         │
│  strategy, with detailed financial modeling and     │
│  market analysis. The documents are well-           │
│  structured for executive review.                   │
│                                                      │
│  Suggested Questions I Should Be Ready For:         │
│  • What's the ROI timeline?                         │
│  • How does this compare to competitors?            │
│  • What are the main risks?                         │
│  • What resources are needed?                       │
│                                                      │
│  [Continue to Agent Configuration →]                │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**15. Settings - Project Configuration**
```
┌─────────────────────────────────────────────────────┐
│  Project Settings: IP Framework Documentation       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  General                                            │
│  Project Name: [IP Framework Documentation____]     │
│  Description:  [Comprehensive IP strategy docs]     │
│                                                      │
│  ────────────────────────────────────────────────   │
│                                                      │
│  AI Agent Configuration                             │
│  Model:       [Claude Sonnet 4 ▼]                   │
│               GPT-4, Claude Sonnet 4, Claude Opus 4 │
│                                                      │
│  Temperature: [━━━━━━━●━━] 0.7                      │
│               Lower = More focused, Higher = Creative│
│                                                      │
│  [Reconfigure Agent Interview]                      │
│                                                      │
│  ────────────────────────────────────────────────   │
│                                                      │
│  Documents                                          │
│  ✓ IP_Framework_Overview.pdf    2.3 MB  [Remove]   │
│  ✓ Financial_Projections.xlsx   456 KB  [Remove]   │
│  ✓ Market_Analysis.docx          1.1 MB  [Remove]   │
│                                                      │
│  [+ Add More Documents]                             │
│                                                      │
│  ────────────────────────────────────────────────   │
│                                                      │
│  Sharing                                            │
│  Active Share Links: 2                              │
│  Total Views: 12                                    │
│  [Manage Share Links →]                             │
│                                                      │
│  ────────────────────────────────────────────────   │
│                                                      │
│  Danger Zone                                        │
│  [Archive Project]  [Delete Project]                │
│                                                      │
│                    [Cancel]  [Save Changes]         │
└─────────────────────────────────────────────────────┘
```

---

## User Journey Integration Guide

**📊 HOW TO USE THE COMPANION SPREADSHEET WITH THIS SPEC**

The [User Journey Flows](user-journey-flows.xlsx) spreadsheet contains three critical sheets:

### 1. User Journeys Matrix
**Purpose**: See all user types and what they do at each phase
- **Rows**: 5 user types (Creator, Board Member, Investor, Platform Admin, Converted User)
- **Columns**: 12 phases of end-to-end experience
- **Usage**: When building a feature, check what ALL users experience at that phase

**Example**: When building Phase 8 (Conversation), check:
- Board Member: First-time questions, 15-20 min engagement
- Investor: Return visitor, 25-30 min, more efficient
- Platform Admin: Tracking metrics, monitoring engagement
- Creator: N/A for their own projects

### 2. Journey Flow Diagrams
**Purpose**: Detailed step-by-step flows with decision points
- **Flow 1**: Document Creator end-to-end (30-45 minutes)
- **Flow 2**: Board Member first view (15-25 minutes)
- **Flow 3**: Creator analytics & iteration (ongoing)

**Each flow includes**:
- Exact timing for each step
- Mental states and concerns
- Decision points with conversion rates
- Drop-off rates and why
- Anxiety/confidence moments

**Example**: Flow 2 shows "MOMENT OF TRUTH: First question" with reaction percentages:
- 60% engaged
- 30% cautious
- 10% bounce

Use these to design UI states and copy that addresses user concerns at right moment.

### 3. Key Success Metrics
**Purpose**: Target KPIs for every phase and user type
- Organized by category (Activation, Engagement, Conversion, Retention, Quality, Business)
- Each metric includes target value and measurement method
- Maps directly to phases in User Journeys Matrix

**Example**: 
- "Upload to configured agent: <20 minutes" (Phase 2-4)
- "Questions per session: >5" (Phase 8)
- "Week 1 return rate: >80%" (Phase 10)

### Cross-Reference Examples

**Building Phase 4 (Agent Configuration)**:
1. Check User Journeys Matrix → Creator column → Phase 4 cell
2. Read detailed flow in Journey Flow Diagrams → Flow 1 → Step 4
3. Check Key Success Metrics → "Configuration completion rate >85%"
4. Design UI to achieve these outcomes

**Building Phase 9 (Conversion)**:
1. User Journeys Matrix → Board Member → Phase 9 (40% convert)
2. Flow 2 → Step 9 → Decision tree for account creation
3. Key Success Metrics → "Viewer to account >40%"
4. See timing: happens after 15-20 min engagement (Phase 8)

**Building Analytics (Phase 10)**:
1. User Journeys Matrix → Creator → Phase 10
2. Flow 3 → Complete analytics review workflow
3. Key Success Metrics → "Week 1 return rate >80%"
4. Design to surface insights that drive action items

### Phase-to-Feature Mapping

| Phase | Feature Area | Wireframes in Spec | Journey Flow Reference |
|-------|--------------|-------------------|----------------------|
| 1-2 | Sign-up & Upload | #1, #2 | Flow 1, Steps 1-2 |
| 3-4 | Agent Config | #3, #12, #14 | Flow 1, Steps 3-4 |
| 5 | Preview | #12 | Flow 1, Step 5 |
| 6 | Sharing | #5, #13 | Flow 1, Step 6 |
| 7 | Access | #6 | Flow 2, Step 7 |
| 8 | Conversation | #4, #10, #11 | Flow 2, Step 8 |
| 9 | Conversion | #9 | Flow 2, Step 9 |
| 10 | Analytics | #7, #8 | Flow 3, Step 10 |
| 11 | Iteration | #15 | Flow 3, Step 11 |
| 12 | Retention | All | All Flows |

---

## Development Phases

### Phase 1: MVP Core (4-6 weeks)
**Goal**: Single-tenant working prototype for personal use

**Features**:
- Document upload (PDF only initially)
- Basic AI analysis & summary
- Simple context interview (5 essential questions)
- Public link sharing with password
- Chat interface with document viewer
- Basic document reference system

**Tech Stack**:
- Frontend: React + Vite + Tailwind
- Backend: Express.js + PostgreSQL
- Document: PDF.js only
- LLM: OpenAI GPT-4 via Vercel AI SDK
- Deployment: Docker Compose local

**Success Criteria**:
- Can upload PDFs, configure agent, share link
- Recipients can chat and view documents
- Documents auto-open when referenced in chat

### Phase 2: Multi-Document & Analytics (2-3 weeks)
**Goal**: Support multiple document types, add analytics

**Features**:
- Support DOCX, XLSX, Markdown
- Document outline extraction for all types
- Creator analytics dashboard
- Conversation summaries for creators
- Email notifications

**Tech Stack Additions**:
- Mammoth.js for Word
- SheetJS for Excel
- Email service (SendGrid or similar)

### Phase 3: Multi-Tenant & Accounts (3-4 weeks)
**Goal**: True B2B SaaS with user accounts

**Features**:
- User registration & authentication
- Multi-tenant project management
- Viewer account creation (optional)
- Conversation saving for viewers
- Access control (email gating, whitelist)
- Subscription tiers

**Tech Stack Additions**:
- JWT authentication
- Stripe integration for subscriptions
- User management system

### Phase 4: Polish & Scale (2-3 weeks)
**Goal**: Production-ready with professional UX

**Features**:
- White-label options
- Custom domain support
- Advanced analytics
- Export capabilities (conversation PDFs)
- Mobile-responsive design
- Performance optimization

---

## Open Questions & Decisions Needed

### Technical Decisions

1. **Vector Database for Semantic Search?**
   - Could add Pinecone/Weaviate for semantic document search
   - Trade-off: Additional complexity vs. more intelligent retrieval
   - Recommendation: Start without, add if needed

2. **Real-time vs Polling for Chat?**
   - WebSockets for real-time chat updates
   - Or polling every 2 seconds
   - Recommendation: Polling for MVP, WebSockets in Phase 3

3. **Document Storage Location?**
   - File system (simple, good for MVP)
   - S3/Cloud storage (scalable, better for production)
   - Recommendation: File system for MVP, S3 in Phase 3

### Business Decisions

1. **Pricing Model?**
   - Free tier: 1 project, 10 docs, basic analytics
   - Pro tier: $X/month - unlimited projects, advanced features
   - Enterprise: Custom pricing for white-label

2. **Target Market Priority?**
   - Start with consultants/advisors (your use case)
   - Expand to founders, sales teams, legal
   - Recommendation: Nail consultant use case first

3. **Branding?**
   - Product name?
   - Tag line: "Turn documents into conversations"?
   - Visual identity?

---

## Success Metrics

**📊 DETAILED METRICS**: See "Key Success Metrics" sheet in User Journey Flows companion spreadsheet for complete target metrics and measurement methods.

### User Engagement
**📊 See Phase 8 metrics in companion spreadsheet**
- Average conversation duration (target: >5 minutes | Flow 2: 15-25 min actual)
- Documents opened per session (target: >2 | Flow 2: 2-3 actual)
- Return visits for saved conversations (target: >30% | Flow 2: 25% actual)

### Creator Value
**📊 See Phases 10-11 metrics in companion spreadsheet**
- Time saved vs traditional document sharing (target: >2 hours | Flow 3: measured qualitatively)
- Comprehension improvement (survey recipients)
- Follow-up meeting quality (survey creators)
- Analytics engagement (target: 85% weekly check-ins | Flow 3: actual tracking)

### Business Metrics
**📊 See "BUSINESS HEALTH" section in Key Success Metrics sheet**
- Free → Pro conversion rate (target: >5% | 8% target in metrics)
- Monthly recurring revenue
- Customer acquisition cost (target: <$50)
- Net promoter score (target: >50)

---

## Risk Mitigation

### Technical Risks

**Risk**: Document parsing fails for complex formats
- **Mitigation**: Extensive testing, fallback to basic text extraction

**Risk**: LLM hallucination or inaccurate citations
- **Mitigation**: Strict citation requirements, verification system

**Risk**: Performance issues with large documents
- **Mitigation**: Lazy loading, progressive rendering, optimization

### Business Risks

**Risk**: Users don't see value over static documents
- **Mitigation**: Strong onboarding, showcase analytics value

**Risk**: Privacy concerns with AI processing documents
- **Mitigation**: Clear data policies, self-hosted options

**Risk**: Market too niche initially
- **Mitigation**: Start focused, expand use cases gradually

---

## Implementation Appendices

The following sections provide complete implementation-ready specifications for all critical system components. These were added based on spec validation to ensure autonomous implementation readiness.

---

# APPENDIX A: Document Processing Algorithms

**Complete specifications in:** `specs/01-document-processing-algorithms.md`

This appendix provides production-ready algorithms for extracting text, outlines, and metadata from PDF, DOCX, XLSX, and Markdown files.

**Key Components:**
- **Section ID Generation:** Content-based hash IDs for stable citations across document re-uploads
- **PDF Processing:** Using `pdf-parse` with heading detection via font size and pattern analysis
- **DOCX Processing:** Using `mammoth` with Word heading style preservation
- **XLSX Processing:** Using `xlsx` (SheetJS) with sheet-based outline structure
- **Markdown Processing:** Native parsing with regex-based heading extraction
- **Quality Validation:** Confidence scoring for outline and text completeness
- **Error Handling:** Comprehensive error recovery for corrupted/complex files

**Critical Implementation Details:**
- Maximum file sizes: PDF/DOCX (50MB), XLSX (20MB), MD (10MB)
- Heading detection strategies with fallbacks
- Character position tracking for section boundaries
- Processing time estimates and optimization strategies

**See full appendix for:**
- Complete TypeScript implementations
- Test fixtures and testing strategy
- Performance considerations
- Edge case handling

---

# APPENDIX B: LLM Integration Architecture

**Complete specifications in:** `specs/02-llm-integration-architecture.md`

This appendix specifies the hybrid RAG (Retrieval Augmented Generation) strategy for integrating documents with LLM chat.

**Architecture Decision: Hybrid Context Strategy**

```
System Prompt (2K tokens)
+ Document Outlines (all docs, 3K tokens)
+ Semantic Search Results (top 8 chunks, 4K tokens)
+ Conversation History (sliding window, 3K tokens)
= 12K tokens total
```

**Key Components:**
- **Vector Database:** pgvector extension for PostgreSQL (no new infrastructure)
- **Document Chunking:** Section-aware chunking with 500-token chunks and 50-token overlap
- **Semantic Search:** Cosine similarity search with OpenAI `text-embedding-ada-002`
- **Token Budget Management:** Dynamic allocation based on model (GPT-4, GPT-4 Turbo, Claude)
- **Citation Verification:** Post-generation verification with Levenshtein distance corrections
- **Context Composition:** Structured prompts with agent config + outlines + relevant chunks

**Critical Implementation Details:**
- Embedding generation batching (100 chunks per API call)
- Token budget allocation per model type
- Conversation history truncation strategy
- Citation markup format: `[DOC:filename:section-id]`
- Hallucination prevention through section ID validation

**Cost Estimates:**
- Embeddings: ~$0.01 per document (one-time)
- Chat (GPT-4 Turbo): ~$0.138 per message
- Chat (Claude Sonnet 4): ~$0.045 per message (3x cheaper)

**See full appendix for:**
- Complete database schema extensions (DocumentChunk model)
- Chunking and embedding generation code
- Semantic search implementation
- Citation verification system
- Error handling and retry strategies

---

# APPENDIX C: API Reference

**Complete specifications in:** `specs/03-api-reference.md`

This appendix provides complete OpenAPI-style specifications for all 25+ API endpoints.

**Endpoint Categories:**
1. **Authentication** (`/api/auth/*`)
   - POST /api/auth/register
   - POST /api/auth/login
   - GET /api/auth/me

2. **Project Management** (`/api/projects/*`)
   - POST /api/projects
   - GET /api/projects
   - GET /api/projects/:id
   - PUT /api/projects/:id
   - DELETE /api/projects/:id

3. **Document Management** (`/api/projects/:id/documents/*`)
   - POST .../:id/documents (multipart/form-data upload)
   - GET .../:id/documents/:documentId/status
   - DELETE .../:id/documents/:documentId

4. **Agent Configuration** (`/api/projects/:id/agent-config/*`)
   - POST .../:id/agent-config
   - GET .../:id/agent-config

5. **Share Links** (`/api/projects/:id/share/*`, `/api/share/*`)
   - POST .../:id/share
   - GET /api/share/:shareCode (public endpoint)
   - DELETE .../:id/share/:shareLinkId

6. **Chat** (`/api/chat/*`)
   - POST /api/chat (streaming SSE response)
   - GET /api/chat/:sessionId/history

7. **Analytics** (`/api/projects/:id/analytics/*`, `/api/conversations/*`)
   - GET .../:id/analytics
   - GET .../:id/conversations
   - GET /api/conversations/:conversationId

**For Each Endpoint:**
- Complete request/response JSON schemas
- Authentication requirements (JWT bearer tokens)
- Error codes and messages
- Rate limiting specifications
- Validation rules
- Example requests/responses

**Standardized Error Format:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": { "field": "email" },
    "retryable": false
  },
  "requestId": "req_abc123",
  "timestamp": "2025-01-20T18:00:00Z"
}
```

**Rate Limits:**
- Free tier: 100 chat messages/day, 10 projects total
- Pro tier: Unlimited chat, unlimited projects
- Registration: 5/hour, Login: 10/hour
- Document upload: 10/hour

**See full appendix for:**
- Complete OpenAPI 3.0 schema
- Request/response examples for all endpoints
- Error code catalog
- Rate limiting details
- Webhook specifications (Phase 3)

---

# APPENDIX D: Authentication & Authorization

**Complete specifications in:** `specs/04-authentication-authorization.md`

This appendix provides complete auth implementation using NextAuth.js v5 (Auth.js).

**Two-Track Authentication:**

**Track 1: Creator Authentication (JWT)**
- NextAuth.js with Credentials provider (email/password)
- bcrypt password hashing (12 rounds)
- JWT tokens (7-day expiration)
- OAuth support (Google, GitHub) in Phase 2

**Track 2: Viewer Access (Share Links)**
- Anonymous session management
- Three access types:
  - `public_password`: Password-protected links
  - `email_required`: Email collection for analytics
  - `whitelist`: Pre-approved email list
- Session cookies for conversation tracking

**Key Components:**
- **Password Security:** bcrypt with strength validation (min 8 chars, uppercase, lowercase, number)
- **Rate Limiting:** 10 login attempts per hour, 5 registration attempts per hour
- **JWT Utilities:** Token signing/verification with jose
- **Middleware:** `withAuth()` wrapper for protected routes
- **Ownership Verification:** `requireProjectOwnership()` for resource access control

**Share Link Security:**
- Share codes: 10-character alphanumeric with collision detection
- Password hashing: bcrypt (same as user passwords)
- Whitelist matching: Case-insensitive email comparison
- Access logging: All attempts logged with IP, email, timestamp
- Expiration enforcement: Background cleanup of expired links

**Critical Implementation Details:**
```typescript
// Protected route example
export const GET = withAuth(async (req, auth) => {
  const { userId } = auth
  // Verified auth context available
})

// Share link verification
const access = await verifyShareLinkAccess(shareCode, {
  password: 'user-provided-password',
  email: 'viewer@example.com'
})
```

**See full appendix for:**
- Complete NextAuth.js configuration
- Password hashing and validation code
- JWT signing/verification utilities
- Authorization middleware implementations
- Share link access verification flow
- Session management for anonymous viewers
- Testing strategy for auth flows

---

# APPENDIX E: Error Handling Specifications

**Complete specifications in:** `specs/05-error-handling-specifications.md`

This appendix provides comprehensive error handling strategy for all system components.

**Error Classification:**

**Client Errors (4xx):** User's fault, not retryable
- 400 VALIDATION_ERROR, 401 AUTHENTICATION_REQUIRED, 403 FORBIDDEN, 404 NOT_FOUND, 409 CONFLICT, 413 PAYLOAD_TOO_LARGE, 415 UNSUPPORTED_MEDIA_TYPE, 429 RATE_LIMIT_EXCEEDED (retryable after delay)

**Server Errors (5xx):** System's fault, retryable
- 500 INTERNAL_ERROR, 502 BAD_GATEWAY, 503 SERVICE_UNAVAILABLE, 504 GATEWAY_TIMEOUT

**Application Errors:** Domain-specific
- DOCUMENT_PROCESSING_ERROR, LLM_ERROR (retryable), EMBEDDING_ERROR (retryable), CITATION_ERROR, DATABASE_ERROR (retryable)

**Standardized Response Format:**
```typescript
interface ErrorResponse {
  error: {
    code: string              // Machine-readable
    message: string           // Human-readable
    details?: object          // Context
    retryable: boolean
    retryAfter?: number       // Seconds
  }
  requestId: string           // For debugging
  timestamp: string
}
```

**Component-Specific Handling:**

1. **Document Processing Errors**
   - Encrypted PDF → Prompt for password
   - Corrupted PDF → Attempt repair, extract partial text
   - Scanned PDF → Suggest OCR or text-based upload
   - File too large → Clear size limits in message

2. **LLM Provider Errors**
   - Rate limit → Retry with exponential backoff
   - Quota exceeded → User message + support contact
   - Context length exceeded → Truncate history or suggest new conversation
   - Provider unavailable → Automatic fallback to alternate provider

3. **Database Errors**
   - Connection timeout → Retry with backoff
   - Unique constraint → Clear conflict message
   - Foreign key violation → "Referenced resource doesn't exist"
   - Record not found → 404 NOT_FOUND

**Retry Strategies:**

**Exponential Backoff:**
```typescript
await retryWithBackoff(
  () => openai.chat.completions.create(...),
  {
    maxAttempts: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
    maxDelayMs: 30000
  }
)
```

**Circuit Breaker:**
```typescript
const result = await circuitBreakers.openai.execute(
  () => callOpenAI(...)
)
// Auto-opens after 5 failures, half-opens after 1 min
```

**Graceful Degradation:**
- LLM fallback: Primary provider fails → Try alternate provider → Return graceful error
- Partial responses: Save incomplete conversations with error metadata
- Service unavailability: Return cached data or simplified functionality

**User-Facing Messages:**
- Be specific: "PDF file is too large (max 50MB)" not "Upload failed"
- Be actionable: Tell user what to do next
- Be empathetic: "We're sorry..." for system errors
- Never expose internals: No stack traces or database errors
- Provide support: Include requestId for debugging

**See full appendix for:**
- Complete error class hierarchy
- Error handler middleware
- Component-specific error catalogs
- Retry logic implementations
- Circuit breaker pattern
- Logging and monitoring setup
- User message templates
- Testing strategy

---

## Next Steps for Claude Code

### Immediate Actions

1. **Set up project structure**:
   ```
   /conversational-doc-ide
     /frontend (React + Vite)
     /backend (Express.js)
     /shared (types, utilities)
     docker-compose.yml
   ```

2. **Initialize core dependencies**:
   - Frontend: React, Vite, Tailwind, PDF.js, Monaco Editor base
   - Backend: Express, PostgreSQL, Vercel AI SDK, pdf-parse

3. **Database setup**:
   - Create PostgreSQL schema
   - Set up migrations
   - Seed initial data

4. **Implement Phase 1 features** in this order:
   a. Document upload & storage
   b. PDF analysis & summary
   c. Basic context interview
   d. Share link generation
   e. Viewer chat interface
   f. Document viewer with auto-open

### Key Files to Create First

1. **Database schema** (`backend/db/schema.sql`)
2. **API routes** (`backend/routes/`)
3. **Frontend layout** (`frontend/src/components/Layout.tsx`)
4. **Chat component** (`frontend/src/components/Chat.tsx`)
5. **Document viewer** (`frontend/src/components/DocumentViewer.tsx`)
6. **LLM integration** (`backend/services/llm.ts`)

### Configuration Files Needed

1. `.env.example` with required environment variables
2. `docker-compose.yml` for deployment
3. `README.md` with setup instructions
4. TypeScript configs for both frontend/backend

---

## Conclusion

This specification provides a complete blueprint for building a chat-first conversational document IDE. The system transforms static document sharing into intelligent, personalized experiences through AI agent onboarding.

**Core Innovation**: The context interview system that generates custom AI representatives for each document set, optimized for specific audiences and communication goals.

**Market Position**: Professional document sharing with conversational AI - bridges gap between static tools (DocSend, Notion) and general AI chat (ChatGPT, Claude).

**Go-to-Market**: Start with consultants/advisors who need sophisticated document sharing, expand to founders, sales teams, and enterprise.

Ready for implementation in Claude Code with clear phases, technical specifications, and risk mitigation strategies.
