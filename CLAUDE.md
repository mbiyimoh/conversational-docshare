# Conversational Document IDE - Claude Context

## Working with This User

**User Profile:** Technically literate product owner (runs a marketplace app) but NOT an engineer. Prefers Claude Code to handle technical operations whenever possible.

**Critical Preferences:**
- ❌ **NEVER ask user to run CLI commands** - Claude Code MUST execute them directly using Bash tool
- ❌ **NEVER ask user to check database** - Use Prisma CLI or direct SQL queries via Bash
- ❌ **NEVER provide "run this command" instructions** - Just run it yourself
- ✅ **Claude Code should run ALL commands proactively** - npm, git, docker, database, prisma, etc.
- ✅ **Use automation tools** (Docker, scripts, Task agents) to minimize manual steps
- ✅ **Explain technical decisions clearly** but don't require deep engineering knowledge
- ✅ **Handle errors autonomously** when possible, only escalate when user input truly needed
- ✅ **User's goal: Never touch code or CLI personally** - Claude handles 100% of technical operations

**Example of Good Flow:**
```
User: "Start the database"
Claude: [Uses Bash tool to run docker-compose up -d]
Claude: "Database started successfully! Here's the status: [output]"
```

**Example of Bad Flow:**
```
User: "Start the database"
Claude: "You'll need to run: docker-compose up -d"
```

When technical blockers arise, Claude should propose solutions and implement them rather than documenting steps for the user to execute manually.

---

## Test Credentials

**User Email:** mbiyimoh@gmail.com
**Password:** MGinfinity09!

These credentials are used for testing and E2E automation. Always use these for Playwright tests and manual testing workflows.

---

## Project Purpose & Strategic Vision

**Client/User:** Consultants, founders, executives sharing complex document sets with boards, investors, and stakeholders

**Strategic Question:** How do we transform static document sharing into intelligent, conversational experiences personalized for specific audiences?

**Core Problem Solved:** Traditional document sharing (DocSend, Notion, PDFs) forces recipients to read everything and guess what's important. This platform creates AI representatives that understand documents intimately and communicate in the exact tone/style specified by the creator.

### Platform Vision

A **chat-first document sharing platform** where creators upload documents, configure an AI agent through a conversational interview, and share with recipients who engage through natural conversation instead of static reading.

**Key Differentiator:** AI agent onboarding system that transforms static document sets into intelligent, audience-specific conversational experiences.

**Market Position:** Bridges gap between static document tools (DocSend, Notion) and general AI chat (ChatGPT). Professional document sharing with conversational AI.

### User Types & Journey Phases

**3 Primary User Types:**
1. **Document Creators** (consultants, founders) - Upload docs, configure agent, share, monitor analytics
2. **Document Viewers** (board members, investors) - Access via link, chat with AI, optionally save conversation
3. **Platform Admins** (future) - System monitoring and management

**12 Experience Phases:**
- **Phases 1-6** (Creator): Discovery → Upload → AI Analysis → Interview → Preview → Share (30-45 min total)
- **Phases 7-9** (Viewer): Access → Conversation → Optional Conversion (15-25 min first visit)
- **Phases 10-12** (Creator): Analytics → Iteration → Retention (ongoing)

**Key Metrics:**
- Creator first project: <45 minutes from sign-up to share
- Viewer engagement: >5 questions per session, >15 minutes
- Conversion rate: >40% viewers create accounts
- Creator retention: >80% return within week

---

## Core Innovation: Interview → Context Layers → AI Behavior

**The Magic:** Interview responses automatically generate context layers that control AI agent behavior.

### How It Works

