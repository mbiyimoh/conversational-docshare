# AI Agent UX & Profile Synthesis Improvements

## Status
Draft

## Authors
Claude | November 27, 2024

## Overview

This specification addresses two interrelated improvements to the AI Agent configuration experience:

1. **Sub-Tab Navigation**: Replace the linear interview→summary→profile flow with persistent sub-tabs that allow users to easily switch between "Interview Responses" and "Agent Profile" views
2. **Profile Synthesis Quality**: Enhance the LLM prompt to preserve user's specific terminology, examples, and details instead of genericizing them

These improvements work together: when users can easily compare their interview responses to the generated profile, they can verify their specifics were preserved, building trust in the system.

## Background/Problem Statement

### Problem 1: Navigation Friction

**Current State**: The AI Agent tab uses a linear three-step flow managed by internal view state:
```typescript
const [view, setView] = useState<'interview' | 'summary' | 'profile'>('interview')
```

Users complete the interview → see a summary → continue to profile. Navigation back requires clicking "Edit Interview" which returns to step 0 of the interview. There's no way to quickly toggle between viewing responses and the generated profile.

**User Feedback**: "The AI agent tab should be split into two pieces: the interview responses and the AI agent profile. It should be easier and more intuitive to move back-and-forth between these two parts."

### Problem 2: Loss of Specificity in Profile Generation

**Current State**: The `SYNTHESIS_PROMPT` in `profileSynthesizer.ts` instructs the LLM to:
- Generate "2-4 sentences" per section (too brief for detailed input)
- "Be specific and actionable" (vague, unenforceable)
- Uses `temperature: 0.7` (too creative, encourages paraphrasing)
- Uses `max_tokens: 1000` (only ~200 tokens per section)

**User Feedback**: "There was a ton of rich specificity in my interview answers that got almost completely washed out in the profile. If users don't see those specific things represented faithfully, they won't trust that this agent is going to do a good job of representing the narrative and positioning they wanted."

**Example of Genericization**:
- User input: "Fortune 500 CFOs evaluating Q2 budget allocation"
- Current output: "business executives interested in your solutions" ❌
- Expected output: "Fortune 500 CFOs evaluating Q2 budget allocation" ✅

## Goals

- Enable instant switching between Interview Responses and Agent Profile views via persistent sub-tabs
- Show source attribution on each profile section ("Based on: [question]")
- Provide expandable comparison showing original interview response alongside generated profile content
- Preserve user's exact terminology, proper nouns, metrics, and specific examples in generated profiles
- Build user trust by making the interview→profile transformation transparent

## Non-Goals

- Redesigning the interview questions themselves
- Adding new profile sections beyond the existing 5
- Changing the main tab structure in ProjectPage
- Real-time profile updates as interview answers change (existing auto-regeneration is sufficient)
- First-time user onboarding overlay (future enhancement)

## Technical Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| React | ^18.x | Frontend framework |
| TypeScript | ^5.7.2 | Type safety |
| Tailwind CSS | ^3.x | Styling |
| OpenAI API | gpt-4-turbo | Profile synthesis |

No new external libraries required. Uses existing project patterns for tabs and state management.

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ProjectPage.tsx                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Main Tabs: [Documents] [AI Agent] [Share] [Analytics]│   │
│  └─────────────────────────────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              AgentInterview.tsx                      │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │ Sub-Tabs: [Interview Responses] [Agent Profile]│  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  │                      │                               │   │
│  │         ┌────────────┴────────────┐                 │   │
│  │         ▼                         ▼                 │   │
│  │  ┌─────────────┐         ┌──────────────┐          │   │
│  │  │  Responses  │         │ AgentProfile │          │   │
│  │  │    View     │         │  (enhanced)  │          │   │
│  │  └─────────────┘         └──────────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Part 1: Frontend - Sub-Tab Navigation

#### 1.1 State Refactoring in AgentInterview.tsx

**Current State Model**:
```typescript
const [view, setView] = useState<'interview' | 'summary' | 'profile'>('interview')
```

**New State Model**:
```typescript
const [view, setView] = useState<'interview' | 'review'>('interview')
const [reviewTab, setReviewTab] = useState<'responses' | 'profile'>('responses')
```

The `'summary'` and `'profile'` views merge into a unified `'review'` view with sub-tabs.

