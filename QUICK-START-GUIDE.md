# Quick Start Guide - Conversational Document IDE Development

## 📚 Document Set Overview

You have **two companion documents** designed to work together:

### 1. **conversational-document-ide-spec.md** (Technical Specification)
**What it contains:**
- Complete technical architecture
- Database schemas
- API endpoints
- UI/UX specifications with 15 detailed ASCII wireframes
- Component recommendations (shadcn MCP integration)
- Development phases
- Code examples

**When to use:**
- Building specific features
- Understanding technical requirements
- Designing UI components
- Writing API endpoints
- Structuring database

### 2. **user-journey-flows.xlsx** (User Experience Map)
**What it contains:**
- **Sheet 1**: User Journeys Matrix - All users × All phases
- **Sheet 2**: Journey Flow Diagrams - Detailed step-by-step flows with timing
- **Sheet 3**: Key Success Metrics - Target KPIs for every phase

**When to use:**
- Understanding user motivations
- Designing user flows
- Setting success metrics
- Identifying drop-off points
- Planning features by user impact

---

## 🎯 How to Use These Together

### Scenario 0: Understanding the Context Layer System

**This project builds on a proven LLM architecture.** Before diving into features, understand how the agent configuration works.

**The Magic: Interview Responses → Context Layers → AI Behavior**

```
User Interview                Context Layers                 AI Agent
─────────────────────────────────────────────────────────────────────

"Who's your audience?"    →   AUDIENCE Layer          →    Knows to speak
"Board members"               - Primary: board_members      to executives
                              - Expertise: business
                              - Dynamic: advisory

"What communication       →   COMMUNICATION Layer     →    Adjusts tone,
 style?"                      - Tone: professional_         uses business
"Professional but              approachable                  language with
 approachable"                - Use examples: true          examples

"What to emphasize?"      →   CONTENT Layer          →    Prioritizes these
"ROI, risks, timeline"        - Emphasis: [ROI, risks,      topics in responses
                                timeline]
                              - Speculation: false

"Proactive questions?"    →   ENGAGEMENT Layer       →    Asks strategic
"How does this align          - Proactive: [questions]      questions during
 with Q3 strategy?"           - Actions: [follow-ups]       conversation
```

**How It Works Technically:**

1. **Interview Phase (Phase 4)**:
   - User answers questions in chat interface
   - Responses stored in `AgentConfig.interviewData`
   - System calls `createContextLayersFromInterview()`
   - Creates 3-4 `ContextLayer` records with categories

2. **Composition Phase (Phase 8 - Viewer Chat)**:
   - Viewer sends message
   - Backend calls `buildSystemPrompt(projectId)`
   - Fetches all active context layers, ordered by priority
   - Composes into structured system prompt
   - LLM receives full context before responding

3. **The System Prompt Structure**:
```markdown
# AI AGENT CONFIGURATION

You are an AI representative for a document collection...

## AUDIENCE CONFIGURATION

### Audience Profile
Primary Audience: Board members and investors
Expertise Level: Business executive
Relationship: Advisory

Anticipated Questions:
- What's the ROI timeline?
- How does this compare to competitors?

---

## COMMUNICATION CONFIGURATION

### Communication Style
Tone: Professional but approachable
Style: Business-focused, clear, and direct
Citation Style: Always cite specific document sections

---

## CONTENT CONFIGURATION

### Content Strategy
Main Purpose: Explain IP framework for board review

Emphasis Areas:
- ROI projections
- Risk mitigation
- Timeline

Speculation: Not allowed - stick to documented facts only

---

## ENGAGEMENT CONFIGURATION

### Engagement Strategy
Proactive Questions to Guide Conversation:
- "How does this align with your Q3 strategy?"
- "What concerns do you have about timeline?"

---

## DOCUMENT REFERENCING

When citing content from documents:
1. Always cite specific document and section
2. Use format: [DOC:filename:section-id]
3. Frontend will auto-open and highlight
```