```
Interview Questions          Context Layers              AI Agent Behavior
─────────────────────────────────────────────────────────────────────────

"Who's your audience?"   →   AUDIENCE Layer          →   Speaks appropriately
"Board members"              - Primary: board_members     to executives
                             - Expertise: business
                             - Dynamic: advisory

"Communication style?"   →   COMMUNICATION Layer     →   Uses professional
"Professional but            - Tone: professional_        tone with business
 approachable"                approachable                language + examples
                             - Examples: true

"What to emphasize?"     →   CONTENT Layer           →   Prioritizes these
"ROI, risks, timeline"       - Emphasis: [ROI, risks,     topics in all
                               timeline]                   responses
                             - Speculation: false

"Proactive questions?"   →   ENGAGEMENT Layer        →   Asks strategic
"How align with Q3?"         - Questions: [...]           questions during
                             - Actions: [follow-ups]      conversation
```

**At Runtime:**
1. Viewer sends chat message
2. Backend calls `buildSystemPrompt(projectId)`
3. Fetches all active context layers ordered by priority
4. Composes structured system prompt grouped by category
5. LLM receives full context before responding

**Result:** AI behaves exactly as configured during interview, without any hardcoding.

---

## Architecture

**Built on Proven Foundation:**
Extends an existing production-tested LLM system with multi-layer context composition (documented in `context-and-knowledge-LLM-synthesis.md`).

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CREATOR EXPERIENCE                        │
└─────────────────────────────────────────────────────────────┘

Upload Documents → AI Analysis → Interview → Context Layers → Share Links
     │                  │            │              │               │
  PDF/DOCX/XLSX    Extract text   5-10 Qs    4 Categories:    Access control
  Mammoth.js       Outline        Progressive  - Audience      Password/Email
  SheetJS          Summary        questioning  - Communication Whitelist
  pdf-parse        Topics                      - Content       Expiration
                                                - Engagement


┌─────────────────────────────────────────────────────────────┐
│                    VIEWER EXPERIENCE                         │
└─────────────────────────────────────────────────────────────┘

Access Link → Email Gate → Chat Interface → Documents Auto-Open
                  │              │                    │
              30% drop        Vercel AI SDK      [DOC:file:section]
              Friction        Streaming chat      Parser triggers
              point           Context layers      viewer panel
```

### Tech Stack

**Frontend:**
- React + Vite + TypeScript
- Tailwind CSS
- shadcn/ui components (via shadcn MCP for AI-assisted generation)
- PDF.js (PDF rendering)
- Mammoth.js (Word docs)
- SheetJS (Excel)
- Framer Motion (animations)

**Backend:**
- Express.js + TypeScript
- PostgreSQL + Prisma ORM
- Vercel AI SDK (swappable LLM providers: OpenAI, Anthropic)
- pdf-parse (text extraction)

**Deployment:**
- Docker Compose (frontend container, backend container, document storage volume)

### Database Schema (Key Models)

**Base System (Reused):**
- `Project` - Container for documents and configuration
- `ContextLayer` - Modular AI behavior components (ordered by priority)

**Extended with Categories:**
```prisma
model ContextLayer {
  id          String
  projectId   String
  name        String
  category    String      // "audience"|"communication"|"content"|"engagement"
  priority    Int
  content     String      // LLM-readable text
  metadata    Json        // Original interview responses
  isActive    Boolean
}
```

**New Models:**
- `User` - Multi-tenant creator accounts
- `Document` - Uploaded files with extracted text, outlines, summaries
- `AgentConfig` - Compiled agent configuration from interview
- `ShareLink` - Share codes with access control (password, email gate, whitelist)
- `Conversation` - Tracked viewer sessions with AI-generated summaries
- `AccessLog` - Viewer access events
- `AnalyticsEvent` - Granular interaction tracking

---

## Critical Patterns

### 1. Context Layer Composition (MANDATORY)

**Base Pattern (from existing system):**
```typescript
// Fetch active layers, ordered by priority
const layers = await prisma.contextLayer.findMany({
  where: { projectId, isActive: true },
  orderBy: { priority: 'asc' }
})

// Compose into system prompt
let prompt = '# CONTEXT LAYERS\n\n'
layers.forEach(layer => {
  prompt += `## ${layer.name}\n\n${layer.content}\n\n`
})
```

**Extended Pattern (this project):**
```typescript
// Category-aware composition
const layers = await prisma.contextLayer.findMany({
  where: {
    projectId,
    isActive: true,
    category: { in: ['audience', 'communication', 'content', 'engagement'] }
  },
  orderBy: { priority: 'asc' }
})

