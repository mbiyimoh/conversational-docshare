# AI Agent Testing Dojo with Profile Review

**Slug:** ai-agent-testing-dojo-with-profile
**Author:** Claude Code
**Date:** 2025-11-26
**Branch:** preflight/ai-agent-testing-dojo-with-profile
**Related:** specs/feat-interview-completion-flow-lean.md, developer-guides/Phase-1-Architecture-Overview.md

---

## 1) Intent & Assumptions

### Task Brief

Add a multi-step enhancement to the agent configuration workflow that transforms how creators refine their AI agents. The new workflow introduces:

1. **AI Agent Profile synthesis** - After completing the interview, the system synthesizes all answers into a comprehensive, human-readable "profile" describing who the agent is, how it communicates, what it emphasizes, and what key framings it uses
2. **Testing Dojo** - A preview/sandbox environment that mirrors the exact recipient experience, allowing creators to "pretend to be the recipient" and test their agent
3. **Response-tagged comment system** - Within the Testing Dojo, creators can annotate specific AI responses with feedback comments (e.g., "tone too professional", "missing context about XYZ")
4. **Session-based persistence** - Testing sessions group conversations and comments together, stored per session for organized feedback tracking
5. **Recommendation engine** - Analyzes accumulated comments and suggests specific updates to both interview answers and the agent profile

**New Workflow Flow:**
```
Interview → Agent Profile Review → Testing Dojo → Recommendations → Iterate → Share
           (with sessions/comments)
```

### Assumptions

- The existing interview system (5 questions) remains unchanged; this builds on top of it
- The AI Agent Profile is a **derived view** synthesized from interview responses - not a new data entry point
- Testing Dojo sessions are creator-only; viewers never see test conversations
- Comments are freeform text (not structured categories) as the user described conversational feedback
- The recommendation system uses AI to analyze comments and map them back to interview questions
- Profile and Dojo features are accessed via new tabs/steps in the ProjectPage, not a separate page
- Session data (conversations + comments) should persist across browser sessions
- The system should support multiple testing sessions per project (for A/B comparison, iterative refinement)

### Out of Scope

- Changing the interview questions themselves
- Real-time collaborative testing (multiple creators testing simultaneously)
- Automated A/B testing with split traffic
- Version control/history for profiles (beyond session comparison)
- Voice or multimodal testing (text chat only)
- Analytics/metrics on testing sessions (Phase 2 enhancement)
- Export/share testing sessions with others
- AI-generated test scenarios or automated conversation starters

---

## 2) Pre-reading Log

### Architecture & Documentation

| File | Key Takeaways |
|------|---------------|
| `CLAUDE.md` | User prefers Claude to handle ALL technical operations; never ask to run commands. Project purpose: AI-powered document sharing where interview → context layers → AI behavior |
| `ARCHITECTURE-INTEGRATION.md` | Context layers are generated from interview responses via `createContextLayersFromInterview()`. Four categories: audience, communication, content, engagement. Layers are composed into system prompts at chat time |
| `developer-guides/Phase-1-Architecture-Overview.md` | ProjectPage has 4 tabs: Documents, AI Agent, Share, Analytics. Frontend components exist for Chat, Interview. Backend services handle context composition and streaming chat |
| `specs/02-llm-integration-architecture.md` | Hybrid RAG: document outlines + semantic search. Chat API streams responses via Vercel AI SDK. Citations use `[DOC:filename:section-id]` format |
| `specs/feat-interview-completion-flow-lean.md` | Recently implemented summary screen after interview. Pattern: interview view → summary view → navigate to share. Good precedent for adding profile view |

### Relevant Code Components

| File | Role |
|------|------|
| `frontend/src/components/AgentInterview.tsx` | Current interview UI with 5 questions. Has `view` state pattern (`'interview' \| 'summary'`). Saves to `api.saveAgentConfig()` |
| `frontend/src/components/ChatInterface.tsx` | Streaming chat component using SSE. Loads conversation history, renders messages, handles streaming. Uses `ChatMessage` and `ChatInput` subcomponents |
| `frontend/src/pages/ProjectPage.tsx` | Tab-based layout: Documents, AI Agent, Share, Analytics. `activeTab` state controls which component renders |
| `backend/src/controllers/agent.controller.ts` | Saves interview data to `AgentConfig` model, triggers `createContextLayersFromInterview()`. Returns config with status and completion level |
| `backend/src/services/contextService.ts` | `createContextLayersFromInterview()` transforms interview → 4 context layers. `buildSystemPrompt()` composes layers + doc outlines for chat |
| `backend/prisma/schema.prisma` | Key models: `AgentConfig` (stores interviewData), `ContextLayer` (4 categories), `Conversation`, `Message`. Need new models for testing sessions and comments |