#### 1.2 Review View Implementation

```typescript
// In AgentInterview.tsx, replace lines 212-328 with:

if (view === 'review') {
  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Your AI Agent Configuration
        </h1>
        <p className="mt-2 text-gray-600">
          Review your interview responses and the generated agent profile
        </p>
      </div>

      {/* Sub-tab navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8" role="tablist">
          <button
            onClick={() => setReviewTab('responses')}
            role="tab"
            aria-selected={reviewTab === 'responses'}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              reviewTab === 'responses'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Interview Responses
          </button>
          <button
            onClick={() => setReviewTab('profile')}
            role="tab"
            aria-selected={reviewTab === 'profile'}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              reviewTab === 'profile'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Agent Profile
          </button>
        </nav>
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {reviewTab === 'responses' ? (
          <InterviewResponsesContent
            interviewData={interviewData}
            onEditQuestion={handleEditQuestion}
          />
        ) : (
          <AgentProfile
            projectId={projectId}
            interviewData={interviewData}
            onContinueToTesting={() => onComplete?.('navigate-to-test')}
            onEditInterview={() => {
              setCurrentStep(0)
              setView('interview')
            }}
          />
        )}
      </div>

      {/* Unified action buttons */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={() => {
            setCurrentStep(0)
            setView('interview')
          }}
          className="rounded-lg px-6 py-2 text-gray-600 hover:bg-gray-100"
        >
          Edit All Responses
        </button>
        <button
          onClick={() => onComplete?.('navigate-to-test')}
          className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
        >
          Continue to Testing
        </button>
      </div>
    </div>
  )
}
```

#### 1.3 AgentProfile.tsx Enhancements

**New Props Interface**:
```typescript
interface AgentProfileProps {
  projectId: string
  interviewData?: InterviewData  // NEW: for source comparison
  onContinueToTesting: () => void
  onEditInterview: () => void
}
```

**Section-to-Question Mapping**:
```typescript
const sectionSourceMap: Record<string, string[]> = {
  identityRole: ['audience', 'purpose'],
  communicationStyle: ['tone'],
  contentPriorities: ['emphasis'],
  engagementApproach: ['questions'],
  keyFramings: ['audience', 'tone', 'emphasis'],
}

const questionLabels: Record<string, string> = {
  audience: 'Primary Audience',
  purpose: 'Main Purpose',
  tone: 'Communication Style',
  emphasis: 'Areas to Emphasize',
  questions: 'Proactive Questions',
}

function getSourceLabel(sectionKey: string): string {
  const sources = sectionSourceMap[sectionKey] || []
  return sources.map(s => questionLabels[s]).join(' + ')
}

function getOriginalResponses(sectionKey: string, data: InterviewData): string {
  const sources = sectionSourceMap[sectionKey] || []
  return sources
    .map(s => data[s])
    .filter(Boolean)
    .join('\n\n---\n\n') || 'No response provided'
}
```

**Enhanced Section Rendering**:
```typescript
<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
  <div className="flex items-start justify-between mb-3">
    <div>
      <h3 className="font-semibold text-gray-900">{section.title}</h3>
      {/* Source attribution */}
      <p className="text-xs text-gray-400 mt-1">
        Based on: {getSourceLabel(sectionKey)}
      </p>
      {section.isEdited && (
        <span className="text-xs text-gray-400 ml-2">• Manually edited</span>
      )}
    </div>
    {!isEditing && (
      <button
        onClick={() => handleEditSection(sectionKey, section.content)}
        className="text-sm text-blue-600 hover:text-blue-700"
      >
        Edit
      </button>
    )}
  </div>

  {/* Section content */}
  {isEditing ? (
    <EditingView />
  ) : (
    <p className="text-gray-700 whitespace-pre-wrap">{section.content}</p>
  )}

  {/* Expandable original response comparison */}
  {interviewData && !isEditing && (
    <details className="mt-4 pt-4 border-t border-gray-100">
      <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-700 select-none">
        Show original response
      </summary>
      <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 italic whitespace-pre-wrap">
        {getOriginalResponses(sectionKey, interviewData)}
      </div>
    </details>
  )}
</div>
```

### Part 2: Backend - Enhanced Profile Synthesis

#### 2.1 New SYNTHESIS_PROMPT