// Group by category for structured prompt
const byCategory = groupBy(layers, 'category')

let prompt = '# AI AGENT CONFIGURATION\n\n'
for (const [category, categoryLayers] of Object.entries(byCategory)) {
  prompt += `## ${category.toUpperCase()}\n\n`
  categoryLayers.forEach(layer => {
    prompt += `### ${layer.name}\n\n${layer.content}\n\n`
  })
}
```

**Why This Design:**
- ✅ Modular - Each category is independent
- ✅ Ordered - Consistent composition via priority
- ✅ Cacheable - Context composed once per chat
- ✅ Extensible - Add new categories easily
- ✅ Traceable - Metadata links to interview

### 2. Interview Response Processing

**Transform interview into context layers:**

```typescript
// INPUT: Interview responses
const responses = {
  primaryAudience: "Board members",
  communicationStyle: "Professional but approachable",
  emphasisAreas: ["ROI", "Risk mitigation", "Timeline"],
  speculationAllowed: false
}

// OUTPUT: 3-4 Context Layers (audience, communication, content, engagement)
await createContextLayersFromInterview(projectId, responses)

// Creates layers with:
// - category: Groups related config
// - priority: Composition order (1-4)
// - content: Plain text for LLM
// - metadata: Structured JSON for UI
```

**Layers are NEVER manually edited** - creator re-runs interview to change behavior.

### 3. Document Processing & References

**Upload Flow:**
```typescript
// Extract content based on file type
const { fullText, outline } = await extractDocument(file)

// Generate AI summary and topics
const summary = await generateDocumentSummary(fullText)
const keyTopics = await extractKeyTopics(fullText)

// Store in database
await prisma.document.create({
  data: { projectId, filename, fullText, outline, summary, keyTopics }
})
```

**Document Reference System:**
```typescript
// LLM includes markers in responses
"According to the Financial Projections [DOC:financial.pdf:section-3-2],
the ROI is 35% over 18 months."

// Frontend parser detects markers
const parsed = parseDocumentReferences(messageContent)

// Triggers document viewer
parsed.references.forEach(ref => {
  openDocument(ref.filename, ref.sectionId)
  scrollToSection(ref.sectionId)
  highlightSection(ref.sectionId)
})
```

### 4. Share Link Access Control

**Access Types:**
- `public_password` - Anyone with link + password
- `email_required` - Must provide email (30% drop-off, but captures leads)
- `whitelist` - Pre-approved email list only

**Access Flow:**
```typescript
// Check access requirements
const shareLink = await prisma.shareLink.findUnique({
  where: { shareCode }
})

if (shareLink.accessType === 'whitelist') {
  if (!shareLink.whitelist.includes(viewerEmail)) {
    return DENIED
  }
}

// Log access
await prisma.accessLog.create({
  data: { shareLinkId, viewerEmail, sessionId }
})
```

### 5. Analytics & Conversation Tracking

**Track all interactions:**
```typescript
// During chat
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

