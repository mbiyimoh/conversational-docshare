# 📦 Conversational Document IDE - Complete Documentation Package

This folder contains everything needed to build the conversational document IDE platform from scratch.

**⚡ Built on Proven Architecture**: This project extends a battle-tested LLM system with multi-layer context composition and knowledge management. The foundational architecture is documented in `context-and-knowledge-LLM-synthesis.md` (see [Architecture Integration](#-architecture-integration) below).

---

## 📚 Document Set

### 1. **conversational-document-ide-spec.md** (Primary Technical Specification)
**Size:** ~40 pages | **Type:** Technical specification with wireframes

**Contains:**
- Complete technical architecture (frontend, backend, database)
- 15 detailed ASCII wireframes for all major screens
- API endpoint specifications
- Database schemas (PostgreSQL)
- Component recommendations (shadcn MCP integration)
- 4-phase development plan with timelines
- Code examples and best practices
- Integration with existing LLM system

**Use this for:**
- Technical implementation details
- Building specific features
- Understanding system architecture
- Designing UI components
- Writing code

---

### 2. **user-journey-flows.xlsx** (User Experience Mapping)
**Type:** Multi-sheet Excel workbook

#### Sheet 1: User Journeys Matrix
**Format:** User types (rows) × Experience phases (columns)

**5 User Types:**
1. Document Creator (Consultant)
2. Board Member (First-time Viewer)
3. Investor (Return Visitor)
4. Platform Admin (System)
5. Converted User (Creator)

**12 Experience Phases:**
1. Discovery & Setup
2. Document Upload
3. AI Analysis
4. Agent Configuration
5. Agent Preview
6. Sharing Setup
7. Access & View
8. Conversation
9. Conversion
10. Analytics Review
11. Iteration
12. Retention

**Each cell contains:** What that user type does during that phase

#### Sheet 2: Journey Flow Diagrams
**Format:** Detailed text-based flow diagrams

**3 Complete Flows:**
- **Flow 1:** Document Creator - First Project (30-45 minutes end-to-end)
- **Flow 2:** Board Member - First View (15-25 minutes)
- **Flow 3:** Creator - Analytics & Iteration (Ongoing)

**Each flow includes:**
- Step-by-step breakdown with timing
- User mental states and concerns
- Decision points with conversion percentages
- Drop-off rates and reasons
- Key moments (anxiety points, satisfaction points, confidence points)
- Detailed dialogue examples

#### Sheet 3: Key Success Metrics
**Format:** Organized table of KPIs

**Categories:**
- Creator Activation (sign-up to share flow)
- Viewer Engagement (access to conversation)
- Conversion (viewer to account)
- Creator Retention (ongoing usage)
- Quality Indicators (satisfaction metrics)
- Business Health (financial metrics)

**Each metric includes:**
- Target value
- Measurement method
- Phase mapping

**Use this for:**
- Understanding user motivations
- Designing user flows
- Setting success criteria
- Identifying friction points
- Measuring product success

---

### 3. **QUICK-START-GUIDE.md** (Integration Guide)
**Size:** ~15 pages | **Type:** How-to guide

**Contains:**
- How to use the spec and journey docs together
- Detailed scenarios with step-by-step walkthroughs
- Wireframe-to-journey mapping table
- Phase-to-feature mapping
- Iterative development workflow
- Pro tips for development
- Questions to ask when building

**Use this for:**
- Getting started quickly
- Understanding document relationships
- Learning the workflow
- Making decisions during development

---

## 🎯 How These Work Together

```
┌─────────────────────────────────────────────────────────────┐
│                     DEVELOPMENT WORKFLOW                     │
└─────────────────────────────────────────────────────────────┘

1. UNDERSTAND THE USER
   ↓
   user-journey-flows.xlsx
   → User Journeys Matrix: See what user needs
   → Journey Flow Diagrams: Understand psychology
   → Key Success Metrics: Know what success looks like

2. DESIGN THE SOLUTION
   ↓
   conversational-document-ide-spec.md
   → Architecture: How to build it technically
   → Wireframes: What it should look like
   → API specs: How components communicate

3. IMPLEMENT
   ↓
   QUICK-START-GUIDE.md
   → Scenarios: See examples of doc usage
   → Workflow: Follow development process
   → shadcn MCP: Generate components

4. VALIDATE
   ↓
   user-journey-flows.xlsx → Key Success Metrics
   → Measure: Did we hit targets?
   → Iterate: Update docs with learnings
```

---

## 🚀 Quick Start (5 Minutes)

### If you're a developer about to start coding:

1. **Read** `QUICK-START-GUIDE.md` first (15 min)
2. **Open** both main documents side-by-side
3. **Start** with Phase 1 features in the spec
4. **Reference** journey flows for each feature
5. **Check** success metrics as you build

### If you're a product manager planning features:

1. **Open** `user-journey-flows.xlsx` → User Journeys Matrix
2. **Identify** which phases your feature touches
3. **Read** detailed flows in Journey Flow Diagrams
4. **Set** targets from Key Success Metrics
5. **Refer** developers to spec for implementation

### If you're a designer creating UI:

1. **Review** wireframes in spec (#1-15)
2. **Read** corresponding journey flows
3. **Understand** user mental state at each point
4. **Design** to reduce friction shown in flows
5. **Use** shadcn MCP for component generation

---

## 📊 Document Cross-Reference System

The spec uses **📊** markers to point to relevant journey sections:

**Example from spec:**
```markdown
### 1. AI Agent Onboarding System

📊 Corresponds to Phases 2-5 in User Journey Matrix | See Flow 1

**Step 1: Document Upload & Analysis (Phase 2-3: 4-7 minutes)**
📊 Creator Journey Phase 2-3 | 95% completion rate
```

**What this means:**
1. Open `user-journey-flows.xlsx`
2. Go to User Journeys Matrix sheet
3. Find "Document Creator" row, "Phase 2" and "Phase 3" columns
4. Read what creator experiences
5. Go to Journey Flow Diagrams sheet
6. Find Flow 1, Steps 2-3 for detailed breakdown
7. Check Key Success Metrics for targets

---

## 🎨 Wireframe Index

All 15 wireframes in spec mapped to journeys:

| # | Screen Name | Phase | Journey Flow |
|---|-------------|-------|--------------|
| 1 | Creator Dashboard | 1, 10 | Flow 1-1, Flow 3 |
| 2 | Document Upload | 2 | Flow 1-2 |
| 3 | AI Agent Interview | 4 | Flow 1-4 |
| 4 | Viewer Chat Layout | 8 | Flow 2-8 |
| 5 | Share Modal | 6 | Flow 1-6 |
| 6 | Email Gate | 7 | Flow 2-7 |
| 7 | Analytics Dashboard | 10 | Flow 3-10 |
| 8 | Conversation Detail | 10 | Flow 3-10 |
| 9 | Conversion Modal | 9 | Flow 2-9 |
| 10 | Document Viewer | 8 | Flow 2-8 |
| 11 | Mobile View | 8 | Flow 2-8 |
| 12 | Agent Preview | 5 | Flow 1-5 |
| 13 | Email Whitelist | 6 | Flow 1-6 |
| 14 | Document Analysis | 3 | Flow 1-3 |
| 15 | Project Settings | 11 | Flow 3-11 |

---

## 📈 Key Numbers to Remember

From Journey Flows:
- **Creator first project:** 30-45 minutes total
- **Viewer first session:** 15-25 minutes
- **Return visitor session:** 25-30 minutes
- **Daily analytics check:** 5-10 minutes

From Success Metrics:
- **Conversion rate target:** >40% viewers to accounts
- **Engagement target:** >5 questions per session
- **Retention target:** >80% return within week
- **Configuration target:** <20 minutes to complete

From Drop-off Analysis:
- **Sign-up:** 20% drop (trust/value)
- **Access gate:** 30% drop (friction)
- **Conversion offer:** 60% decline (no immediate need)
- **Configuration:** 10% drop (complexity)

---

## 🔄 Maintaining These Documents

### As you build and learn:

**Update user-journey-flows.xlsx when:**
- Actual timing differs from estimates
- New friction points discovered
- Conversion rates measured
- User feedback received
- Drop-off patterns identified

**Update conversational-document-ide-spec.md when:**
- Architecture changes
- New technical requirements
- API endpoints added/changed
- Database schema evolves
- New wireframes needed

**Update QUICK-START-GUIDE.md when:**
- Common questions arise
- New scenarios discovered
- Workflow improvements found
- Better examples identified

---

## 💻 Technical Stack Summary

From spec, for quick reference:

**Frontend:**
- React + Vite
- Tailwind CSS
- shadcn/ui components (via shadcn MCP)
- PDF.js (document rendering)
- Mammoth.js (Word docs)
- SheetJS (Excel)
- Framer Motion (animations)

**Backend:**
- Express.js
- PostgreSQL
- Vercel AI SDK (swappable LLM models)
- pdf-parse (PDF text extraction)

**Deployment:**
- Docker Compose
- Frontend container
- Backend container
- Document storage volume

---

## 🎓 Learning Path

### Week 1: Understanding
- Day 1-2: Read all three documents completely
- Day 3: Study User Journeys Matrix thoroughly
- Day 4: Review all Journey Flow Diagrams
- Day 5: Understand technical architecture in spec

### Week 2: Planning
- Day 1-2: Map Phase 1 features to journeys
- Day 3: Set up development environment
- Day 4: Create component inventory
- Day 5: Build implementation roadmap

### Week 3+: Building
- Follow 4-phase development plan in spec
- Reference journeys for every feature
- Check metrics after each sprint
- Update docs with learnings

---

## 🤝 Using with Claude Code

When working in Claude Code:

1. **Upload both main docs** (spec + journey flows)
2. **Reference specific sections** in prompts:
   - "Build Phase 4 from spec, considering Flow 1 Step 4"
   - "Create wireframe #3 using shadcn MCP"
   - "Implement to hit metrics from Key Success Metrics sheet"

3. **Iterate with feedback:**
   - "Flow 2 shows users bounce at X - how should we fix?"
   - "Metrics show conversion below target - improve Phase 9"

---

## ❓ FAQ

**Q: Which document should I read first?**
A: Start with QUICK-START-GUIDE.md, then spec for technical, then journeys for user understanding.

**Q: Do I need to read everything before starting?**
A: Read QUICK-START-GUIDE completely. For others, read relevant sections as you build each feature.

**Q: What if actual behavior differs from journeys?**
A: Update the journey flows with real data! These are living documents.

**Q: How do I use shadcn MCP?**
A: Spec includes integration notes. Use it to generate all UI components from wireframes.

**Q: Can I skip the journey flows?**
A: No - they explain WHY features exist and HOW users think. Critical for good UX.

**Q: What's the MVP?**
A: Phase 1 in spec: PDF upload, basic agent config, public sharing, chat + viewer. See spec Development Phases section.

---

## 📞 Support

If you have questions while building:

1. Check QUICK-START-GUIDE.md scenarios
2. Search spec for technical details
3. Review journey flows for user context
4. Look at success metrics for targets
5. Cross-reference using 📊 markers

---

## 🏗️ Architecture Integration

### Built on Proven Foundations

This project **extends a production-tested LLM architecture** rather than building from scratch. The foundational system is documented in `context-and-knowledge-LLM-synthesis.md`.

**What We're Reusing:**
- ✅ Multi-layer context composition (Vercel AI SDK)
- ✅ PostgreSQL + Prisma ORM patterns
- ✅ Priority-based context layer ordering
- ✅ Knowledge file storage in database
- ✅ Streaming chat with `useChat` hook
- ✅ Context caching and graceful degradation

**What We're Adding:**
- 🆕 Multi-tenant user model (multiple creators)
- 🆕 Agent configuration via interview → context layers
- 🆕 Document-centric knowledge with outlines
- 🆕 Share-link access control
- 🆕 Viewer conversation tracking & analytics
- 🆕 Document reference system (`[DOC:filename:section]`)

### The Context Layer Magic

**How Interview Responses Become AI Behavior:**

```
Interview Questions          Context Layers              AI Agent Behavior
─────────────────────────────────────────────────────────────────────────

"Who's your audience?"   →   category: "audience"   →   Speaks to executives
"Board members"              content: "Primary:          appropriately
                             board_members..."

"Communication style?"   →   category: "communication" → Uses professional
"Professional but            content: "Tone:             tone with examples
 approachable"               professional_approachable"

"What to emphasize?"     →   category: "content"    →   Prioritizes ROI,
"ROI, risks, timeline"       content: "Emphasis:         risk, timeline in
                             [ROI, risks, timeline]"     responses

"Proactive questions?"   →   category: "engagement" →   Asks strategic
"How align with Q3?"         content: "Questions:        questions during
                             [...]"                      conversation
```

**At Runtime:**
1. Viewer sends message to `/api/chat`
2. Backend calls `buildSystemPrompt(projectId)`
3. Fetches context layers: `audience`, `communication`, `content`, `engagement`
4. Composes structured system prompt
5. LLM reads combined context before generating response

**Result:** Agent behaves exactly as configured during interview, without any hardcoding.

### Database Schema Extensions

**Base System:**
```prisma
model Project {
  contextLayers   ContextLayer[]
  knowledgeFiles  KnowledgeFile[]
}

model ContextLayer {
  name      String
  priority  Int
  content   String @db.Text
  isActive  Boolean
}
```

**Our Extensions:**
```prisma
model User {
  id        String
  email     String
  projects  Project[]  // Multi-tenant
}

model Project {
  ownerId        String      // Link to User
  documents      Document[]   // Replaces KnowledgeFile
  agentConfig    AgentConfig // Structured config
  shareLinks     ShareLink[] // Access control
}

model ContextLayer {
  category   String  // "audience"|"communication"|"content"|"engagement"
  metadata   Json    // Structured interview responses
}

model Document {
  fullText   String @db.Text  // Extracted content
  outline    Json              // Section structure
  summary    String            // AI-generated
  keyTopics  String[]          // Extracted topics
}

model ShareLink {
  shareCode    String @unique
  accessType   String
  whitelist    String[]
  conversations Conversation[]
}

model Conversation {
  messages      Json
  summary       String
  actionItems   String[]
  // AI-generated insights for creator
}
```

### Code Reuse Map

| Component | Base System | This Project | Changes |
|-----------|-------------|--------------|---------|
| **Context Composition** | `lib/contextComposer.ts` | `lib/contextComposer.ts` | ✅ Reused, added category filtering |
| **Chat API** | `app/api/chat/route.ts` | `app/api/chat/route.ts` | ✅ Reused, added model selection |
| **Layer CRUD** | `app/api/layers/*` | `app/api/context-layers/*` | ✅ Reused, added category field |
| **Database** | Prisma schema | Enhanced schema | 🆕 Added User, Document, ShareLink, Conversation |
| **Document Processing** | N/A | `lib/documentProcessor.ts` | 🆕 New: PDF/DOCX/XLSX extraction |
| **Interview Logic** | N/A | `lib/interviewProcessor.ts` | 🆕 New: Responses → Context layers |
| **Analytics** | N/A | `lib/analytics.ts` | 🆕 New: Conversation tracking |

### Migration from Base System

If you have the base system running:

**Step 1: Database Migration**
```bash
# Add new models
npx prisma migrate dev --name add_users_documents_sharing

# Migrate existing projects
# - Add ownerId field
# - Convert KnowledgeFiles → Documents
# - Add category to ContextLayers
```

**Step 2: Update Context Composer**
```typescript
// Before (base system)
const layers = await prisma.contextLayer.findMany({
  where: { projectId, isActive: true },
  orderBy: { priority: 'asc' }
})

// After (this project)
const layers = await prisma.contextLayer.findMany({
  where: { 
    projectId, 
    isActive: true,
    category: { in: ['audience', 'communication', 'content', 'engagement'] }
  },
  orderBy: { priority: 'asc' }
})
```

**Step 3: Add New Features**
- Document upload & processing (new)
- Interview system (new)
- Share links with access control (new)
- Viewer conversations & analytics (new)

### Key Architectural Decisions

**Why store document text in DB?**
- Faster retrieval (no file I/O)
- Easier full-text search
- Better for scaling (DB replication)
- Atomic transactions with metadata

**Why context layer categories?**
- Clear separation of concerns
- Easy to filter/display in UI
- Logical grouping for composition
- Extensible for future categories

**Why NOT edit layers directly?**
- Layers generated from interview = single source of truth
- Prevents drift between config and behavior
- Can regenerate layers if interview changes
- Creator edits interview, not raw context

**Why separate AgentConfig from ContextLayers?**
- AgentConfig = structured data (JSON)
- ContextLayers = LLM-readable text
- Easy to change composition logic without touching config
- Config is source, layers are derived

### Reference Documentation

**For Developers Building Features:**
1. Read `context-and-knowledge-LLM-synthesis.md` first (30 min)
2. Understand context layer composition patterns
3. See how we extend those patterns in spec
4. Follow code examples in both docs

**For Understanding Architecture:**
- Base patterns: `context-and-knowledge-LLM-synthesis.md`
- Extensions: `conversational-document-ide-spec.md` → "Existing System Integration"
- User flows: `user-journey-flows.xlsx`
- Quick scenarios: `QUICK-START-GUIDE.md` → Scenario 0

---

## ✅ Pre-Implementation Checklist

Before writing code:

- [ ] Read QUICK-START-GUIDE.md completely
- [ ] Review User Journeys Matrix for feature's phases
- [ ] Read relevant Journey Flow Diagrams
- [ ] Note success metrics for feature
- [ ] Study wireframes in spec
- [ ] Understand technical architecture
- [ ] Set up development environment
- [ ] Install shadcn MCP for UI generation
- [ ] Create feature branch
- [ ] Open both docs side-by-side

---

**🎯 You now have everything needed to build the conversational document IDE platform!**

Start with QUICK-START-GUIDE.md → Then reference spec and journeys as you build → Iterate based on real user data → Keep docs updated → Ship amazing product! 🚀