Replace the existing prompt in `profileSynthesizer.ts`:

```typescript
const SYNTHESIS_PROMPT = `You are synthesizing an AI agent profile from interview responses.

## CRITICAL: PRESERVE EXACT LANGUAGE

You MUST preserve the user's EXACT words, terminology, and specific details.
Do NOT paraphrase specifics into generic language. The user chose their words deliberately.

### EXAMPLES OF WHAT NOT TO DO:

User: "Fortune 500 CFOs"
❌ BAD: "business executives"
✅ GOOD: "Fortune 500 CFOs"

User: "ROI, risk mitigation, timeline"
❌ BAD: "business outcomes and project considerations"
✅ GOOD: "ROI, risk mitigation, and timeline"

User: "Professional but approachable"
❌ BAD: "balanced communication style"
✅ GOOD: "professional but approachable"

User: "Q2 2025 budget allocation"
❌ BAD: "budget discussions"
✅ GOOD: "Q2 2025 budget allocation"

## INTERVIEW RESPONSES

Target Audience:
"""
{audience}
"""

Primary Purpose:
"""
{purpose}
"""

Communication Style:
"""
{tone}
"""

Areas to Emphasize:
"""
{emphasis}
"""

Proactive Questions:
"""
{questions}
"""

## OUTPUT REQUIREMENTS

Generate JSON with 5 sections. Each section MUST:
1. Include the user's EXACT terminology - quote their specific words
2. Be 3-5 sentences (longer if the input is detailed)
3. NEVER substitute generic terms for specific ones the user provided
4. Reference concrete details like company types, metrics, timeframes, and proper nouns

{
  "identityRole": "Your agent represents [EXACT purpose]. It serves [EXACT audience description with all specifics preserved]...",
  "communicationStyle": "Your agent communicates in a [EXACT tone descriptors as stated] manner. It [specific behaviors mentioned]...",
  "contentPriorities": "Your agent emphasizes [EXACT emphasis areas listed]. When discussing these topics, it focuses on [preserved specifics]...",
  "engagementApproach": "Your agent asks questions such as: [EXACT questions if provided, or close paraphrases]. It guides conversations toward [specific goals]...",
  "keyFramings": "Your agent frames conversations around [key themes from input]. It positions [preserved concepts and terminology]..."
}

Return ONLY valid JSON. No markdown code blocks, no explanations.`
```

#### 2.2 Updated LLM Parameters

```typescript
// In synthesizeProfile function:
const response = await openai.chat.completions.create(
  {
    model: 'gpt-4-turbo',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that generates JSON responses while preserving user terminology exactly.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,    // CHANGED: Lower = more faithful to input (was 0.7)
    max_tokens: 2000,    // CHANGED: Allow detailed output (was 1000)
  },
  { signal: controller.signal }
)
```

#### 2.3 API Enhancement - Include interviewData in Response

**Backend Controller** (`agent.controller.ts`):
```typescript
export async function getAgentProfile(req: Request, res: Response) {
  // ... existing auth and validation ...

  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
  })

  if (!agentConfig?.profile) {
    throw new NotFoundError('Agent profile')
  }

  res.json({
    profile: agentConfig.profile,
    generatedAt: agentConfig.profileGeneratedAt,
    source: agentConfig.profileSource,
    interviewData: agentConfig.interviewData,  // NEW: Include for frontend comparison
  })
}
```

**Frontend API Type** (`api.ts`):
```typescript
async getAgentProfile(projectId: string) {
  return this.request<{
    profile: AgentProfile
    generatedAt: string
    source: string
    interviewData?: Record<string, string>  // NEW
  }>(`/api/projects/${projectId}/agent/profile`)
}
```

### Data Flow

```
User completes interview
         │
         ▼
┌────────────────────────┐
│ saveAgentConfig()      │
│ - Stores interviewData │
│ - Creates context layers│
│ - Auto-regenerates     │
│   profile if exists    │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ synthesizeProfile()    │
│ - Uses enhanced prompt │
│ - temperature: 0.3     │
│ - max_tokens: 2000     │
│ - Preserves specifics  │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ AgentProfile.tsx       │
│ - Shows 5 sections     │
│ - Source attribution   │
│ - "Show Original"      │
│   expandable           │
└────────────────────────┘
```

## User Experience

### User Flow After Implementation

