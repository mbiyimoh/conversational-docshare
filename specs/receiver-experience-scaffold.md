# Receiver Experience Scaffold (Pre-Spec)

> **Purpose:** This document consolidates all existing planning, documentation, and implementation details for the "receiver" (viewer) experience. Use this as a foundation when building out receiver-facing features.

---

## Overview

The receiver experience covers **Phases 7-9** of the platform journey:

| Phase | Name | Duration | Description |
|-------|------|----------|-------------|
| **7** | Access & View | 1-2 min | Link click → access gate → entry |
| **8** | Conversation | 15-25 min | Chat with AI agent, explore documents |
| **9** | Conversion | 1-2 min | Optional account creation |

**Primary Personas:**
- **Board Member (First-time Viewer):** No prior context, curious but cautious, time-constrained
- **Investor (Return Visitor):** Familiar with platform, expects conversational experience, more efficient

---

## Phase 7: Access & View

### User Journey (Board Member)

```
Email with share link
    ↓
Clicks link out of curiosity
    ↓
Lands on access gate
    ↓
Mental state:
  • Curious: "What is this?"
  • Cautious: "Is this secure?"
  • Busy: "This better be worth it"
    ↓
DECISION POINT: Provide email or bounce?
  • Provides email (70%): Curious enough
  • Bounces (30%): Friction too high
```

### Access Gate Types

| Type | Friction | Conversion | Use Case |
|------|----------|------------|----------|
| `public` | None | 100% | Open distribution |
| `password` | Low | ~85% | Basic protection |
| `email` | Medium | ~70% | Lead capture (30% bounce) |
| `whitelist` | High | ~95% of valid | Restricted access |

### Current Implementation

**File:** `frontend/src/pages/SharePage.tsx`

**What's Built:**
- Access gate UI for password and email types
- Viewer email/name collection
- Conversation creation on access grant
- Error states and loading states

**What's Missing:**
- Whitelist verification flow
- "Remember me" / session persistence
- Branded/customized access gate (project name, description shown but no creator branding)
- Mobile-optimized access gate

### API Endpoints

```
GET  /api/share/:shareCode        → Load share link metadata
POST /api/share/:shareCode/access → Verify access (password/email)
POST /api/conversations           → Create conversation session
```

---

## Phase 8: Conversation

### User Journey (Board Member)

```
AI Welcome Message (personalized based on agent config)
    ↓
"Hi! I'm here to help you understand John's IP framework
 documentation. I've been configured to focus on ROI
 projections and risk mitigation. What interests you most?"
    ↓
MOMENT OF TRUTH: First question
Board Member: "What's the projected ROI?"
    ↓
AI responds + auto-opens document:
"According to the Financial Projections (Section 3.2),
 the projected ROI is 35% over 18 months..."
[Document panel opens, scrolls to Section 3.2, highlights]
    ↓
Board Member reaction:
  • "Wow, this is actually helpful!" (60% engaged)
  • "Interesting, let me explore" (30% cautious)
  • "Not impressed" (10% bounce)
    ↓
Conversation continues (5-8 questions, 15-20 min):
  • "What are the main risks?"
  • "Show me competitive analysis"
  • "What if regulatory approval delays?"
  • "How does timeline compare to industry?"
    ↓
Documents open automatically as AI cites them
```

### Engagement Metrics

| Metric | First-time Viewer | Return Visitor |
|--------|-------------------|----------------|
| Questions asked | 5-8 | 7-10 |
| Time spent | 15-20 min | 25-30 min |
| Documents viewed | 2-3 | 3-5 |

### Core Interaction Pattern

**AI Agent Behavior (configured by creator interview):**

1. **Welcome Message:** Personalized based on audience, tone, emphasis areas
2. **Contextual Document Opening:** When AI references content:
   - Opens relevant document in side panel
   - Scrolls to specific section
   - Highlights referenced text
   - Keeps chat in focus
3. **Proactive Guidance:** Asks strategic questions based on config
4. **Citation Style:** Always cites sources with format `[DOC:filename:section-id]`

### Document Reference System

**AI Response Format:**
```
"According to the Financial Projections [DOC:financial.pdf:section-3-2],
the projected ROI is 35% over 18 months..."
```

**Frontend Handling:**
1. Parser detects `[DOC:filename:section-id]` markers
2. Triggers document viewer panel to open
3. Loads document and scrolls to anchor
4. Applies highlight animation on referenced section

### Current Implementation