// Generate AI summary for creator
const summary = await generateConversationSummary(conversation)
await prisma.conversation.update({
  where: { id },
  data: { summary, keyTopics, questions, sentiment, actionItems }
})
```

---

## AI-Generated Content Formatting (ProfileSectionContent)

**What it does:** Renders AI-generated content (from interviews, profiles) with proper formatting - handles mixed JSON/markdown from OpenAI responses.

**Key files:**
- `frontend/src/components/ProfileSectionContent.tsx` - Smart content renderer

**Pattern: Content Type Detection & Preprocessing**

The backend generates content in mixed formats:
- Some fields are pure JSON
- Some are markdown with `**boldKey**:` patterns
- Some have inline bullets `• item • item`
- Some have inline JSON objects `{"from":"...", "to":"..."}`

```typescript
// The component preprocesses all content before rendering:
// 1. Pure JSON → converted to markdown with headers
// 2. **camelCaseKey**: → converted to "## Title Case" headers
// 3. Inline bullets → converted to proper list items
// 4. Inline JSON objects → converted to blockquotes
// 5. Everything goes through ReactMarkdown for final rendering
```

**Gotchas:**
- OpenAI often returns camelCase keys in responses - always convert to Title Case for display
- `**key**:` pattern is common - strip the `**` and convert the key
- Inline bullets need regex splitting, not just line-by-line processing
- ReactMarkdown needs custom components for consistent styling

**Extending this:**
- Add new content patterns to `preprocessContent()` function
- Add special JSON patterns to `convertJsonToMarkdown()` function
- Use `camelToTitle()` utility for any camelCase → Title Case conversion

---

## Key Implementation Details

### Document Outline Extraction

**PDF Processing:**
- Use pdf-parse for text extraction
- Detect headings by font size/style
- Create hierarchical outline with section IDs
- Map sections to page numbers and character ranges

**Word Doc Processing:**
- Mammoth.js preserves heading structure natively
- Extract `<h1>`, `<h2>`, etc. tags = document structure
- Generate section IDs for references

**Document Outlines in LLM Context:**
```markdown
# AVAILABLE DOCUMENTS

## financial_projections.pdf
Summary: 18-month forecast with ROI analysis

Sections:
- Section 3.2: ROI Analysis [section-id: section-3-2]
- Section 4.1: Revenue Model [section-id: section-4-1]
```

### Chat API Integration (Vercel AI SDK)

```typescript
// app/api/chat/route.ts
export async function POST(req: Request) {
  const { messages, projectId, sessionId } = await req.json()

  // 1. Compose system prompt from context layers + document outlines
  const systemPrompt = await buildSystemPrompt(projectId)

  // 2. Get agent config for model selection
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId }
  })

  // 3. Select model (swappable: OpenAI, Anthropic)
  const model = agentConfig?.modelProvider === 'anthropic'
    ? anthropic(agentConfig.modelName)
    : openai(agentConfig.modelName || 'gpt-4')

  // 4. Stream with analytics
  const result = streamText({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...convertToCoreMessages(messages)
    ],
    onFinish: async (result) => {
      await logChatMessage(projectId, sessionId, result)
    }
  })

  return result.toUIMessageStreamResponse()
}
```

### Frontend Layout (IDE-inspired)

**3-Panel Layout:**
1. **File Explorer Sidebar** (collapsible, ~200px) - Document tree
2. **Main Chat Panel** (60-70% width) - Primary interaction
3. **Document Viewer Panel** (30-40% width) - Auto-opens on references

**Responsive:**
- Desktop: Full three-panel layout
- Tablet: Collapsible sidebar, panel switching
- Mobile: Single panel with modal document viewing

---

## Development Phases

### Phase 1: MVP Core (4-6 weeks)
**Goal:** Single-tenant prototype

**Features:**
- Document upload (PDF only initially)
- Basic AI analysis & summary
- Simple context interview (5 essential questions)
- Public link sharing with password
- Chat interface with document viewer
- Basic document reference system

**Tech:** React + Vite, Express.js, PostgreSQL, PDF.js, OpenAI GPT-4

### Phase 2: Multi-Document & Analytics (2-3 weeks)
**Features:**
- Support DOCX, XLSX, Markdown
- Document outline extraction
- Creator analytics dashboard
- Conversation summaries
- Email notifications

**Tech:** Mammoth.js, SheetJS, SendGrid

### Phase 3: Multi-Tenant & Accounts (3-4 weeks)
**Features:**
- User registration & authentication
- Multi-tenant project management
- Viewer account creation (optional)
- Conversation saving for viewers
- Access control (email gating, whitelist)
- Subscription tiers

**Tech:** JWT auth, Stripe integration

### Phase 4: Polish & Scale (2-3 weeks)
**Features:**
- White-label options
- Custom domain support
- Advanced analytics
- Export capabilities (PDFs)
- Mobile-responsive design
- Performance optimization

---

## Usage

### For Creators (Document Upload → Share)

```bash
# 1. Sign up and create project
POST /api/auth/register
POST /api/projects