---

## 3) Codebase Map

### Primary Components/Modules

```
NEW: AI Agent Profile Feature
├── frontend/src/components/AgentProfile.tsx          # Profile display/review component
├── backend/src/services/profileSynthesizer.ts        # AI-powered profile generation from interview
└── backend/src/controllers/agent.controller.ts       # Extended with profile endpoint

NEW: Testing Dojo Feature
├── frontend/src/components/TestingDojo/
│   ├── TestingDojo.tsx                               # Main dojo container (chat + comments panel)
│   ├── DojoChat.tsx                                  # Chat interface variant for testing
│   ├── CommentOverlay.tsx                            # Comment attachment UI on messages
│   ├── SessionManager.tsx                            # Session list/creation/switching
│   └── CommentThread.tsx                             # Display comments for a message
├── backend/src/controllers/testSession.controller.ts # CRUD for test sessions
├── backend/src/controllers/comment.controller.ts     # CRUD for comments on messages

NEW: Recommendation Engine
├── frontend/src/components/RecommendationPanel.tsx   # Display recommendations
├── backend/src/services/recommendationEngine.ts      # Analyze comments → suggest updates
└── backend/src/controllers/recommendation.controller.ts

MODIFIED: Existing Components
├── frontend/src/pages/ProjectPage.tsx                # Add "Test" tab between Agent and Share
├── frontend/src/components/AgentInterview.tsx        # Flow to profile after interview completion
└── backend/prisma/schema.prisma                      # New models: TestSession, TestComment
```

### Shared Dependencies

| Dependency | Usage |
|------------|-------|
| `frontend/src/lib/api.ts` | API client - extend with test session, comment, profile, recommendation endpoints |
| `backend/src/services/contextService.ts` | Profile synthesis will reuse context layer generation logic |
| `backend/src/services/chatService.ts` | Dojo chat reuses streaming logic but flags conversations as "test mode" |
| `frontend/src/components/ChatMessage.tsx` | Extended to support comment attachment UI |
| `backend/src/utils/openai.ts` | Profile synthesis and recommendation engine use LLM |

### Data Flow

```
Interview Completion Flow (existing):
User answers questions → api.saveAgentConfig() → AgentConfig.interviewData stored
                                               → createContextLayersFromInterview() creates 4 layers

NEW: Profile Synthesis Flow:
AgentConfig.interviewData → profileSynthesizer.synthesizeProfile() → AI generates prose profile
                                                                   → Stored in AgentConfig.profile

NEW: Testing Dojo Flow:
Creator starts session → TestSession created (projectId, sessionId)
Creator sends message → Chat API called with "isTestMode: true"
AI responds → Response stored in TestMessage (linked to TestSession)
Creator adds comment → TestComment created (linked to TestMessage)
                     → Comment stored with messageId, content, createdAt

NEW: Recommendation Flow:
Creator requests recs → Fetch all TestComments for project
                     → recommendationEngine.analyzeComments()
                     → AI analyzes patterns → Maps to interview questions
                     → Returns structured recommendations with suggested updates
```

### Database Schema Extensions (New Models)

```prisma
model AgentConfig {
  // ... existing fields ...

  // NEW: Synthesized profile
  profile     String?  @db.Text  // AI-generated prose profile
  profileGeneratedAt DateTime?
}

model TestSession {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  name        String?  // Optional session name (e.g., "Test run #3")

  // Relationships
  messages    TestMessage[]

  // Timestamps
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([projectId])
  @@map("test_sessions")
}

model TestMessage {
  id          String      @id @default(cuid())
  sessionId   String
  session     TestSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  role        String      // user, assistant
  content     String      @db.Text

  // Relationships
  comments    TestComment[]

  // Timestamps
  createdAt   DateTime    @default(now())

  @@index([sessionId])
  @@map("test_messages")
}

model TestComment {
  id          String      @id @default(cuid())
  messageId   String
  message     TestMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)

  content     String      @db.Text  // Freeform feedback text

  // Optional: AI-extracted metadata (for recommendation engine)
  category    String?     // tone, content, context, framing (AI-inferred)
  sentiment   String?     // positive, negative, neutral (AI-inferred)

  // Timestamps
  createdAt   DateTime    @default(now())

  @@index([messageId])
  @@map("test_comments")
}
```