**Files:**
- `frontend/src/pages/SharePage.tsx` - Main viewer layout
- `frontend/src/components/ChatInterface.tsx` - Chat component
- `frontend/src/components/DocumentViewer.tsx` - Document rendering

**What's Built:**
- Split-panel layout (chat + document viewer)
- Citation click handling (`handleCitationClick`)
- Document viewer with highlight support
- Basic responsive layout

**What's Missing:**
- Document reference parsing in AI responses
- Auto-scroll to section on citation
- Highlight animation
- File explorer sidebar (for multi-doc navigation)
- Mobile view (single panel with modal documents)
- Proactive AI questions
- Session persistence (return to same spot)

### API Endpoints

```
POST /api/chat/:conversationId/message  → Send message, get AI response
GET  /api/documents/:id                 → Get document for viewing
GET  /api/documents/:id/outline         → Get document structure
```

---

## Phase 9: Conversion

### User Journey

```
Conversation ends (or viewer tries to leave)
    ↓
Modal appears:
"Save this conversation?
 • Save conversation and AI summary
 • Return anytime for follow-ups
 • Get notified of updates
 • Create your own doc experiences"
    ↓
Board Member considers:
  • Just had valuable experience
  • Might want to reference later
  • Minimal friction to sign up
  • Sees potential for own use
    ↓
DECISION POINT: Create account?
  • Creates account (40% first-time): Sees value
  • No thanks (60%): One-time use sufficient
  • Return visitors: 90% conversion rate
```

### Conversion Modal Wireframe

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

### Current Implementation

**What's Built:**
- Nothing - conversion flow not yet implemented

**What's Missing:**
- Conversion modal component
- Trigger logic (end of conversation, leave intent)
- Quick signup flow (email/password + OAuth)
- Conversation linking to new account
- Summary PDF generation
- Upsell to creator features

### API Endpoints (Needed)

```
POST /api/auth/register-viewer  → Create account from viewer context
POST /api/conversations/:id/save → Link conversation to new account
GET  /api/conversations/:id/summary-pdf → Generate downloadable summary
```

---

## UI/UX Specifications

### Layout: IDE-Inspired Three-Panel

```
┌──────────┬────────────────────────┬─────────────────────┐
│ File     │                        │                     │
│ Explorer │    Main Chat Panel     │  Document Viewer    │
│ Sidebar  │      (60-70%)          │    (30-40%)         │
│ (~200px) │                        │                     │
│          │                        │                     │
│ • doc1   │  [AI Welcome]          │  [Tab: doc.pdf]     │
│ • doc2   │  [User Question]       │  ┌─────────────┐    │
│ • doc3   │  [AI Response with     │  │ Section 3.2 │    │
│          │   doc reference]       │  │ ═══════════ │    │
│          │                        │  │ [Highlight] │    │
│          │  [Input: Ask...]       │  └─────────────┘    │
│          │                        │                     │
└──────────┴────────────────────────┴─────────────────────┘
```

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| Desktop (>1024px) | Full three-panel |
| Tablet (768-1024px) | Collapsible sidebar, panel switching |
| Mobile (<768px) | Single panel, modal document viewing |

### Mobile View Wireframe

```
┌────────────────────┐
│ [☰] IP Framework   │
├────────────────────┤
│                    │
│  [AI Avatar]       │
│  Hi! I'm here to   │
│  help you explore  │
│  the IP framework. │
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
```

### Document Viewer with Highlight

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
│  │ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓      │    │
│  │ ┃ return on investment of 35% over ┃      │    │
│  │ ┃ 18-month period, assuming        ┃      │    │
│  │ ┃ baseline market conditions.      ┃      │    │
│  │ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛      │    │
│  │          ↑ Currently referenced by AI      │    │
│  │                                             │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  [← Previous Page]  [Jump to Section ▼]  [Next →]  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Data Models

### Relevant Prisma Models