1. User navigates to project → clicks "AI Agent" tab
2. Completes interview questions (unchanged)
3. On completion, lands in **Review** mode with sub-tabs visible
4. **Interview Responses** tab shows all Q&A pairs with edit capability
5. **Agent Profile** tab shows:
   - Each section with "Based on: [question]" attribution
   - Expandable "Show original response" under each section
   - Specific terminology from interview preserved in profile text
6. User can freely toggle between tabs to compare
7. "Continue to Testing" proceeds to Testing Dojo

### Visual Hierarchy

```
┌─────────────────────────────────────────────────┐
│ Your AI Agent Configuration                      │
│ Review your interview responses and profile      │
├─────────────────────────────────────────────────┤
│ [Interview Responses]  [Agent Profile]           │  ← Sub-tabs
│ ─────────────────────  ────────────────          │
├─────────────────────────────────────────────────┤
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Identity & Role                         Edit │ │
│ │ Based on: Primary Audience + Main Purpose    │ │  ← Source attribution
│ │                                              │ │
│ │ Your agent represents your company to       │ │
│ │ Fortune 500 CFOs evaluating Q2 budget...    │ │  ← Preserved specifics
│ │                                              │ │
│ │ ▶ Show original response                    │ │  ← Collapsed by default
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ [Edit All Responses]          [Continue to Testing] │
└─────────────────────────────────────────────────┘
```

## Testing Strategy

### Unit Tests

**ProfileSynthesizer Tests** (`profileSynthesizer.test.ts`):
```typescript
describe('specificity preservation', () => {
  it('should preserve proper nouns in generated profile', async () => {
    // Purpose: Verify specific company types are not genericized
    const interviewData = {
      audience: 'Fortune 500 CFOs and VP Finance teams',
      purpose: 'Quarterly business review',
    }

    const profile = await synthesizeProfile(interviewData)
    const allContent = Object.values(profile.sections)
      .map(s => s.content)
      .join(' ')

    expect(allContent).toContain('Fortune 500')
    expect(allContent).toContain('CFO')
  })

  it('should preserve metrics and timeframes', async () => {
    // Purpose: Verify specific numbers and dates are retained
    const interviewData = {
      emphasis: '35% cost reduction, $2M savings, Q2 2025 timeline',
    }

    const profile = await synthesizeProfile(interviewData)
    const content = profile.sections.contentPriorities.content

    expect(content).toMatch(/35%|35 percent/)
    expect(content).toMatch(/\$2M|2 million/)
    expect(content).toContain('Q2 2025')
  })

  it('should preserve exact tone descriptors', async () => {
    // Purpose: Verify communication style words are not paraphrased
    const interviewData = {
      tone: 'Professional but approachable, data-driven yet accessible',
    }

    const profile = await synthesizeProfile(interviewData)
    const content = profile.sections.communicationStyle.content.toLowerCase()

    expect(content).toContain('professional')
    expect(content).toContain('approachable')
  })
})
```

**AgentProfile Component Tests**:
```typescript
describe('AgentProfile source attribution', () => {
  it('should display source question labels for each section', () => {
    // Purpose: Verify source attribution UI renders correctly
    render(<AgentProfile projectId="test" interviewData={mockData} {...props} />)

    expect(screen.getByText(/Based on: Primary Audience/)).toBeInTheDocument()
    expect(screen.getByText(/Based on: Communication Style/)).toBeInTheDocument()
  })

  it('should expand to show original response when clicked', async () => {
    // Purpose: Verify expandable comparison UI works
    render(<AgentProfile projectId="test" interviewData={mockData} {...props} />)

    const details = screen.getAllByText('Show original response')[0]
    await userEvent.click(details)

    expect(screen.getByText(mockData.audience)).toBeVisible()
  })
})
```

### Integration Tests

**API Response Shape**:
```typescript
describe('GET /api/projects/:id/agent/profile', () => {
  it('should include interviewData in response', async () => {
    // Purpose: Verify API returns data needed for frontend comparison
    const response = await request(app)
      .get(`/api/projects/${projectId}/agent/profile`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.profile).toBeDefined()
    expect(response.body.interviewData).toBeDefined()
    expect(response.body.interviewData.audience).toBeDefined()
  })
})
```

### E2E Tests

