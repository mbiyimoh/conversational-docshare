# Architecture Integration Guide

**How the Existing LLM System Powers the Conversational Document IDE**

This document maps the proven LLM architecture (`context-and-knowledge-LLM-synthesis.md`) to the new conversational document IDE features. It shows what we're reusing, what we're extending, and what's completely new.

---

## Table of Contents

1. [System Comparison](#system-comparison)
2. [Context Layer Evolution](#context-layer-evolution)
3. [Database Schema Migration](#database-schema-migration)
4. [Code Reuse Strategy](#code-reuse-strategy)
5. [New Components](#new-components)
6. [Integration Points](#integration-points)
7. [Implementation Roadmap](#implementation-roadmap)

---

## System Comparison

### Base System (Existing)

**Purpose:** General-purpose LLM chat with editable context layers

**Architecture:**
```
User ← → Frontend ← → API Routes ← → Context Composer ← → Database
                                  ← → LLM Provider

- Single project focus
- User directly edits context layers
- General knowledge files
- Real-time context updates
```

**Use Cases:**
- Customer support chatbots with editable knowledge
- Educational platforms with customizable teaching styles
- Domain-specific AI assistants

### Conversational Document IDE (This Project)

**Purpose:** Multi-tenant document sharing with AI-powered navigation

**Architecture:**
```
Creator ← → Config Interface ← → Interview System → Context Layers
                                                   → Agent Config

Viewer ← → Chat Interface ← → Context Composer ← → Documents
                          ← → Document Viewer   ← → Analytics

- Multi-tenant (many creators, projects)
- Two-stage: Creator configs, viewers consume
- Document-centric with extraction
- Share links with access control
```

**Use Cases:**
- Consultants sharing IP frameworks with boards
- Founders sharing pitch decks with investors
- Teams sharing documentation with clients

---

## Context Layer Evolution

### Base System Context Layers

**Purpose:** Store editable AI knowledge/behavior

```prisma
model ContextLayer {
  id          String
  projectId   String
  name        String      // "Core Principles"
  content     String      // Markdown/text
  priority    Int         // Composition order
  isActive    Boolean     // Toggle on/off
  isBuiltIn   Boolean     // Protect from deletion
}
```

**Composition:**
```typescript
// Fetch layers, build prompt
const layers = await prisma.contextLayer.findMany({
  where: { projectId, isActive: true },
  orderBy: { priority: 'asc' }
})

let prompt = '# CONTEXT LAYERS\n\n'
layers.forEach(layer => {
  prompt += `## ${layer.name}\n\n${layer.content}\n\n`
})
```

**Use Case:** User creates/edits layers → Chat reflects changes immediately

---

### Extended Context Layers (This Project)

**Purpose:** Store agent configuration from interview responses

```prisma
model ContextLayer {
  // Same base fields
  id          String
  projectId   String
  name        String
  content     String
  priority    Int
  isActive    Boolean
  
  // NEW: Category system
  category    String      // "audience"|"communication"|"content"|"engagement"
  description String?     // Help text for UI
  
  // NEW: Structured metadata
  metadata    Json        // Original interview responses
  /*
  Example metadata:
  {
    "primaryAudience": "board_members",
    "expertiseLevel": "business_executive",
    "emphasisAreas": ["ROI", "risk mitigation"],
    "speculationAllowed": false
  }
  */
}
```

**Category-Based Composition:**
```typescript
// Fetch by category, compose structured prompt
const layers = await prisma.contextLayer.findMany({
  where: { 
    projectId, 
    isActive: true,
    category: { in: ['audience', 'communication', 'content', 'engagement'] }
  },
  orderBy: { priority: 'asc' }
})

// Group by category for structured prompt
const byCategory = {
  audience: layers.filter(l => l.category === 'audience'),
  communication: layers.filter(l => l.category === 'communication'),
  content: layers.filter(l => l.category === 'content'),
  engagement: layers.filter(l => l.category === 'engagement')
}

let prompt = '# AI AGENT CONFIGURATION\n\n'
for (const [category, categoryLayers] of Object.entries(byCategory)) {
  prompt += `## ${category.toUpperCase()}\n\n`
  categoryLayers.forEach(layer => {
    prompt += `### ${layer.name}\n\n${layer.content}\n\n`
  })
}
```

**Use Case:** Interview generates layers → Layers never manually edited → Re-interview to change behavior

---

### Interview Response → Context Layer Mapping

**The Transformation Process:**

```typescript
// INPUT: Interview responses
const responses = {
  primaryAudience: "Board members",
  communicationStyle: "Professional but approachable",
  emphasisAreas: ["ROI projections", "Risk mitigation", "Timeline"],
  speculationAllowed: false,
  proactiveQuestions: ["How does this align with Q3 strategy?"]
}

// OUTPUT: Context Layers

// Layer 1: Audience
{
  category: 'audience',
  priority: 1,
  name: 'Audience Profile',
  content: `
    Primary Audience: Board members
    Expertise Level: Business executive
    Relationship: Advisory
  `,
  metadata: {
    primaryAudience: "Board members",
    expertiseLevel: "business_executive"
  }
}

// Layer 2: Communication
{
  category: 'communication',
  priority: 2,
  name: 'Communication Style',
  content: `
    Tone: Professional but approachable
    Style: Business-focused, clear, and direct
    Citation Style: Always cite specific sections
  `,
  metadata: {
    tone: "professional_approachable"
  }
}

// Layer 3: Content
{
  category: 'content',
  priority: 3,
  name: 'Content Strategy',
  content: `
    Emphasis Areas:
    - ROI projections
    - Risk mitigation
    - Timeline
    
    Speculation: Not allowed - stick to documented facts
  `,
  metadata: {
    emphasisAreas: ["ROI projections", "Risk mitigation", "Timeline"],
    speculationAllowed: false
  }
}

// Layer 4: Engagement
{
  category: 'engagement',
  priority: 4,
  name: 'Engagement Strategy',
  content: `
    Proactive Questions:
    - "How does this align with Q3 strategy?"
  `,
  metadata: {
    proactiveQuestions: ["How does this align with Q3 strategy?"]
  }
}
```

**Why This Design:**
- ✅ **Separation of concerns** - Each category has clear purpose
- ✅ **UI-friendly** - Can display/edit by category
- ✅ **Composable** - Can filter which categories to include
- ✅ **Extensible** - Easy to add new categories
- ✅ **Traceable** - metadata links back to interview responses

---

## Database Schema Migration

### Base System Schema

```prisma
model Project {
  id              String
  name            String
  description     String?
  contextLayers   ContextLayer[]
  knowledgeFiles  KnowledgeFile[]
}

model ContextLayer {
  id          String
  projectId   String
  name        String
  priority    Int
  content     String @db.Text
  isActive    Boolean
  isBuiltIn   Boolean
}

model KnowledgeFile {
  id          String
  projectId   String
  filename    String
  filepath    String
  content     String @db.Text
  metadata    Json?
}
```

### Extended Schema (This Project)

```prisma
// NEW: Multi-tenancy
model User {
  id                String
  email             String @unique
  name              String?
  passwordHash      String?
  role              String @default("creator")
  projects          Project[]
  savedConversations Conversation[]
}

// EXTENDED: Add owner, documents, config
model Project {
  id              String
  ownerId         String              // NEW
  owner           User                // NEW
  name            String
  description     String?
  
  documents       Document[]          // RENAMED from knowledgeFiles
  agentConfig     AgentConfig?        // NEW
  contextLayers   ContextLayer[]
  shareLinks      ShareLink[]         // NEW
  
  totalViews      Int @default(0)     // NEW
  totalConversations Int @default(0)  // NEW
}

// EXTENDED: Add category, metadata
model ContextLayer {
  id          String
  projectId   String
  name        String
  category    String              // NEW: "audience"|"communication"|"content"|"engagement"
  description String?             // NEW
  priority    Int
  content     String @db.Text
  metadata    Json?               // NEW: Structured interview data
  isActive    Boolean
  isBuiltIn   Boolean
}

// RENAMED & EXTENDED: Was KnowledgeFile
model Document {
  id          String
  projectId   String
  filename    String
  filepath    String
  filetype    String              // NEW
  filesize    Int                 // NEW
  
  fullText    String @db.Text
  outline     Json                // NEW: Section structure
  summary     String?             // NEW: AI-generated
  keyTopics   String[]            // NEW
}

// NEW: Agent configuration
model AgentConfig {
  id              String
  projectId       String @unique
  analysisSummary String @db.Text
  interviewData   Json
  configJson      Json
  modelProvider   String @default("openai")
  modelName       String @default("gpt-4")
  temperature     Float @default(0.7)
}

// NEW: Sharing system
model ShareLink {
  id              String
  projectId       String
  shareCode       String @unique
  accessType      String
  password        String?
  whitelist       String[]
  expiresAt       DateTime?
  maxViews        Int?
  currentViews    Int @default(0)
  customContext   Json?    // Future: per-share overrides
  
  accessLogs      AccessLog[]
  conversations   Conversation[]
}

// NEW: Access tracking
model AccessLog {
  id          String
  shareLinkId String
  viewerEmail String?
  viewerIp    String?
  sessionId   String
  accessedAt  DateTime @default(now())
}

// NEW: Conversation tracking
model Conversation {
  id              String
  projectId       String
  shareLinkId     String
  sessionId       String
  viewerEmail     String?
  userId          String?
  
  messages        Json
  duration        Int?
  messageCount    Int @default(0)
  documentsViewed String[]
  
  // AI-generated insights
  summary         String? @db.Text
  keyTopics       String[]
  questions       String[]
  sentiment       String?
  actionItems     String[]
  
  createdAt       DateTime @default(now())
  savedAt         DateTime?
}

// NEW: Analytics
model AnalyticsEvent {
  id              String
  conversationId  String
  eventType       String
  eventData       Json
  timestamp       DateTime @default(now())
}
```

### Migration Steps

If migrating from base system:

```bash
# 1. Create new models
npx prisma migrate dev --name add_users_documents_sharing

# 2. Data migration script
# Convert existing projects
UPDATE projects SET ownerId = 'default-user-id';

# Convert KnowledgeFile → Document
INSERT INTO documents (id, projectId, filename, filepath, filetype, filesize, fullText)
SELECT 
  id, 
  projectId, 
  filename, 
  filepath,
  SUBSTRING(filename FROM '\.(.*)$') as filetype,
  0 as filesize,  -- Set manually if available
  content as fullText
FROM knowledge_files;

# Add category to context layers
UPDATE context_layers SET category = 'content' WHERE category IS NULL;

# 3. Clean up
DROP TABLE knowledge_files;
```

---

## Code Reuse Strategy

### What to Copy Directly

**1. Context Composer Core** (`lib/contextComposer.ts`)

```typescript
// BASE SYSTEM (copy this)
const DEFAULT_CONTEXT = `You are a helpful AI assistant.`

export async function composeContextFromLayers(
  projectId: string
): Promise<string> {
  const layers = await prisma.contextLayer.findMany({
    where: { projectId, isActive: true },
    orderBy: { priority: 'asc' }
  })
  
  if (layers.length === 0) return DEFAULT_CONTEXT
  
  let prompt = '# CONTEXT LAYERS\n\n'
  layers.forEach((layer, idx) => {
    prompt += `## Layer ${idx + 1}: ${layer.name}\n\n`
    prompt += `${layer.content}\n\n---\n\n`
  })
  
  return prompt
}

// THIS PROJECT (extend with categories)
export async function composeAgentContext(
  projectId: string,
  options?: { includeCategories?: string[] }
): Promise<string> {
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
  
  // Group by category for structured composition
  const byCategory = groupBy(layers, 'category')
  
  let prompt = '# AI AGENT CONFIGURATION\n\n'
  for (const [category, categoryLayers] of Object.entries(byCategory)) {
    prompt += `## ${category.toUpperCase()}\n\n`
    categoryLayers.forEach(layer => {
      prompt += `### ${layer.name}\n\n${layer.content}\n\n`
    })
  }
  
  return prompt
}
```

**2. Chat API Route** (`app/api/chat/route.ts`)

```typescript
// BASE SYSTEM (copy structure)
export async function POST(req: Request) {
  const { messages, projectId } = await req.json()
  
  const systemPrompt = await composeContextFromLayers(projectId)
  const coreMessages = convertToCoreMessages(messages)
  
  const result = streamText({
    model: openai('gpt-4'),
    messages: [
      { role: 'system', content: systemPrompt },
      ...coreMessages
    ]
  })
  
  return result.toUIMessageStreamResponse()
}

// THIS PROJECT (add model selection, analytics)
export async function POST(req: Request) {
  const { messages, projectId, sessionId } = await req.json()
  
  // Get agent config for model selection
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId }
  })
  
  const systemPrompt = await composeAgentContext(projectId)
  
  // Select model based on config
  const model = agentConfig?.modelProvider === 'anthropic'
    ? anthropic(agentConfig.modelName)
    : openai(agentConfig.modelName || 'gpt-4')
  
  const result = streamText({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...convertToCoreMessages(messages)
    ],
    onFinish: async (result) => {
      // Log analytics
      await logChatMessage(projectId, sessionId, result)
    }
  })
  
  return result.toUIMessageStreamResponse()
}
```

**3. Frontend Chat Hook** (`useChat`)

```typescript
// BASE SYSTEM (copy directly)
const { messages, sendMessage, status } = useChat({
  api: '/api/chat',
  body: { projectId }
})

// THIS PROJECT (same pattern, add sessionId)
const { messages, sendMessage, status } = useChat({
  api: '/api/chat',
  body: { 
    projectId,
    sessionId: generateSessionId()
  }
})
```

### What to Modify

**1. Layer CRUD APIs**

```typescript
// BASE: User can create/edit layers freely
POST /api/context-layers
PATCH /api/context-layers/:id
DELETE /api/context-layers/:id

// THIS PROJECT: Layers generated from interview, not directly edited
// Users don't create layers manually
// Layers created by interview processor
// UI shows layers but editing goes back to interview
```

**2. Database Queries**

```typescript
// BASE: Simple project query
const project = await prisma.project.findUnique({
  where: { id },
  include: { contextLayers: true, knowledgeFiles: true }
})

// THIS PROJECT: Add user ownership check
const project = await prisma.project.findUnique({
  where: { id, ownerId: userId },  // Verify ownership
  include: { 
    contextLayers: { where: { isActive: true } },
    documents: true,
    agentConfig: true,
    shareLinks: true
  }
})
```

### What's Completely New

**1. Interview System** (`lib/interviewProcessor.ts`)
- Progressive questioning logic
- Response validation
- Context layer generation from responses
- Agent config compilation

**2. Document Processing** (`lib/documentProcessor.ts`)
- PDF/DOCX/XLSX text extraction
- Outline/TOC generation
- Section mapping for references
- AI summary generation

**3. Sharing System** (`lib/shareManager.ts`)
- Share link generation
- Access control (password, whitelist, email)
- Expiration handling
- View counting

**4. Analytics System** (`lib/analytics.ts`)
- Conversation tracking
- Event logging
- AI summary generation
- Creator insights dashboard

**5. Document Reference Parser** (`lib/documentReferences.ts`)
- Parse `[DOC:filename:section]` markers from LLM
- Trigger document viewer
- Auto-scroll to sections
- Highlight referenced content

---

## Integration Points

### Where Base System Connects to New Features

**1. Context Composition → Document References**

```typescript
// Base system composes context
const systemPrompt = await composeContextFromLayers(projectId)

// THIS PROJECT adds document outlines to context
const documentOutlines = await getDocumentOutlines(projectId)
const fullPrompt = `${systemPrompt}\n\n${documentOutlines}`

// Document outlines teach LLM about available documents
/*
# AVAILABLE DOCUMENTS

## financial_projections.pdf
Summary: 18-month financial forecast with ROI analysis

Sections:
- Section 3.2: ROI Analysis [section-id: section-3-2]
- Section 4.1: Revenue Model [section-id: section-4-1]
*/
```

**2. Chat API → Analytics Logging**

```typescript
// Base system just streams response
const result = streamText({ ... })
return result.toUIMessageStreamResponse()

// THIS PROJECT logs every message
const result = streamText({
  ...,
  onFinish: async (result) => {
    await prisma.conversation.update({
      where: { sessionId },
      data: {
        messages: { push: { role: 'assistant', content: result.text } },
        messageCount: { increment: 1 }
      }
    })
    
    await prisma.analyticsEvent.create({
      data: {
        conversationId,
        eventType: 'message_sent',
        eventData: { tokensUsed: result.usage.totalTokens }
      }
    })
  }
})
```

**3. useChat Hook → Document Viewer Sync**

```typescript
// Base system just displays messages
messages.map(msg => <div>{msg.content}</div>)

// THIS PROJECT parses document references
messages.map(msg => {
  const parsed = parseDocumentReferences(msg.content)
  
  return (
    <div>
      {parsed.text}
      {parsed.references.map(ref => (
        <button onClick={() => openDocument(ref)}>
          📄 View {ref.filename} - {ref.section}
        </button>
      ))}
    </div>
  )
})
```

---

## Implementation Roadmap

### Phase 1: Port Base System (Week 1)

**Goal:** Get basic context composition working

- [ ] Copy `lib/contextComposer.ts` structure
- [ ] Copy `app/api/chat/route.ts` streaming logic
- [ ] Copy database schema (Project, ContextLayer)
- [ ] Copy frontend `useChat` implementation
- [ ] Test: Create project, add layer, chat works

**Files to Copy:**
- `lib/contextComposer.ts` → Modify for categories
- `app/api/chat/route.ts` → Keep streaming pattern
- `lib/db.ts` → Prisma client setup

### Phase 2: Add Extensions (Week 2)

**Goal:** Enhance for multi-tenancy and categories

- [ ] Add User model to schema
- [ ] Add `category` field to ContextLayer
- [ ] Add `ownerId` to Project
- [ ] Update context composer for category filtering
- [ ] Test: Multiple users, categorized layers

**Files to Create:**
- Migration: `add_users_and_categories.sql`
- Auth: `lib/auth.ts` (NextAuth setup)

### Phase 3: Interview System (Week 2-3)

**Goal:** Generate layers from interview

- [ ] Create interview UI component
- [ ] Build `lib/interviewProcessor.ts`
- [ ] Create `AgentConfig` model
- [ ] Implement layer generation logic
- [ ] Test: Interview creates correct layers

**Files to Create:**
- `components/Interview.tsx`
- `lib/interviewProcessor.ts`
- `app/api/interview/route.ts`

### Phase 4: Documents (Week 3-4)

**Goal:** Document upload, extraction, storage

- [ ] Create `Document` model (replace KnowledgeFile)
- [ ] Build `lib/documentProcessor.ts`
- [ ] Add upload API route
- [ ] Extract text + outlines from PDFs/DOCX
- [ ] Test: Upload docs, view extracted content

**Files to Create:**
- `lib/documentProcessor.ts`
- `app/api/documents/upload/route.ts`
- Document viewers: PDF.js, Mammoth.js integration

### Phase 5: Sharing (Week 4)

**Goal:** Share links with access control

- [ ] Create `ShareLink`, `AccessLog` models
- [ ] Build `lib/shareManager.ts`
- [ ] Add share API routes
- [ ] Implement access gate UI
- [ ] Test: Generate link, access with restrictions

**Files to Create:**
- `lib/shareManager.ts`
- `app/api/share/route.ts`
- `app/s/[shareCode]/page.tsx` (viewer experience)

### Phase 6: Analytics (Week 5)

**Goal:** Track conversations, generate insights

- [ ] Create `Conversation`, `AnalyticsEvent` models
- [ ] Build `lib/analytics.ts`
- [ ] Log all chat events
- [ ] Generate AI summaries
- [ ] Creator dashboard
- [ ] Test: View conversation insights

**Files to Create:**
- `lib/analytics.ts`
- `app/api/analytics/route.ts`
- `components/AnalyticsDashboard.tsx`

### Phase 7: Document References (Week 6)

**Goal:** LLM can trigger document opens

- [ ] Build `lib/documentReferences.ts` parser
- [ ] Add reference markers to system prompt
- [ ] Frontend parses `[DOC:...]` markers
- [ ] Document viewer auto-opens and scrolls
- [ ] Test: LLM references doc, viewer opens it

**Files to Create:**
- `lib/documentReferences.ts`
- Update `components/Chat.tsx` with parser
- Update `components/DocumentViewer.tsx` with auto-scroll

---

## Summary

**What We're Building:**
```
Base LLM System (proven)
    +
Multi-tenant extensions
    +
Document processing
    +
Interview → context generation
    +
Sharing & analytics
    =
Conversational Document IDE
```

**Key Principles:**
1. ✅ **Reuse proven patterns** - Don't rebuild what works
2. ✅ **Extend thoughtfully** - Add fields, don't replace models
3. ✅ **Compose elegantly** - Categories make composition cleaner
4. ✅ **Log everything** - Analytics = product value
5. ✅ **Test incrementally** - Each phase builds on previous

**Success Criteria:**
- Context composition works identically to base system
- Categories make prompt construction cleaner
- Interview generates correct layers automatically
- Documents enhance context without breaking composition
- Sharing works without touching core chat logic
- Analytics provide creator value

---

**Next Steps:** Start with Phase 1 - port the base system and verify context composition works. Then add extensions incrementally.