# 2. Upload documents
POST /api/projects/:id/documents
# Supports: PDF, DOCX, XLSX, MD

# 3. Trigger AI analysis
POST /api/projects/:id/analyze
# Returns: Document summaries, key topics, suggested questions

# 4. Complete interview (5-10 questions)
POST /api/projects/:id/context-interview
# Body: { responses: { primaryAudience, communicationStyle, ... } }
# Generates: Context layers automatically

# 5. Preview agent
GET /api/projects/:id/agent-config
# Test how agent will behave

# 6. Create share link
POST /api/projects/:id/share
# Body: { accessType, password?, whitelist?, expiresAt? }
# Returns: https://app.com/s/{shareCode}
```

### For Viewers (Access → Chat)

```bash
# 1. Access share link
GET /s/{shareCode}
# May require: password, email, whitelist verification

# 2. Start conversation
POST /api/chat/:projectId/message
# AI responds based on context layers

# 3. Documents auto-open when AI references them
# AI: "According to Financial Projections [DOC:financial.pdf:section-3-2]..."
# Frontend: Opens document viewer, scrolls to section, highlights

# 4. Optional: Save conversation
POST /api/chat/:projectId/save
# Requires account creation
```

### For Creators (Analytics)

```bash
# View engagement metrics
GET /api/projects/:id/analytics
# Returns: Total views, conversations, avg time spent

# View all conversations
GET /api/projects/:id/conversations
# Returns: List with summaries, key topics, sentiment

