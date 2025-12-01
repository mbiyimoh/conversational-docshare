# Phase 1 Architecture Overview - Developer Guide

**Last Updated:** November 2025
**Phase:** MVP Core (Phase 1)
**Status:** Backend Complete | Frontend 40% Complete

---

## 0. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACES                              │
└──────────────────────────────────────────────────────────────────────┘
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React + Vite)                          │
│  Port: 3000/3033                                                      │
│                                                                        │
│  Pages (40% Complete):                                                │
│  ✅ LoginPage → POST /api/auth/login                                  │
│  ✅ RegisterPage → POST /api/auth/register                            │
│  ✅ DashboardPage → GET /api/projects                                 │
│  ❌ ProjectPage (STUB) → Multi-component orchestration                │
│  ❌ SharePage (STUB) → Viewer experience                              │
│                                                                        │
│  Components (100% Complete):                                          │
│  ✅ DocumentUpload   ✅ AgentInterview   ✅ ChatInterface              │
│  ✅ DocumentViewer   ✅ AnalyticsDashboard                             │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
                                  ↓
                            HTTP/JSON API
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│                    BACKEND API (Express.js)                           │
│  Port: 4000                                                           │
│                                                                        │
│  Routes (100% Complete):                                              │
│  /api/auth           → Auth Controller    (Login, Register)           │
│  /api/projects       → Project Controller (CRUD)                      │
│  /api/documents      → Document Controller (Upload, Process)          │
│  /api/agent          → Agent Controller   (Interview, Config)         │
│  /api/chat           → Chat Controller    (Streaming Responses)       │
│  /api/share          → ShareLink Controller (Access Control)          │
│  /api/analytics      → Analytics Controller (Metrics, Insights)       │
│                                                                        │
│  Middleware:                                                          │
│  • Authentication (JWT)                                                │
│  • Rate Limiting                                                       │
│  • Error Handling                                                      │
│  • CORS                                                                │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│                         SERVICE LAYER                                 │
│                                                                        │
│  documentProcessor   → Extract text/outline from PDF/DOCX/XLSX        │
│  documentChunker     → Split documents into vector-embeddable chunks  │
│  embeddingService    → Generate OpenAI embeddings for RAG             │
│  contextService      → Build system prompts from context layers       │
│  chatService         → Stream LLM responses (Vercel AI SDK)           │
│  processingQueue     → Background document processing                 │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│                      DATA LAYER (Prisma ORM)                          │
│                                                                        │
│  Core Models:                                                         │
│  • User              → Multi-tenant creator accounts                  │
│  • Project           → Container for documents + config               │
│  • Document          → Uploaded files with extracted content          │
│  • DocumentChunk     → Vector embeddings for RAG (pgvector)           │
│  • AgentConfig       → Interview responses + model settings           │
│  • ContextLayer      → Modular AI behavior (4 categories)             │
│  • ShareLink         → Access-controlled share codes                  │
│  • Conversation      → Tracked viewer sessions                        │
│  • Message           → Chat history with citations                    │
│  • AnalyticsEvent    → Granular interaction tracking                  │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│               DATABASE (PostgreSQL + pgvector)                        │
│  Hosted: Supabase (via Connection Pooler)                             │
│  Extensions: pgvector for 1536-dim embeddings                         │
│                                                                        │
│  Connection:                                                          │
│  • DATABASE_URL (Transaction mode, port 6543)                         │
│  • DIRECT_URL (Session mode, port 5432, migrations only)              │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                                  │
│                                                                        │
│  OpenAI API:                                                          │
│  • text-embedding-3-small (1536 dims) → Document embeddings           │
│  • gpt-4-turbo-preview → Chat responses                               │
│                                                                        │
│  File Storage:                                                        │
│  • Local uploads/ directory (Phase 1)                                 │
│  • Future: S3-compatible storage (Phase 4)                            │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘

Data Flow:
 Creator → Upload → Process → Interview → Context Layers → Share Link
 Viewer  → Access → Chat    → RAG Search → LLM Response  → Document Ref