**Key Insights:**

- Context layers are **modular** - each category is independent
- Layers are **ordered by priority** - consistent composition
- Content is **plain text** - LLM reads it naturally
- Metadata is **structured JSON** - UI can display/edit
- System is **extensible** - add new categories easily

**Example: How "Emphasis Areas" Works**

```typescript
// Interview processor creates content layer
await prisma.contextLayer.create({
  data: {
    projectId,
    category: 'content',
    priority: 3,
    content: `
Emphasis Areas:
- ROI projections
- Risk mitigation
- Timeline

When answering questions, prioritize information about these topics.
Always tie responses back to these key concerns when relevant.
    `,
    metadata: {
      emphasisAreas: ['ROI projections', 'Risk mitigation', 'Timeline']
    }
  }
})

// At chat time, this becomes part of system prompt
// LLM naturally emphasizes these topics in responses
```

**Why This Architecture?**

✅ **Flexible** - Easy to add new interview questions → new context  
✅ **Transparent** - Creator can see/edit generated layers  
✅ **Performant** - Context composed once per chat, cached  
✅ **Maintainable** - Each category is separate, clear responsibility  
✅ **Testable** - Can test each layer's effect independently  

---

### Scenario 1: Building the Agent Configuration Feature

**Step 1 - Understand the User Journey:**
1. Open `user-journey-flows.xlsx`
2. Go to "User Journeys Matrix" sheet
3. Find "Document Creator" row → "Phase 4: Agent Configuration" column
4. Read what creator does: "Answers 5 essential questions... 40% complete deep dive"

**Step 2 - See the Detailed Flow:**
1. Go to "Journey Flow Diagrams" sheet
2. Find "FLOW 1: DOCUMENT CREATOR" → "Step 4: Agent Configuration Interview"
3. See timing: 10-15 minutes
4. See decision points: 60% skip after essentials, 40% continue
5. See user anxiety: "It's learning my needs" satisfaction point

**Step 3 - Check Success Metrics:**
1. Go to "Key Success Metrics" sheet
2. Find "Configuration completion rate: >85%"
3. Find "Upload to configured agent: <20 minutes"
4. These are your targets

**Step 4 - Build Using Spec:**
1. Open `conversational-document-ide-spec.md`
2. Find "1. AI Agent Onboarding System" section
3. See Phase 4 reference: "📊 Creator Journey Phase 4 | 90% completion rate"
4. Follow technical implementation details
5. Reference Wireframe #3 for UI design
6. Use shadcn MCP for component generation

**Result:** You've built a feature that:
- Matches user expectations (from journey)
- Hits success metrics (from metrics sheet)
- Implements correctly (from spec)
- Uses right UI pattern (from wireframes)

---

### Scenario 2: Optimizing Viewer Conversion

**Problem:** Conversion rate from viewer to account is below target

**Step 1 - Understand Current Journey:**
```
user-journey-flows.xlsx → Journey Flow Diagrams → FLOW 2 → Step 9
```
Shows: "DECISION POINT: Create account? • 40% convert • 60% skip"

**Step 2 - Identify Friction Points:**
```
Journey shows mental considerations:
- Just had valuable experience ✓
- Might want to reference later ?
- Minimal friction to sign up ?
- Sees potential for own use ?
```

**Step 3 - Check What Matters:**
```
User Journeys Matrix → Board Member → Phase 9
See: "Sees 'Save Conversation' modal... 40% skip, 60% consider"
```

**Step 4 - Review Current Implementation:**
```
conversational-document-ide-spec.md → "5. Viewer Conversion Strategy"
See: Wireframe #9 (Conversion Modal)
Check: Copy, benefits listed, friction points
```

**Step 5 - Hypothesize Improvements:**
Based on journey insights:
- Add social proof ("5,000 consultants trust us")
- Show specific value ("You asked 7 questions - save these insights")
- Reduce perceived commitment ("Free forever, no credit card")
- Add urgency ("This conversation expires in 24 hours")