### Feature Flags/Config

- No feature flags needed for MVP; this is a core workflow enhancement
- Consider `ENABLE_PROFILE_SYNTHESIS` env var if AI costs need gating

### Potential Blast Radius

| Area | Impact | Risk Level |
|------|--------|------------|
| ProjectPage.tsx | Add new tab, modify navigation flow | Low - additive change |
| AgentInterview.tsx | Modify completion flow to show profile | Low - extends existing pattern |
| AgentConfig model | Add profile field | Low - migration needed |
| Chat API | Add isTestMode flag | Low - backward compatible |
| New components | 10+ new frontend components | Medium - significant new code |
| New API routes | 8+ new endpoints | Medium - new surface area |
| Database | 3 new tables | Low - isolated new tables |

---

## 4) Root Cause Analysis

**N/A** - This is a new feature, not a bug fix.

---

## 5) Research Findings

### Industry Patterns for AI Agent Testing

#### 5.1 Preview/Testing UX Patterns

**Split-Screen Interface (ChatGPT Model):**
- Configuration panel on left, live preview chat on right
- Real-time updates when configuration changes
- Clear visual separation between "editing" and "testing" modes

**Sandbox Isolation (Salesforce Agentforce):**
- 60-70% faster iteration when testing is isolated from production
- Test conversations never affect viewer analytics
- Clear "TEST MODE" indicator in UI

**Voiceflow Multi-Input Testing:**
- Support voice, chat, and button modes in same test interface
- Visual flow debugging shows conversation path in real-time

**Recommendation for This Feature:**
- Adopt split-screen pattern: Session manager + chat panel + comments sidebar
- Clear "Testing Dojo" branding to distinguish from real viewer experience
- "Test Mode" banner so creators know this doesn't affect real data

#### 5.2 Feedback/Annotation Systems