```

---

## 1. Dependencies & Key Functions

### External Dependencies

**Backend:**
- **Express.js 4.19.2** - HTTP server framework
- **@prisma/client 5.20.0** - Type-safe database ORM
- **OpenAI 4.72.0** - LLM API client for chat + embeddings
- **pdf-parse 1.1.1** - PDF text extraction
- **mammoth 1.8.0** - DOCX to HTML/text conversion
- **xlsx 0.18.5** - Excel file parsing
- **bcrypt 5.1.1** - Password hashing
- **jose 5.9.6** - JWT token management
- **multer 1.4.5** - File upload middleware
- **pgvector 0.2.0** - PostgreSQL vector extension client
- **zod 3.23.8** - Runtime type validation

**Frontend:**
- **React 18.3.1 + Vite 6.0.3** - UI framework + build tool
- **React Router DOM 7.1.1** - Client-side routing
- **@tanstack/react-query 5.62.11** - Server state management
- **ai 4.0.28** - Vercel AI SDK for streaming chat
- **Tailwind CSS 3.4.17** - Utility-first CSS
- **Radix UI** - Accessible component primitives
- **zustand 5.0.2** - Lightweight state management

### Internal Dependencies

**Backend Service Imports:**
```typescript
// services/documentProcessor.ts
export { processDocument, extractOutline, generateSummary }

// services/embeddingService.ts
export { generateEmbedding, searchSimilarChunks }

// services/contextService.ts
export { buildSystemPrompt, createContextLayers }

// services/chatService.ts
export { streamChatResponse }

// services/processingQueue.ts
export { startProcessingQueue }
```

**Frontend API Client:**
```typescript
// lib/api.ts
export const api = {
  auth: { login, register, getMe },
  projects: { getAll, create, update, delete },
  documents: { upload, list, delete },
  agent: { saveConfig, getConfig },
  chat: { createConversation, sendMessage },
  share: { createLink, getBySlug },
  analytics: { getProjectAnalytics, getConversation }
}
```

### Configuration Requirements

**Environment Variables (.env):**
```bash
# Database (Required)
DATABASE_URL="postgresql://postgres.xxx:password@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxx:password@aws-1-us-east-1.pooler.supabase.com:5432/postgres"

# Auth (Required)
JWT_SECRET="min 32 characters, use: openssl rand -base64 48"

# OpenAI (Required)
OPENAI_API_KEY="sk-proj-..."
EMBEDDING_MODEL="text-embedding-3-small"  # 1536 dimensions
CHAT_MODEL="gpt-4-turbo-preview"

# Server (Optional)
PORT=4000
CORS_ORIGIN="http://localhost:3033"

# Frontend (Optional)
VITE_API_URL="http://localhost:4000"
```

---

## 2. User Experience Flow

### Creator Journey (Phases 1-6)

**Phase 1: Discovery & Registration**
- User visits `/` → Redirects to `/login`
- Clicks "Register" → `/register`
- Fills form → POST `/api/auth/register`
- Auto-login → JWT token in localStorage
- Redirect → `/dashboard`

**Phase 2: Create Project**
- Dashboard shows "Create New Project" button
- Clicks → Modal appears
- Enters name + description → POST `/api/projects`
- Response: `{ project: { id, name, ... } }`
- Click project card → Navigate to `/projects/:projectId`

**Phase 3: Upload Documents** ❌ *BLOCKED - ProjectPage is stub*
- **Expected UX:**
  - See upload dropzone (DocumentUpload component)
  - Drag PDF/DOCX/XLSX → POST `/api/projects/:id/documents` (multipart/form-data)
  - File stored in `uploads/` directory
  - Background processing starts (extracting text, generating embeddings)
  - Progress indicator shows processing status
- **Current State:** Page shows "under construction"

**Phase 4: AI Analysis** ❌ *BLOCKED*
- **Expected UX:**
  - Auto-triggered after upload
  - AI generates: document summary, key topics, outline
  - Stored in Document model fields
- **Current State:** Backend ready, frontend not wired

**Phase 5: Configure AI Agent** ❌ *BLOCKED*
- **Expected UX:**
  - AgentInterview component appears
  - 5 questions: audience, purpose, tone, emphasis, proactive questions
  - Each answer → Form state
  - Submit → POST `/api/projects/:id/agent`
  - Backend creates 4 ContextLayer records (audience, communication, content, engagement)
- **Current State:** Component exists but not mounted

**Phase 6: Generate Share Link** ❌ *BLOCKED*
- **Expected UX:**
  - Click "Share" button
  - Modal: Select access type (password/email/whitelist)
  - Submit → POST `/api/projects/:id/share`
  - Response: `{ slug: "abc123" }`
  - Copy link: `https://app.com/share/abc123`