# View specific conversation details
GET /api/conversations/:id
# Returns: Full transcript, AI-generated insights, action items
```

---

## Repository Structure

```
/conversational-docshare
├── README.md                           # Complete documentation package overview
├── QUICK-START-GUIDE.md                # How to use spec + journeys together
├── DOCUMENT-MAP.txt                    # ASCII navigation guide
├── ARCHITECTURE-INTEGRATION.md         # How base system connects to new features
├── conversational-document-ide-spec.md # Full technical specification (45 pages)
├── user-journey-flows.xlsx             # 3-sheet workbook (Matrix, Flows, Metrics)
│
├── frontend/                           # React + Vite application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.tsx             # IDE-like 3-panel layout
│   │   │   ├── Chat.tsx               # Main chat interface
│   │   │   ├── DocumentViewer.tsx     # PDF/DOCX/XLSX rendering
│   │   │   ├── FileExplorer.tsx       # Document tree sidebar
│   │   │   ├── Interview.tsx          # Agent configuration interview
│   │   │   ├── AnalyticsDashboard.tsx # Creator insights
│   │   │   └── ShareModal.tsx         # Share link configuration
│   │   ├── lib/
│   │   │   ├── documentReferences.ts  # Parse [DOC:...] markers
│   │   │   └── api.ts                 # API client
│   │   └── pages/
│   │       ├── dashboard.tsx          # Creator projects list
│   │       ├── project/[id].tsx       # Project detail/config
│   │       └── s/[shareCode].tsx      # Viewer experience
│   └── package.json
│
├── backend/                            # Express.js API
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts                # Registration, login
│   │   │   ├── projects.ts            # CRUD for projects
│   │   │   ├── documents.ts           # Upload, process documents
│   │   │   ├── chat.ts                # Streaming chat API
│   │   │   ├── share.ts               # Share link management
│   │   │   └── analytics.ts           # Conversation insights
│   │   ├── lib/
│   │   │   ├── contextComposer.ts     # Build system prompts from layers
│   │   │   ├── interviewProcessor.ts  # Responses → Context layers
│   │   │   ├── documentProcessor.ts   # Extract text/outline from files
│   │   │   ├── shareManager.ts        # Access control logic
│   │   │   ├── analytics.ts           # Track conversations, generate summaries
│   │   │   └── db.ts                  # Prisma client
│   │   └── prisma/
│   │       └── schema.prisma          # Database models
│   └── package.json
│
├── shared/                             # Shared TypeScript types
│   └── types.ts
│
├── docker-compose.yml                  # Frontend + Backend + PostgreSQL
└── .env.example                        # Required environment variables
```

---

## Reference Documentation

**For Understanding the Project:**
- `README.md` - Start here! Complete overview
- `QUICK-START-GUIDE.md` - How to use docs together
- `ARCHITECTURE-INTEGRATION.md` - Base system → Extensions mapping
- `user-journey-flows.xlsx` - User psychology, metrics, flows

**For Building Features:**
- `conversational-document-ide-spec.md` - Technical specs, wireframes, APIs
- Sheet 1 (User Journeys Matrix) - What users do at each phase
- Sheet 2 (Journey Flow Diagrams) - Step-by-step with timing
- Sheet 3 (Key Success Metrics) - Target KPIs

**Key Sections in Spec:**
- "Existing System Integration" (p. 39-50) - How context layers work
- "Technical Architecture" (p. 51-60) - Frontend/backend/database
- "Core Features & Workflows" (p. 61-80) - 5 feature deep dives
- "UI/UX Specifications" (p. 81-110) - 15 detailed wireframes

**Cross-Reference System:**
📊 markers in spec point to relevant journey phases. Use these!

---

## Key Concepts to Remember

**12 Experience Phases:**
Phases 1-6 (Creator), Phases 7-9 (Viewer), Phases 10-12 (Creator analytics/iteration)

**4 Context Layer Categories:**
Audience, Communication, Content, Engagement (ordered by priority)

**Document Reference Format:**
`[DOC:filename:section-id]` triggers auto-open + scroll + highlight

**Access Types:**
public_password (lowest friction), email_required (30% drop but captures leads), whitelist (highest security)

**Success Metrics:**
Creator first project <45 min, Viewer >5 questions, Conversion >40%, Retention >80% week 1 return

**Tech Integration:**
Extends proven LLM architecture (context-and-knowledge-LLM-synthesis.md) with multi-tenancy, documents, sharing, analytics

---

## Critical Rules

**Context Layer Management:**
- ❌ NEVER allow manual layer editing by creators
- ✅ ALWAYS generate layers from interview responses
- ✅ To change behavior → re-run interview → regenerate layers
- ✅ Layers are derived state, interview is source of truth

**Document Processing:**
- ✅ ALWAYS extract full text to database (fast retrieval)
- ✅ ALWAYS generate outlines for navigation
- ✅ ALWAYS create AI summaries for context
- ✅ Store in DB, not just file system (scalability)

**Analytics:**
- ✅ ALWAYS log every viewer interaction
- ✅ ALWAYS generate conversation summaries for creators
- ✅ Track: messages, documents viewed, time spent, questions asked
- ✅ Generate: sentiment, action items, key topics

**Access Control:**
- ✅ ALWAYS require some form of access verification
- ✅ Log all access attempts (even denied)
- ✅ Support expiration and view limits
- ✅ Email gating = friction but valuable for creator

---

## Next Steps

**To Start Development:**
1. Read `README.md` (10 min) - Understand doc structure
2. Read `ARCHITECTURE-INTEGRATION.md` (30 min) - Understand base system
3. Read `QUICK-START-GUIDE.md` (20 min) - Learn workflow
4. Skim spec sections: Executive Summary, Product Vision, Technical Architecture
5. Review User Journeys Matrix in Excel file

**To Build a Feature:**
1. Check User Journeys Matrix - Which phases?
2. Read Journey Flow Diagrams - Detailed steps + psychology
3. Note Key Success Metrics - What defines success?
4. Reference spec section - Technical implementation
5. Use wireframes - UI design
6. Generate components - shadcn MCP

**Development Order (Follow Phase Plan):**
Phase 1 → Phase 2 → Phase 3 → Phase 4 (see Development Phases section above)

---

**🎯 Ready to build:** This project has everything needed - proven architecture, detailed specs, user psychology, metrics, and a clear roadmap. Start with Phase 1 MVP and iterate based on real user data! 🚀