```prisma
model ShareLink {
  id            String        @id @default(cuid())
  projectId     String
  slug          String        @unique  // URL-friendly code
  accessType    String        // "public" | "password" | "email" | "whitelist"
  password      String?       // Hashed, if password-protected
  whitelist     String[]      // Allowed emails for whitelist type
  expiresAt     DateTime?
  viewLimit     Int?
  viewCount     Int           @default(0)

  project       Project       @relation(fields: [projectId], references: [id])
  accessLogs    AccessLog[]
  conversations Conversation[]

  createdAt     DateTime      @default(now())
}

model AccessLog {
  id            String      @id @default(cuid())
  shareLinkId   String
  viewerEmail   String?
  viewerName    String?
  viewerIp      String?
  sessionId     String
  accessedAt    DateTime    @default(now())

  shareLink     ShareLink   @relation(fields: [shareLinkId], references: [id])
}

model Conversation {
  id            String      @id @default(cuid())
  projectId     String
  shareLinkId   String?
  sessionId     String      @unique
  viewerEmail   String?
  viewerName    String?
  userId        String?     // If viewer creates account

  messages      Json        // Array of { role, content, timestamp }
  messageCount  Int         @default(0)

  // AI-generated insights (for creator analytics)
  summary       String?
  keyTopics     String[]
  sentiment     String?     // "positive" | "neutral" | "concerned"
  actionItems   String[]

  startedAt     DateTime    @default(now())
  endedAt       DateTime?
  savedAt       DateTime?   // When viewer saved to account

  project       Project     @relation(fields: [projectId], references: [id])
  shareLink     ShareLink?  @relation(fields: [shareLinkId], references: [id])
  user          User?       @relation(fields: [userId], references: [id])
  events        AnalyticsEvent[]
}

model AnalyticsEvent {
  id              String        @id @default(cuid())
  conversationId  String
  eventType       String        // "message_sent" | "document_opened" | "section_viewed"
  eventData       Json
  timestamp       DateTime      @default(now())

  conversation    Conversation  @relation(fields: [conversationId], references: [id])
}
```

---

## Conversion Funnels & Drop-off Points

### Viewer Funnel

```
Access Gate → Engage → Complete Conversation → Convert
   100%        70%           90%                 40%
```

**Drop-off Analysis:**

| Stage | Drop Rate | Reason | Mitigation |
|-------|-----------|--------|------------|
| Access Gate | 30% | Friction (email required) | Clear value prop, trust indicators |
| Engage | 10% | Poor first impression | Better welcome message, faster response |
| Convert | 60% | No immediate need | Stronger value prop, reduced friction |

### Return Visitor Behavior

- **Already familiar:** Expects conversational experience
- **More efficient:** Jumps straight to specific questions
- **Higher engagement:** 7-10 questions, 25-30 min
- **Higher conversion:** 90% save conversation if prompted

---

## Implementation Priorities

### Must Have (Phase 7-8 Core)
1. Access gate with all access types (public, password, email, whitelist)
2. Chat interface with streaming responses
3. Document reference parsing (`[DOC:file:section]`)
4. Auto-open document panel on citation click
5. Basic responsive layout

### Should Have (Phase 8 Polish)
1. Document section highlighting
2. Auto-scroll to referenced sections
3. File explorer sidebar for multi-doc navigation
4. Session persistence (return to same spot)
5. Mobile-optimized single-panel view

### Could Have (Phase 9 Conversion)
1. Conversion modal with account creation
2. OAuth options (Google, GitHub, Microsoft)
3. Conversation saving to account
4. Summary PDF generation
5. "Documents updated" notifications

### Won't Have (Future)
1. White-label/custom branding
2. Custom domain support
3. Offline access
4. Real-time collaboration

---

## Open Questions

1. **Session Lifecycle:** When does a viewer session "end"? Timer-based, manual close, or navigation away?

2. **Conversion Trigger:** Show modal at end of conversation, on leave intent, or after X messages?

3. **Anonymous Tracking:** How much viewer behavior to track before account creation? Privacy implications?

4. **Return Experience:** If viewer returns without account, can they resume previous conversation?

5. **Mobile Documents:** Full document viewer in modal, or simplified inline preview?

---

## Related Documentation

| Document | Location | Relevance |
|----------|----------|-----------|
| Main Spec | `conversational-document-ide-spec.md` | Sections 2, 3, 5; Wireframes 9-11 |
| User Journeys | `user-journey-flows.csv` | Phases 7-9 for Board Member, Investor |
| Flow Diagrams | `journey-flow-diagrams.csv` | FLOW 2: Board Member First View |
| SharePage | `frontend/src/pages/SharePage.tsx` | Current implementation |
| ChatInterface | `frontend/src/components/ChatInterface.tsx` | Chat component |
| DocumentViewer | `frontend/src/components/DocumentViewer.tsx` | Doc rendering |

---

## Next Steps

1. **Gap Analysis:** Compare current `SharePage.tsx` implementation against this scaffold
2. **Prioritize:** Decide which "Should Have" items are critical for first receiver testing
3. **Design Review:** Validate mobile experience approach
4. **API Audit:** Ensure all needed endpoints exist or are planned
5. **Create Spec:** Convert this scaffold into actionable implementation spec