- **Current State:** Backend ready, frontend not wired

### Viewer Journey (Phases 7-9)

**Phase 7: Access Share Link** ❌ *BLOCKED - SharePage is stub*
- **Expected UX:**
  - Open `/share/abc123`
  - If password-protected → Enter password
  - If email-required → Enter email
  - POST `/api/share/abc123/access` with credentials
  - Create conversation → POST `/api/projects/:id/conversations`
  - Load chat interface
- **Current State:** Page shows "under construction"

**Phase 8: Chat with AI** ❌ *BLOCKED*
- **Expected UX:**
  - ChatInterface component renders
  - Type question → Enter
  - POST `/api/conversations/:id/messages/stream`
  - Streaming response via Vercel AI SDK
  - AI includes `[DOC:filename:section-id]` markers
  - Frontend parser detects markers → Opens DocumentViewer
- **Current State:** Component exists but not mounted

**Phase 9: Document Auto-Open** ❌ *BLOCKED*
- **Expected UX:**
  - AI response: "According to Q3 Financial Report [DOC:q3-report.pdf:section-2-1]..."
  - DocumentViewer panel slides in
  - PDF loads, scrolls to section 2.1, highlights
- **Current State:** Component exists but no reference parsing

### State & Lifecycle

**Session State:**
- JWT token in `localStorage.getItem('auth_token')`
- Persists across page refresh
- Expires after 7 days (configurable)

**Document Processing State:**
- `Document.status`: `pending` → `processing` → `completed` | `failed`
- Background queue checks every 10 seconds
- Processing can take 30s-5min depending on file size

**Conversation State:**
- Created on first message
- Messages appended to array
- Closed when viewer leaves (optional)
- Summaries generated post-conversation (Phase 2)

---

## 3. File & Code Mapping

### Backend Critical Files

```
backend/src/
├── index.ts                          # Express app entry point, route registration
├── routes/
│   ├── auth.routes.ts                # POST /api/auth/{login,register}
│   ├── project.routes.ts             # CRUD /api/projects
│   ├── document.routes.ts            # POST /api/projects/:id/documents
│   ├── agent.routes.ts               # POST /api/projects/:id/agent
│   ├── chat.routes.ts                # POST /api/conversations/:id/messages/stream
│   ├── shareLink.routes.ts           # POST /api/projects/:id/share, GET /api/share/:slug
│   └── analytics.routes.ts           # GET /api/projects/:id/analytics
├── controllers/
│   ├── auth.controller.ts            # Login/register logic, JWT generation
│   ├── project.controller.ts         # Project CRUD, ownership validation
│   ├── document.controller.ts        # File upload, trigger processing
│   ├── agent.controller.ts           # Interview → ContextLayers transformation
│   ├── chat.controller.ts            # RAG search + LLM streaming
│   ├── shareLink.controller.ts       # Access control, logging
│   └── analytics.controller.ts       # Aggregation queries
├── services/
│   ├── documentProcessor.ts          # PDF/DOCX/XLSX → text extraction
│   ├── documentChunker.ts            # Split text into 1000-char chunks
│   ├── embeddingService.ts           # OpenAI embeddings generation
│   ├── contextService.ts             # Build system prompts from ContextLayers
│   ├── chatService.ts                # Vercel AI SDK streaming wrapper
│   └── processingQueue.ts            # Background job runner
├── middleware/
│   ├── auth.ts                       # JWT verification, req.user injection
│   ├── errorHandler.ts               # Global error formatting
│   └── rateLimit.ts                  # 100 requests/15min per IP
└── prisma/
    └── schema.prisma                 # 14 models, relationships, indexes
```

### Frontend Critical Files