**Step 6 - Implement & Measure:**
```
Key Success Metrics → "Viewer to account: >40%"
Test: Did changes improve this metric?
```

---

### Scenario 3: Planning a New Feature

**New Feature Idea:** Real-time collaboration on document annotations

**Step 1 - Map to User Journeys:**
```
Questions to answer:
- Which users need this? (Check User Journeys Matrix)
- At which phase? (Map to Phase 1-12)
- What's the use case? (Review Journey Flow Diagrams)
```

**Step 2 - Check If It Fits Current Flows:**
```
Journey Flow Diagrams shows:
- Phase 8: Viewers engage individually (15-25 min)
- Phase 10: Creators review summaries (5-10 min daily)

New feature would add:
- Phase 8b: Multiple viewers annotate simultaneously
- New interaction pattern not in current flows
```

**Step 3 - Define Success Metrics:**
```
Key Success Metrics sheet:
Add new metrics:
- "Concurrent annotation sessions: >2 per document"
- "Annotation → conversation rate: >50%"
- "Collaboration time saved: >30 min per project"
```

**Step 4 - Update Both Documents:**
```
1. Add to user-journey-flows.xlsx:
   - New row or expand Phase 8
   - Show collaboration flow
   
2. Add to conversational-document-ide-spec.md:
   - New feature section
   - Technical architecture updates
   - New wireframes
   - API endpoints
```

---

## 🎨 Using Wireframes with Journeys

### The 15 Wireframes Map to User Journeys:

| Wireframe | Phase | User Type | Journey Reference |
|-----------|-------|-----------|-------------------|
| #1 - Creator Dashboard | 1, 10 | Creator | Flow 1 Step 1, Flow 3 |
| #2 - Document Upload | 2 | Creator | Flow 1 Step 2 |
| #3 - AI Agent Interview | 4 | Creator | Flow 1 Step 4 |
| #4 - Viewer Chat Layout | 8 | Viewer | Flow 2 Step 8 |
| #5 - Share Modal | 6 | Creator | Flow 1 Step 6 |
| #6 - Email Gate | 7 | Viewer | Flow 2 Step 7 |
| #7 - Analytics Dashboard | 10 | Creator | Flow 3 Step 10 |
| #8 - Conversation Detail | 10 | Creator | Flow 3 Step 10 |
| #9 - Conversion Modal | 9 | Viewer | Flow 2 Step 9 |
| #10 - Document Viewer | 8 | Viewer | Flow 2 Step 8 |
| #11 - Mobile View | 8 | Viewer | Flow 2 Step 8 |
| #12 - Agent Preview | 5 | Creator | Flow 1 Step 5 |
| #13 - Email Whitelist | 6 | Creator | Flow 1 Step 6 |
| #14 - Document Analysis | 3 | Creator | Flow 1 Step 3 |
| #15 - Project Settings | 11 | Creator | Flow 3 Step 11 |

**How to use this mapping:**

When building wireframe #4 (Viewer Chat Layout):
1. This is Phase 8 for Viewer user type
2. Go to Flow 2, Step 8 in journey flows
3. See: "15-20 minutes, 5-8 questions, documents auto-open"
4. Design UI to support this interaction pattern
5. Check metrics: ">5 questions per session, >10 minutes time spent"

---

## 🔄 Iterative Development Workflow

### For Each Sprint:

**1. Choose Features (From Spec)**
```
conversational-document-ide-spec.md → Development Phases → Phase 1-4
Select: What features to build this sprint
```

**2. Understand Users (From Journeys)**
```
user-journey-flows.xlsx → User Journeys Matrix
Review: What users experience with these features
```

**3. Set Targets (From Metrics)**
```
user-journey-flows.xlsx → Key Success Metrics
Define: What success looks like numerically
```