**Three-Tier Approach:**
1. **Quick votes** - Thumbs up/down on responses (optional, simpler)
2. **Categorized feedback** - Structured tags like "Tone", "Content", "Context"
3. **Freeform comments** - Full text feedback (user's preference)

**User's Stated Preference:** Freeform comments tagged to specific responses
- Example: "Your tone is a little too professional. Let's try and be slightly more casual, especially when we're talking about this sort of thing."
- Example: "We need to go add context about XYZ additional thing that colors how we communicate with the recipients when they ask about stuff like what prompted this response."

**Implementation Pattern:**
```typescript
interface TestComment {
  id: string
  messageId: string  // Which AI response this is attached to
  content: string    // Freeform feedback text
  createdAt: Date
}
```

**UI Pattern:**
- Hover over AI response → "Add Comment" button appears
- Click → Comment input overlay slides in
- Comments display as badges/indicators on messages
- Click message → See all comments in sidebar

#### 5.3 Iterative Configuration Patterns

**Test → Feedback → Improve Loop (Botpress/Voiceflow):**
1. Test agent with sample conversations
2. Leave feedback on problematic responses
3. System suggests configuration changes
4. Apply changes → Re-test → Repeat

**AI-Powered Suggestion Analysis:**
- "80% of feedback mentions jargon - consider less technical tone"
- Maps feedback patterns to specific configuration options
- Pre-fills suggested updates for interview questions

**User's Workflow Vision:**
1. Complete interview → See synthesized profile
2. Enter Testing Dojo → Have conversations
3. Leave comments on responses that need work
4. Click "Generate Recommendations" → System analyzes comments
5. See suggested updates to interview answers
6. Apply suggestions → Profile regenerates → Re-test

#### 5.4 Session Management Patterns

**Session-Based Testing (Research Finding):**
- Group related test conversations into sessions
- Each session has its own set of comments
- Compare sessions to see improvement over iterations

**User's Stated Requirement:**
> "That testing section should also have the concept of sessions, so that these comments can be saved in files that are stored on a per session basis. So basically you test the thing and maybe go back-and-forth half a dozen times, leave a couple comments..."

**Implementation:**
```typescript
// Session structure
interface TestSession {
  id: string
  projectId: string
  name?: string  // "Test Run #3" or auto-generated
  messages: TestMessage[]  // All chat messages in session
  createdAt: Date
}

// Comments are linked to specific messages within sessions
interface TestMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  comments: TestComment[]  // Multiple comments per message allowed
}
```

### Recommended Approach Summary

| Component | Pattern | Rationale |
|-----------|---------|-----------|
| Profile Display | Full prose synthesis | User wants "finger to the wind" check, not just raw answers |
| Testing UI | Split-screen with sidebar | Industry standard for configuration + preview |
| Comments | Freeform text on responses | User explicitly described conversational feedback |
| Sessions | Grouped conversations + comments | User explicitly requested session-based storage |
| Recommendations | AI analysis → Interview mapping | Closes the feedback loop automatically |

---

## 6) Clarifications Needed

### Critical Clarifications

1. **Profile Format & Editability**
   - Should the AI-generated profile be **read-only** (derived entirely from interview), or can creators **directly edit** the profile prose?
   - If editable: Should edits to the profile back-propagate to interview answers?
   - **Recommendation:** Read-only profile that regenerates when interview changes

2. **Session Lifecycle**
   - When should a session "end"? Manual close, time-based auto-close, or keep open indefinitely?
   - Can creators delete sessions and their comments?
   - **Recommendation:** Sessions stay open until manually closed or new session started; deletion allowed

3. **Comment Privacy**
   - Comments are creator-only (never shown to viewers), correct?
   - **Recommendation:** Confirm this is correct - test sessions are fully private

4. **Recommendation Application**
   - When recommendations suggest interview answer changes, should they:
     - (A) Pre-fill the interview form so creator can review and submit?
     - (B) Auto-apply changes with creator approval?
     - (C) Show diff/comparison of current vs suggested?
   - **Recommendation:** Option (A) with diff preview - safest UX

5. **Tab Navigation**
   - New "Test" tab between "AI Agent" and "Share"?
   - Or integrate Testing Dojo into the AI Agent tab with subtabs?
   - **Recommendation:** New top-level "Test" tab for clear separation

### Nice-to-Have Clarifications

6. **Multiple Comments per Response**
   - Can a creator leave multiple comments on the same AI response?
   - **Recommendation:** Yes, allows different types of feedback on one response

7. **Comment Templates/Suggestions**
   - Should we offer quick comment templates (e.g., "Too formal", "Missing context", "Incorrect emphasis")?
   - Or purely freeform as user described?
   - **Recommendation:** Start freeform, add templates in Phase 2 if patterns emerge

8. **Profile Regeneration**
   - When interview answers change, should profile auto-regenerate, or require manual trigger?
   - **Recommendation:** Auto-regenerate with "Profile updated" notification

9. **Session Comparison**
   - Should there be a way to compare two sessions side-by-side?
   - **Recommendation:** Phase 2 enhancement - start with single session view

10. **Real Documents in Testing**
    - Should Testing Dojo have access to uploaded documents for realistic testing?
    - Or use the full system context including document chunks?
    - **Recommendation:** Full system context - testing should mirror real recipient experience exactly

---

## 7) Detailed Feature Specifications

### 7.1 AI Agent Profile

**Purpose:** Synthesize interview answers into a comprehensive, human-readable "profile" that describes the AI agent's persona.

**User Story:** "As a creator, after completing the interview, I want to see a synthesized profile of my AI agent so I can do a quick 'finger to the wind' check that the agent will communicate as I intend."

**Profile Content Structure:**
```markdown
# AI Agent Profile

## Identity & Role
[Synthesized from: audience + purpose questions]
This AI agent represents your document collection for [audience].
Its primary role is to [purpose], serving as an intelligent guide...

## Communication Style
[Synthesized from: tone question]
The agent communicates in a [tone] manner. When responding to questions,
it will [specific behaviors derived from tone]...

## Content Priorities
[Synthesized from: emphasis question]
The agent prioritizes and emphasizes:
- [Emphasis area 1]
- [Emphasis area 2]
- [Emphasis area 3]
When discussing these topics, the agent will proactively...

## Engagement Approach
[Synthesized from: proactive questions]
To guide productive conversations, the agent may ask:
- [Proactive question 1]
- [Proactive question 2]
The agent will look for opportunities to...

## Key Framings
[AI-inferred from overall interview]
Based on your configuration, the agent will frame conversations around:
- [Framing 1]
- [Framing 2]
```

**UI/UX:**
- Displayed after interview completion (new step before Testing Dojo)
- Rendered in a card-based layout with clear sections
- "Looks Good → Continue to Testing" and "Edit Interview" buttons
- Subtle "Regenerate Profile" button if creator wants fresh synthesis

**Technical Implementation:**
```typescript
// POST /api/projects/:projectId/agent/profile
// Generates profile from interview data using LLM
async function synthesizeProfile(projectId: string): Promise<string> {
  const agentConfig = await prisma.agentConfig.findUnique({ where: { projectId } })
  const interviewData = agentConfig.interviewData as InterviewData

  const prompt = `
    Based on the following interview responses, synthesize a comprehensive
    AI agent profile that describes:
    1. Who the agent is and its role
    2. How it communicates (tone, style)
    3. What content it prioritizes
    4. How it engages proactively
    5. Key framings it should use

    Interview Responses:
    - Audience: ${interviewData.audience}
    - Purpose: ${interviewData.purpose}
    - Tone: ${interviewData.tone}
    - Emphasis: ${interviewData.emphasis}
    - Proactive Questions: ${interviewData.questions}

    Write in second person ("your agent will...") and make it actionable.
  `

  const profile = await generateWithLLM(prompt)

  await prisma.agentConfig.update({
    where: { projectId },
    data: { profile, profileGeneratedAt: new Date() }
  })

  return profile
}
```

---

### 7.2 Testing Dojo

**Purpose:** Provide a sandbox environment where creators can test their AI agent by pretending to be the recipient.

**User Story:** "As a creator, I want to test my AI agent in an experience that mirrors what recipients will see, so I can identify areas where I need to iterate on my inputs."

**Layout (Split-Screen Pattern):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Testing Dojo                                           [Session: Test #3 ▼] │
├──────────────────────────────────────────────────┬──────────────────────────┤
│                                                  │                          │
│                                                  │  Comments & Feedback     │
│              Chat Interface                      │                          │
│         (mirrors recipient view)                 │  ┌────────────────────┐  │
│                                                  │  │ Message #4         │  │
│  ┌──────────────────────────────────────────┐   │  │ "tone too formal"  │  │
│  │ 🤖 Based on the Financial Projections    │   │  │ - 2 min ago        │  │
│  │    [DOC:q3-report.pdf:section-2], the    │ ● │  └────────────────────┘  │
│  │    ROI is projected at 35% over...       │   │                          │
│  │                         [+ Add Comment]  │   │  ┌────────────────────┐  │
│  └──────────────────────────────────────────┘   │  │ Message #2         │  │
│                                                  │  │ "need more context │  │
│  ┌──────────────────────────────────────────┐   │  │  about Q2 baseline" │  │
│  │ You: What's our projected ROI?           │   │  │ - 5 min ago        │  │
│  └──────────────────────────────────────────┘   │  └────────────────────┘  │
│                                                  │                          │
│  ┌──────────────────────────────────────────┐   │  ──────────────────────  │
│  │ Type a message...                    [→] │   │  [📋 Get Recommendations]│
│  └──────────────────────────────────────────┘   │                          │
│                                                  │                          │
└──────────────────────────────────────────────────┴──────────────────────────┘
```

**Key UI Elements:**

1. **Session Selector (Top Right)**
   - Dropdown showing all sessions for this project
   - "New Session" option creates fresh session
   - Session auto-named with timestamp or user can rename

2. **Chat Interface (Left Panel)**
   - Identical to recipient chat experience
   - Full access to documents, citations work normally
   - "TEST MODE" banner at top to distinguish from real use
   - Each AI response has hover-revealed "Add Comment" button

3. **Comments Sidebar (Right Panel)**
   - Shows all comments for current session
   - Grouped by message they're attached to
   - Click comment → Scrolls to that message in chat
   - "Get Recommendations" button at bottom

4. **Comment Attachment UI**
   - Hover AI message → "Add Comment" button appears
   - Click → Inline textarea expands below message
   - Submit → Comment appears in sidebar + indicator on message

**Comment Indicator on Messages:**
- Small dot/badge on messages that have comments
- Number shows comment count if multiple
- Click message → Highlights in sidebar

---

### 7.3 Comment System

**Purpose:** Allow creators to tag specific AI responses with feedback notes.

**User Story:** "As a creator testing my agent, I want to leave comments on specific AI responses that describe ways I want the agent to change its approach."

**Comment Types (User Examples):**

1. **Tone Feedback:**
   > "Your tone is a little too professional. Let's try and be slightly more casual, especially when we're talking about this sort of thing."

2. **Missing Context:**
   > "We need to go add context about XYZ additional thing that colors how we communicate with the recipients when they ask about stuff like what prompted this response."

3. **Incorrect Emphasis:**
   > "The agent should have emphasized the risk factors more here, not just the upside."

4. **Framing Issues:**
   > "When talking about timeline, frame it as 'aggressive but achievable' not 'challenging'."

**Data Model:**
```typescript
interface TestComment {
  id: string
  messageId: string      // Links to specific AI response
  content: string        // Freeform text (user's actual feedback)
  category?: string      // AI-inferred: tone | content | context | framing | emphasis
  sentiment?: string     // AI-inferred: positive | negative | neutral
  createdAt: Date
}
```

**UI Flow for Adding Comment:**
```
1. Creator hovers over AI response
2. "+ Add Comment" button appears (bottom right of message bubble)
3. Creator clicks button
4. Textarea expands inline below the message
5. Creator types feedback
6. Press Enter or click "Save" to submit
7. Comment appears in sidebar
8. Small indicator dot appears on the message
```

**Technical Implementation:**
```typescript
// POST /api/test-sessions/:sessionId/messages/:messageId/comments
async function addComment(req: Request, res: Response) {
  const { sessionId, messageId } = req.params
  const { content } = req.body

  // Verify ownership
  const message = await prisma.testMessage.findUnique({
    where: { id: messageId },
    include: { session: { include: { project: true } } }
  })

  if (message.session.project.ownerId !== req.user.userId) {
    throw new AuthorizationError()
  }

  // Optionally: AI-categorize the comment for better recommendations
  const category = await categorizeComment(content)

  const comment = await prisma.testComment.create({
    data: {
      messageId,
      content,
      category
    }
  })

  res.json({ comment })
}
```

---

### 7.4 Session Management

**Purpose:** Group testing conversations and comments into organized sessions.

**User Story:** "As a creator, I want my testing comments saved in sessions so I can track feedback across multiple test runs and compare my iterations."

**Session Lifecycle:**

1. **Creation:**
   - First test message in new session auto-creates session
   - Or explicit "New Session" button in session dropdown

2. **During Session:**
   - All messages and comments are linked to current session
   - Session remains "active" until new session started

3. **Session Switching:**
   - Creator can switch between sessions via dropdown
   - Switching loads that session's conversation history + comments

4. **Session Persistence:**
   - Sessions persist indefinitely (no auto-expiration)
   - Creator can delete sessions (cascades to messages + comments)

**Session Display:**
```
Session Dropdown:
┌────────────────────────────────┐
│ ● Test Session #3 (active)    │  <- Current
│   Today at 3:45 PM            │
├────────────────────────────────┤
│   Test Session #2             │
│   Yesterday at 10:30 AM       │
│   3 comments                  │
├────────────────────────────────┤
│   Test Session #1             │
│   Nov 24 at 2:15 PM           │
│   7 comments                  │
├────────────────────────────────┤
│ + New Session                 │
└────────────────────────────────┘
```

**API Endpoints:**
```typescript
// GET /api/projects/:projectId/test-sessions
// Returns all sessions for project

// POST /api/projects/:projectId/test-sessions
// Creates new session

// GET /api/test-sessions/:sessionId
// Returns session with messages and comments

// DELETE /api/test-sessions/:sessionId
// Deletes session and all related data

// GET /api/test-sessions/:sessionId/messages
// Returns messages for session

// POST /api/test-sessions/:sessionId/messages
// Adds message to session (from chat)
```

---

### 7.5 Recommendation Engine

**Purpose:** Analyze accumulated comments and suggest specific updates to interview answers and agent profile.

**User Story:** "As a creator, after testing and leaving comments, I want the system to recommend how to update my interview answers to address my feedback."

**Recommendation Types:**

1. **Interview Answer Updates:**
   ```
   📝 Suggestion for "Communication Style" question:

   Current answer: "Professional and formal"

   Based on your feedback:
   - "tone too professional" (3 comments)
   - "be more casual when discussing timelines"

   Suggested update: "Professional but approachable, with a
   conversational tone especially when discussing timelines
   and practical implications"

   [Apply] [Dismiss]
   ```

2. **Missing Context Additions:**
   ```
   📝 Suggestion for "What should the AI emphasize?" question:

   Your feedback mentioned missing context about:
   - Q2 baseline comparisons
   - Risk mitigation strategies

   Consider adding these topics to your emphasis areas.

   [Edit Interview] [Dismiss]
   ```

3. **Framing Guidance:**
   ```
   📝 New suggestion for proactive questions:

   Based on your feedback about framing:
   - "frame timelines as 'aggressive but achievable'"

   Consider adding a proactive question like:
   "How does this timeline align with your current priorities?"

   [Add to Interview] [Dismiss]
   ```

**Technical Implementation:**

```typescript
// POST /api/projects/:projectId/recommendations
async function generateRecommendations(projectId: string): Promise<Recommendation[]> {
  // 1. Fetch all comments across all sessions
  const comments = await prisma.testComment.findMany({
    where: {
      message: {
        session: { projectId }
      }
    },
    include: {
      message: true
    }
  })

  // 2. Fetch current interview data
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId }
  })

  // 3. Use LLM to analyze patterns and generate recommendations
  const prompt = `
    Analyze these feedback comments from testing an AI agent:

    ${comments.map(c => `- "${c.content}" (on response: "${c.message.content.substring(0, 100)}...")`).join('\n')}

    Current interview answers:
    - Audience: ${agentConfig.interviewData.audience}
    - Purpose: ${agentConfig.interviewData.purpose}
    - Tone: ${agentConfig.interviewData.tone}
    - Emphasis: ${agentConfig.interviewData.emphasis}
    - Proactive Questions: ${agentConfig.interviewData.questions}

    For each piece of feedback, suggest specific updates to the interview answers
    that would address the feedback. Group similar feedback together.

    Return JSON array with format:
    [
      {
        "questionId": "tone",
        "currentAnswer": "...",
        "suggestedUpdate": "...",
        "relatedComments": ["...", "..."],
        "rationale": "..."
      }
    ]
  `

  const recommendations = await generateWithLLM(prompt, { json: true })

  return recommendations
}
```

**UI for Recommendations Panel:**
```
┌──────────────────────────────────────────────────────────────────┐
│ Recommendations                                   [↻ Regenerate] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Based on 5 comments across 2 sessions:                           │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │ 📝 Communication Style                                     │   │
│ │                                                            │   │
│ │ Current: "Professional and formal"                         │   │
│ │                                                            │   │
│ │ Suggested: "Professional but approachable, with a          │   │
│ │ conversational tone especially when discussing             │   │
│ │ practical timelines and implications"                      │   │
│ │                                                            │   │
│ │ Related feedback:                                          │   │
│ │ • "tone too professional" (x2)                             │   │
│ │ • "be more casual about timelines"                         │   │
│ │                                                            │   │
│ │ [Apply to Interview] [Dismiss]                             │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │ 📝 Content Emphasis                                        │   │
│ │                                                            │   │
│ │ Add missing topics:                                        │   │
│ │ • Q2 baseline comparisons                                  │   │
│ │ • Risk mitigation strategies                               │   │
│ │                                                            │   │
│ │ [Add to Interview] [Dismiss]                               │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Applying Recommendations:**
1. Creator clicks "Apply to Interview"
2. System pre-fills interview form with suggested updates
3. Creator reviews and can modify before saving
4. Saving triggers profile regeneration
5. Creator can re-test in Dojo