```
frontend/src/
├── main.tsx                          # React app entry, Router setup
├── App.tsx                           # Route definitions
├── pages/
│   ├── LoginPage.tsx                 # ✅ Working - Email/password form
│   ├── RegisterPage.tsx              # ✅ Working - Sign-up form
│   ├── DashboardPage.tsx             # ✅ Working - Project list
│   ├── ProjectPage.tsx               # ❌ STUB - "Under construction"
│   └── SharePage.tsx                 # ❌ STUB - "Under construction"
├── components/
│   ├── DocumentUpload.tsx            # ✅ Drag-drop upload with progress
│   ├── AgentInterview.tsx            # ✅ 5-question wizard flow
│   ├── ChatInterface.tsx             # ✅ Message list + streaming input
│   ├── DocumentViewer.tsx            # ✅ PDF/DOCX outline navigation
│   ├── ChatMessage.tsx               # ✅ Message bubble with citations
│   ├── ChatInput.tsx                 # ✅ Textarea with send button
│   └── AnalyticsDashboard.tsx        # ✅ Charts + conversation table
└── lib/
    ├── api.ts                        # API client wrapper with auth
    └── utils.ts                      # Date formatting, etc.
```

### UX-to-Code Mapping

| User Action | Frontend Component | Backend Route | Service | Database |
|-------------|-------------------|---------------|---------|----------|
| Register | RegisterPage | POST /api/auth/register | - | User.create() |
| Create Project | DashboardPage | POST /api/projects | - | Project.create() |
| Upload Document | ❌ DocumentUpload (not mounted) | POST /api/projects/:id/documents | documentProcessor | Document.create() |
| Complete Interview | ❌ AgentInterview (not mounted) | POST /api/projects/:id/agent | contextService | ContextLayer.createMany() |
| Generate Share Link | ❌ (component missing) | POST /api/projects/:id/share | - | ShareLink.create() |
| Access Share Link | ❌ SharePage (stub) | GET /api/share/:slug | - | AccessLog.create() |
| Chat with AI | ❌ ChatInterface (not mounted) | POST /api/conversations/:id/messages/stream | chatService, embeddingService | Message.create() |
| View Analytics | ❌ AnalyticsDashboard (not mounted) | GET /api/projects/:id/analytics | - | Aggregation queries |

---

## 4. Connections to Other Parts

### Data Sources

**Who Writes / Who Reads:**
- `User` table: Written by auth.controller → Read by all authenticated routes (req.user)
- `Project` table: Written by project.controller → Read by all project-scoped routes
- `Document` table: Written by document.controller → Read by chat.controller (RAG search)
- `DocumentChunk` table: Written by processingQueue → Read by embeddingService (similarity search)
- `AgentConfig` table: Written by agent.controller → Read by chat.controller (model selection)
- `ContextLayer` table: Written by agent.controller → Read by contextService (system prompt)
- `ShareLink` table: Written by shareLink.controller → Read by share access validation
- `Conversation` + `Message` tables: Written by chat.controller → Read by analytics.controller

### Shared Resources

**Environment Variables:**
- `JWT_SECRET` - Shared by auth.controller and auth middleware
- `OPENAI_API_KEY` - Shared by embeddingService and chatService
- `DATABASE_URL` - Shared by all Prisma clients

**Global State (Frontend):**
- `localStorage.auth_token` - Set by LoginPage, read by api.ts client
- React Query cache - Shared across all components

### Event Flow

**Triggers:**
1. **Document Upload → Processing Queue**
   - Upload triggers `Document.create({ status: 'pending' })`
   - processingQueue polls every 10s
   - Finds pending docs → Processes → Updates status
2. **Interview Completion → Context Layer Generation**
   - Interview submit → agent.controller
   - Creates 4 ContextLayer records
   - Each layer has category (audience/communication/content/engagement)
3. **Chat Message → RAG Search → LLM Stream**
   - Message → embeddingService generates query embedding
   - Vector similarity search in DocumentChunk table
   - Top 5 chunks → contextService builds prompt
   - chatService streams LLM response

### Fallback Mechanisms

**Error Handling:**
- If OpenAI API fails → Return generic error, don't crash
- If document processing fails → Mark `Document.status = 'failed'`, store error in `processingError`
- If RAG search returns no results → LLM responds with "I don't have information about that in the documents"

---

## 5. Critical Notes & Pitfalls

### Security

**Authentication:**
- ⚠️ JWT secret MUST be 32+ characters (enforced by auth.controller validation)
- ⚠️ Tokens expire after 7 days (configurable via `JWT_EXPIRES_IN`)
- ⚠️ Password minimum 8 characters (enforced by Zod schema)
- ✅ Bcrypt hash rounds: 10 (balance of security/performance)