**4. Build (Using Spec + shadcn MCP)**
```
conversational-document-ide-spec.md → Technical specs + Wireframes
shadcn MCP → Generate components
```

**5. Test Against Journeys**
```
Does implementation match:
- Timing expectations? (from flows)
- User mental models? (from flows)
- Drop-off patterns? (from metrics)
```

**6. Measure & Iterate**
```
Key Success Metrics → Track actual vs. target
Journey Flow Diagrams → Identify new friction points
Update both documents based on learnings
```

---

## 💡 Pro Tips

### Tip 1: Cross-Reference Constantly
Every feature in the spec has a "📊" marker pointing to relevant journey phases. Use these!

### Tip 2: User Journey Matrix is Your North Star
When designing any feature, open the matrix and read the relevant cell. It tells you exactly what that user needs at that moment.

### Tip 3: Flows Show Psychology, Not Just Steps
Flow 2 Step 8 doesn't just say "user asks questions" - it shows:
- "MOMENT OF TRUTH: First question"
- "60% engaged, 30% cautious, 10% bounce"
- "Board Member reaction: 'Wow, this is actually helpful!'"

Design for these emotional states!

### Tip 4: Metrics Prevent Scope Creep
If a feature doesn't map to metrics in the success sheet, question whether it's needed.

### Tip 5: Update Both Documents as You Learn
Real user behavior will differ from assumptions. Keep both documents current:
- Update journey flows with actual timing, drop-offs
- Update spec with technical learnings
- Update metrics with achieved baselines

---

## 🚀 Starting Implementation in Claude Code

### Recommended First Steps:

1. **Read both documents completely** (30-45 minutes)
   - Spec for technical understanding
   - Journey flows for user understanding

2. **Set up project structure** (follow spec)
   ```
   /conversational-doc-ide
     /frontend
     /backend
     /shared
     docker-compose.yml
   ```

3. **Build Phase 1 features in order** (per spec Development Phases)
   - Start with document upload (Phases 2-3)
   - Reference Flow 1 Steps 2-3 constantly
   - Check metrics after each feature

4. **Use shadcn MCP for all UI components**
   - Let AI generate components from wireframes
   - Ensures consistency and speed

5. **Test each phase against journey flows**
   - Does Phase 2 (upload) take 3-5 minutes? (Flow 1)
   - Do users understand analysis results? (Flow 1 Step 3)
   - Is configuration taking <20 minutes? (Metrics)

6. **Iterate based on real data**
   - Update journey flows with actual timing
   - Adjust spec if architecture needs change
   - Keep metrics sheet current with actuals

---

## 📞 Questions to Ask When Building

### For Every Feature:
1. **Which user type needs this?** → Check User Journeys Matrix
2. **At what phase?** → Map to Phase 1-12
3. **What's their mental state?** → Check Journey Flow Diagrams
4. **How long should it take?** → Check Flows timing
5. **What's success look like?** → Check Key Success Metrics
6. **What does the UI look like?** → Check Spec wireframes
7. **How does it technically work?** → Check Spec architecture

### For Every Decision:
1. **Does this improve a journey metric?** → Justify with metrics
2. **Does this add or reduce friction?** → Test against flows
3. **Is this phase-appropriate?** → Verify in User Journeys Matrix
4. **Does this match the mental model?** → Compare to flow descriptions

---

## 🎓 Remember

These documents are **living blueprints**, not rigid specifications:

- ✅ **DO** update them as you learn from real users
- ✅ **DO** use them to settle design debates (data over opinions)
- ✅ **DO** reference them in code comments and PRs
- ✅ **DO** share them with stakeholders to align on vision

- ❌ **DON'T** treat them as unchangeable
- ❌ **DON'T** build features not mapped to journeys
- ❌ **DON'T** ignore metrics when they reveal problems
- ❌ **DON'T** forget to update when reality differs from plan

---

**Ready to build?** Start with Phase 1 of the spec, Flow 1 of the journeys, and keep both documents open as you code! 🚀