---

## 8) Implementation Phases

### Phase 1: Core Infrastructure (Backend)

**New Database Models:**
- [ ] Add `profile` field to `AgentConfig` model
- [ ] Create `TestSession` model
- [ ] Create `TestMessage` model
- [ ] Create `TestComment` model
- [ ] Run migrations

**New API Routes:**
- [ ] `POST /api/projects/:projectId/agent/profile` - Generate profile
- [ ] `GET /api/projects/:projectId/agent/profile` - Get profile
- [ ] `GET /api/projects/:projectId/test-sessions` - List sessions
- [ ] `POST /api/projects/:projectId/test-sessions` - Create session
- [ ] `GET /api/test-sessions/:sessionId` - Get session with messages
- [ ] `DELETE /api/test-sessions/:sessionId` - Delete session
- [ ] `POST /api/test-sessions/:sessionId/messages` - Add message
- [ ] `POST /api/test-sessions/:sessionId/messages/:messageId/comments` - Add comment
- [ ] `POST /api/projects/:projectId/recommendations` - Generate recommendations

**New Services:**
- [ ] `profileSynthesizer.ts` - LLM-powered profile generation
- [ ] `recommendationEngine.ts` - LLM-powered comment analysis

### Phase 2: AI Agent Profile (Frontend)