**Authorization:**
- ⚠️ All project routes check `project.ownerId === req.user.id`
- ⚠️ Share links bypass ownership if access credentials valid
- ⚠️ No RBAC yet - all users have equal permissions

**Input Validation:**
- ✅ File uploads limited to 50MB (multer config)
- ✅ Allowed MIME types: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- ⚠️ SQL injection protected by Prisma parameterization
- ⚠️ XSS risk in chat messages if not escaped (use React's built-in escaping)

### Performance

**Bottlenecks:**
- 🐌 Document processing can take 30s-5min for large PDFs
- 🐌 Embedding generation: ~200ms per chunk (batch if >10 chunks)
- 🐌 RAG search with pgvector: <100ms for <10k chunks, slower at scale
- 🐌 LLM streaming: 20-30 tokens/second (OpenAI gpt-4-turbo)

**Optimizations:**
- ✅ Use transaction mode connection pooler (port 6543) for better concurrency
- ✅ Rate limiting: 100 req/15min prevents abuse
- ⚠️ No caching yet - every chat message hits OpenAI API
- ⚠️ No pagination on document list - will slow down with >100 docs

### Data Integrity

**Race Conditions:**
- ⚠️ Processing queue runs every 10s - multiple workers could process same doc
  - **Mitigation:** Check `status = 'pending'` before processing, update to `'processing'` immediately
- ⚠️ Concurrent chat messages to same conversation
  - **Mitigation:** Prisma handles concurrent writes, messages appended atomically

**Stale Data:**
- ⚠️ Frontend React Query cache: 5min default stale time
- ⚠️ Context layers cached in system prompt - re-fetch if interview re-run

### Error Handling

**Expected Errors:**
- `401 Unauthorized` - Missing/invalid JWT token
- `403 Forbidden` - Valid token but not owner of resource
- `404 Not Found` - Project/document/conversation doesn't exist
- `422 Unprocessable Entity` - Validation error (Zod schema)
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Unexpected error (logged, not exposed)

**Retry Logic:**
- Frontend: React Query retries failed requests 1x by default
- Backend: No retries on OpenAI API failures (fail fast)

---

## 6. Common Development Scenarios

### Scenario 1: Complete ProjectPage Implementation

**What needs to change:**

1. **File:** `frontend/src/pages/ProjectPage.tsx`
   ```typescript
   // Replace stub with:
   import { useParams } from 'react-router-dom'
   import { DocumentUpload } from '../components/DocumentUpload'
   import { AgentInterview } from '../components/AgentInterview'
   import { AnalyticsDashboard } from '../components/AnalyticsDashboard'

   export function ProjectPage() {
     const { projectId } = useParams()
     const [step, setStep] = useState('upload') // upload | interview | analytics

     return (
       <div className="min-h-screen">
         {step === 'upload' && <DocumentUpload projectId={projectId} onComplete={() => setStep('interview')} />}
         {step === 'interview' && <AgentInterview projectId={projectId} onComplete={() => setStep('analytics')} />}
         {step === 'analytics' && <AnalyticsDashboard projectId={projectId} />}
       </div>
     )
   }
   ```

2. **Common mistakes:**
   - ❌ Forgetting to extract `projectId` from URL params
   - ❌ Not passing `onComplete` callback to transition between steps
   - ❌ Missing loading/error states for API calls

3. **How to verify:**
   - Manual test: Create project → Click project card → See upload dropzone
   - Upload test PDF → Check `uploads/` directory for file
   - Check database: `SELECT * FROM documents WHERE project_id = 'xxx'`
   - Complete interview → Verify 4 ContextLayer records created

### Scenario 2: Complete SharePage Implementation

**What needs to change:**

1. **File:** `frontend/src/pages/SharePage.tsx`
   ```typescript
   import { useParams } from 'react-router-dom'
   import { ChatInterface } from '../components/ChatInterface'
   import { DocumentViewer } from '../components/DocumentViewer'

   export function SharePage() {
     const { slug } = useParams()
     const [conversationId, setConversationId] = useState(null)
     const [selectedDocument, setSelectedDocument] = useState(null)

     useEffect(() => {
       // Fetch share link details, create conversation
       api.share.getBySlug(slug).then(data => {
         return api.chat.createConversation(data.projectId)
       }).then(conv => {
         setConversationId(conv.id)
       })
     }, [slug])

     return (
       <div className="flex h-screen">
         <div className="flex-1">
           {conversationId && <ChatInterface conversationId={conversationId} onCitationClick={setSelectedDocument} />}
         </div>
         {selectedDocument && (
           <div className="w-1/3 border-l">
             <DocumentViewer documentId={selectedDocument.id} highlightSectionId={selectedDocument.sectionId} />
           </div>
         )}
       </div>
     )
   }
   ```

2. **Common mistakes:**
   - ❌ Not handling access control (password/email validation)
   - ❌ Creating multiple conversations for same viewer
   - ❌ Not parsing `[DOC:filename:section-id]` markers in chat messages

3. **How to verify:**
   - Manual test: Generate share link → Open in incognito → See chat interface
   - Send message → Verify streaming response
   - Check message includes `[DOC:...]` → DocumentViewer opens
   - Check database: `SELECT * FROM conversations WHERE share_link_id = 'xxx'`

### Scenario 3: Add New Interview Question

**What needs to change:**

1. **File:** `frontend/src/components/AgentInterview.tsx`
   ```typescript
   // Add new question to questions array:
   const questions = [
     // ... existing questions ...
     {
       id: 'sensitiveTopics',
       question: "Are there any sensitive topics to avoid?",
       placeholder: "e.g., Competitor names, internal politics",
       description: "Topics the AI should not discuss"
     }
   ]
   ```

2. **File:** `backend/src/controllers/agent.controller.ts`
   ```typescript
   // Update schema to include new field:
   const interviewSchema = z.object({
     audience: z.string().optional(),
     purpose: z.string().optional(),
     tone: z.string().optional(),
     emphasis: z.string().optional(),
     questions: z.string().optional(),
     sensitiveTopics: z.string().optional(), // NEW
   })

   // Update context layer generation:
   if (interviewData.sensitiveTopics) {
     layers.push({
       category: 'content',
       name: 'Sensitive Topics',
       content: `AVOID discussing: ${interviewData.sensitiveTopics}`,
       priority: 7
     })
   }
   ```

3. **How to verify:**
   - Frontend: See new question in interview flow
   - Backend: Submit interview → Check ContextLayer table for new "Sensitive Topics" layer
   - Chat: Ask about sensitive topic → AI refuses to discuss

---

## 7. Testing Strategy

### Manual Testing Checklist

**Creator Flow (End-to-End):**
- [ ] Register new account
- [ ] Create project
- [ ] Upload PDF document (test with <5MB file first)
- [ ] Wait for processing (check `Document.status`)
- [ ] Complete agent interview
- [ ] Verify 4 ContextLayer records created
- [ ] Generate share link
- [ ] Copy link

**Viewer Flow (End-to-End):**
- [ ] Open share link in incognito window
- [ ] Enter password (if required)
- [ ] Chat interface loads
- [ ] Send message: "What is this document about?"
- [ ] Verify streaming response
- [ ] Check for `[DOC:...]` markers in response
- [ ] Verify DocumentViewer opens
- [ ] Send follow-up question
- [ ] Check conversation saved in database

### Smoke Tests

**Backend Health:**
```bash
curl http://localhost:4000/health
# Expected: {"status":"ok","timestamp":"..."}

# Test auth:
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
# Expected: {"user":{...},"token":"eyJ..."}
```

**Frontend Health:**
```bash
curl http://localhost:3033/health
# Expected: healthy

# Check if frontend is serving:
curl http://localhost:3033/
# Expected: HTML with <div id="root">
```

**Database Connection:**
```bash
cd backend
npx prisma db execute --stdin <<< "SELECT version();"
# Expected: PostgreSQL version string
```

### Debugging Tips

**Document Processing Stuck:**
```bash
# Check processing queue logs:
docker-compose logs backend | grep "Processing document"

# Check document status:
npx prisma studio
# Navigate to Document table, filter by status='processing'
# If stuck >10min, manually update to 'failed'
```

**Chat Not Streaming:**
```bash
# Check OpenAI API key:
curl http://localhost:4000/api/health
# If 401, check OPENAI_API_KEY in .env

# Check conversation exists:
npx prisma studio
# Navigate to Conversation table, find by ID
```

**Share Link 404:**
```bash
# Check ShareLink table:
npx prisma studio
# Verify slug matches URL
# Check isActive = true, expiresAt > now
```

---

## 8. Quick Reference

### Start/Run Commands

**Backend:**
```bash
cd backend
npm run dev                    # Development (watch mode)
npm run build                  # Production build
npm start                      # Run production build
npx prisma studio              # Database GUI
npx prisma migrate deploy      # Run migrations
```

**Frontend:**
```bash
cd frontend
npm run dev                    # Development (default port 5173)
npm run dev -- --port 3033     # Development (custom port)
npm run build                  # Production build
npm run preview                # Preview production build
```

**Full Stack:**
```bash
# Terminal 1:
cd backend && npm run dev

# Terminal 2:
cd frontend && npm run dev -- --port 3033
```

### Key Endpoints

**Backend API:**
- `GET /health` - Health check
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/projects` - List user's projects (requires auth)
- `POST /api/projects` - Create project (requires auth)
- `POST /api/projects/:id/documents` - Upload document (multipart/form-data)
- `POST /api/projects/:id/agent` - Save agent config
- `POST /api/projects/:id/share` - Create share link
- `GET /api/share/:slug` - Get share link details
- `POST /api/conversations/:id/messages/stream` - Chat (streaming)
- `GET /api/projects/:id/analytics` - Get project analytics

**Frontend Routes:**
- `/` - Login page
- `/register` - Sign up
- `/dashboard` - Project list
- `/projects/:projectId` - Project detail (❌ STUB)
- `/share/:slug` - Viewer experience (❌ STUB)

### Configuration Summary

**Critical Environment Variables:**
```bash
DATABASE_URL         # Supabase transaction pooler (required)
DIRECT_URL           # Supabase session pooler (required for migrations)
JWT_SECRET           # Min 32 chars (required)
OPENAI_API_KEY       # sk-proj-... (required)
PORT                 # Default: 4000
CORS_ORIGIN          # Default: http://localhost:5173
VITE_API_URL         # Frontend only, default: http://localhost:4000
```

**Default Values:**
- Processing queue interval: 10 seconds
- JWT expiry: 7 days
- Rate limit: 100 requests per 15 minutes per IP
- Max file upload: 50MB
- Embedding model: text-embedding-3-small (1536 dims)
- Chat model: gpt-4-turbo-preview

### Critical Files Checklist

**Must-Know Files (Top 10):**
1. `backend/src/index.ts` - Express app entry
2. `backend/prisma/schema.prisma` - Database schema
3. `backend/src/services/chatService.ts` - LLM streaming logic
4. `backend/src/services/documentProcessor.ts` - File parsing
5. `backend/src/services/contextService.ts` - System prompt builder
6. `frontend/src/App.tsx` - Route definitions
7. `frontend/src/lib/api.ts` - API client
8. `frontend/src/pages/ProjectPage.tsx` - ❌ NEEDS IMPLEMENTATION
9. `frontend/src/pages/SharePage.tsx` - ❌ NEEDS IMPLEMENTATION
10. `.env` - Configuration

---

## Implementation Status

### ✅ Complete (100%)
- Backend API (all 7 routes)
- Backend services (document processing, embeddings, chat)
- Frontend components (9/9)
- Database schema
- Authentication & authorization
- Supabase integration

### ❌ Incomplete (60% overall)
- **ProjectPage (0%)** - Stub placeholder
- **SharePage (0%)** - Stub placeholder
- Document reference parsing - Not implemented
- Access control UI (password/email gates) - Not implemented
- Analytics dashboard routing - Not implemented

### Next Steps to Complete Phase 1 MVP

1. **Implement ProjectPage** (2-3 hours)
   - Wire up DocumentUpload component
   - Wire up AgentInterview component
   - Add tab navigation for analytics
   - Test full creator flow

2. **Implement SharePage** (2-3 hours)
   - Add access control UI (password input)
   - Wire up ChatInterface component
   - Implement document reference parsing
   - Wire up DocumentViewer with auto-open
   - Test full viewer flow

3. **Testing & Polish** (1-2 hours)
   - End-to-end manual testing
   - Fix edge cases
   - Error message improvements
   - Loading state improvements

**Total Estimated Time to MVP:** 5-8 hours of focused development

---

**Last Updated:** November 2025
**Maintainer:** Development Team
**Questions?** Check CLAUDE.md for architectural context