**Playwright Test** (`profile-subtabs.spec.ts`):
```typescript
test.describe('AI Agent Sub-Tab Navigation', () => {
  test('should switch between Interview Responses and Agent Profile tabs', async ({ page }) => {
    // Purpose: Verify sub-tab navigation works end-to-end
    await loginAndNavigateToProject(page)
    await page.click('text=AI Agent')

    // Complete interview flow
    await completeInterview(page)

    // Verify sub-tabs are visible
    await expect(page.locator('text=Interview Responses')).toBeVisible()
    await expect(page.locator('text=Agent Profile')).toBeVisible()

    // Switch to profile tab
    await page.click('text=Agent Profile')
    await expect(page.locator('text=Identity & Role')).toBeVisible()

    // Switch back to responses
    await page.click('text=Interview Responses')
    await expect(page.locator('text=Who is your primary audience')).toBeVisible()
  })

  test('should show original response when expanded', async ({ page }) => {
    // Purpose: Verify expandable comparison feature
    await navigateToProfileTab(page)

    await page.click('text=Show original response >> nth=0')

    // Original interview answer should now be visible
    await expect(page.locator('.bg-gray-50.italic')).toBeVisible()
  })
})
```

## Performance Considerations

| Change | Impact | Mitigation |
|--------|--------|------------|
| Increased `max_tokens` (1000→2000) | Slightly longer generation time, ~2x token cost | Acceptable tradeoff for quality; LLM timeout already 15s |
| Lower `temperature` (0.7→0.3) | No performance impact | N/A |
| Additional `interviewData` in API response | Minimal payload increase (~500 bytes) | Already fetched from DB, no extra query |
| Sub-tab rendering | No significant impact | Content is already loaded, just toggling visibility |

## Security Considerations

- No new security concerns introduced
- `interviewData` is already owned by the authenticated user
- No new API endpoints or authentication changes
- Profile content continues to be sanitized/escaped in frontend

## Documentation

- Update `CLAUDE.md` to document the new sub-tab navigation pattern
- Add inline code comments explaining the section-to-question mapping
- Update any existing developer guides referencing the AI Agent flow

## Implementation Phases

### Phase 1: Backend Prompt Enhancement
- Replace `SYNTHESIS_PROMPT` with specificity-preserving version
- Update LLM parameters: `temperature: 0.3`, `max_tokens: 2000`
- Update `getAgentProfile` to include `interviewData` in response
- Update API type definitions

### Phase 2: Frontend AgentProfile Enhancements
- Add `interviewData` prop to `AgentProfileProps`
- Implement section-to-question mapping
- Add source attribution display under each section title
- Add expandable "Show original response" feature

### Phase 3: Frontend Sub-Tab Navigation
- Refactor `AgentInterview` view state: `'interview' | 'review'`
- Add `reviewTab` state: `'responses' | 'profile'`
- Implement sub-tab navigation UI
- Extract interview responses rendering into reusable component

### Phase 4: Testing & Polish
- Add unit tests for specificity preservation
- Add component tests for source attribution
- Add E2E tests for sub-tab navigation
- Manual QA pass

## Open Questions

1. **Completed**: Should "Show Original" be expandable (collapsed by default) or always visible? → **Answer: Expandable, collapsed by default**

2. **Future consideration**: Should we add visual diff highlighting between original and generated text?

3. **Future consideration**: Should there be a "specificity score" showing what percentage of key terms were preserved?

## References

- Plan document: `/Users/AstroLab/.claude/plans/wild-singing-frost.md`
- Existing profile synthesis spec: `specs/feat-ai-agent-profile-synthesis.md`
- AgentInterview component: `frontend/src/components/AgentInterview.tsx`
- AgentProfile component: `frontend/src/components/AgentProfile.tsx`
- Profile synthesizer service: `backend/src/services/profileSynthesizer.ts`
- Agent controller: `backend/src/controllers/agent.controller.ts`

---

## Validation Checklist

- [x] Problem Statement: Specific and measurable (user feedback quoted)
- [x] Technical Requirements: All dependencies already available
- [x] Implementation Plan: Technically sound with code examples
- [x] Testing Strategy: Unit, integration, and E2E tests defined
- [x] All 17 sections meaningfully filled
- [x] No contradictions between sections
- [x] Implementable from spec alone
- [x] Quality Score: 9/10