- [ ] Create `AgentProfile.tsx` component
- [ ] Update `AgentInterview.tsx` to show profile after completion
- [ ] Add profile regeneration capability
- [ ] Update ProjectPage flow: Interview → Profile → Test

### Phase 3: Testing Dojo (Frontend)

- [ ] Create `TestingDojo/` component directory
- [ ] Build `TestingDojo.tsx` main container
- [ ] Build `DojoChat.tsx` (extends ChatInterface)
- [ ] Build `SessionManager.tsx` for session switching
- [ ] Build `CommentOverlay.tsx` for message annotation
- [ ] Build `CommentThread.tsx` for sidebar display
- [ ] Add "Test" tab to ProjectPage

### Phase 4: Recommendation Engine (Full Stack)

- [ ] Implement `recommendationEngine.ts` service
- [ ] Create `RecommendationPanel.tsx` component
- [ ] Add "Get Recommendations" button to Dojo
- [ ] Implement "Apply to Interview" workflow
- [ ] Connect profile regeneration after interview updates

### Phase 5: Polish & Integration

- [ ] End-to-end testing of full workflow
- [ ] Loading states and error handling
- [ ] Empty states for new sessions
- [ ] Session naming and management UX
- [ ] Profile section collapse/expand
- [ ] Comment count badges
- [ ] Keyboard shortcuts for comment workflow

---

## 9) Success Criteria

| Metric | Target |
|--------|--------|
| Profile generation time | < 5 seconds |
| Recommendation generation time | < 10 seconds |
| Comments per message | Unlimited supported |
| Sessions per project | Unlimited supported |
| Test conversation length | Same as real conversations |
| Profile accuracy | Creator confirms "looks right" > 80% of time |
| Recommendation acceptance rate | > 50% applied |

---

## 10) Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM costs for profile/recommendations | Medium | Cache profiles; only regenerate on interview change |
| Complex UI for Testing Dojo | Medium | Start with simplified single-panel view; iterate |
| Comment volume overwhelming | Low | Limit display to 50 per session; pagination |
| Recommendation quality inconsistent | Medium | Show rationale; allow dismissal; learn from acceptance patterns |
| Session data growing large | Low | Implement session archival/cleanup for old projects |

---

## 11) Future Enhancements (Out of Scope)

- **Session Comparison:** Side-by-side view of two sessions
- **Comment Templates:** Quick-add common feedback types
- **Test Scenarios:** Pre-built conversation starters for testing
- **Automated Testing:** AI-generated test conversations
- **Regression Testing:** Detect when changes break previously-good behavior
- **Collaborative Testing:** Multiple creators testing same project
- **Analytics on Testing:** Track improvement over test iterations
- **Export Testing Report:** PDF/Markdown summary of sessions and comments

---

## 12) References

- `frontend/src/components/AgentInterview.tsx` - Existing interview component
- `frontend/src/components/ChatInterface.tsx` - Existing chat component
- `frontend/src/pages/ProjectPage.tsx` - Tab navigation parent
- `backend/src/services/contextService.ts` - Context layer generation
- `backend/src/controllers/agent.controller.ts` - Agent config endpoints
- `specs/feat-interview-completion-flow-lean.md` - Recent interview enhancement
- Research: ChatGPT Custom GPTs, Voiceflow Test Tool, Chatbase Compare Mode
