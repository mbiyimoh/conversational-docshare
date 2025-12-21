# Improve Text Readability and Content Presentation

**Slug:** improve-text-readability-chat-document-viewer
**Author:** Claude Code
**Date:** 2025-12-19
**Branch:** preflight/improve-text-readability
**Related:** Viewer Reading Experience Personalization feature
**Status:** ✅ IMPLEMENTED

---

## 1) Intent & Assumptions

**Task brief:** Improve text readability in both the chat interface and document viewer by implementing elite typography standards. The current text appears dense and bunched up with poor hierarchy. Additionally, abstract the "expand on that" functionality so it feels like organic content expansion rather than showing a visible user prompt.

**Assumptions:**
- Changes should apply as "standard styling" regardless of user font/size preferences
- The 33 Strategies dark theme is the base design system
- Both ChatMessage and DocumentContentViewer need improvements
- Citation presentation should be redesigned to be less "thrown in"
- System prompt can be updated to encourage better formatting from AI
- The expand button functionality works well but UI feels clunky

**Out of scope:**
- Changing the actual AI model or response generation logic
- Redesigning the overall page layout
- Adding new onboarding steps
- Modifying user preference options (font, size, theme)

---

## 2) Pre-reading Log

- `frontend/src/components/ChatMessage.tsx`: Main chat message renderer, uses ReactMarkdown with remarkGfm, has CitationButton component inline with text
- `frontend/src/lib/markdownConfig.tsx`: Shared markdown component config used across chat, creates styled overrides for p, code, lists, headings, blockquotes
- `frontend/src/components/DocumentContentViewer.tsx`: Document display using prose classes, chunks rendered with ReactMarkdown
- `frontend/src/lib/documentReferences.ts`: Citation regex `[DOC:filename:section-id]`, converts to `cite://` protocol links
- `frontend/src/styles/globals.css`: Theme variables, font stacks, current typography settings
- `backend/src/services/contextService.ts`: System prompt builder with citation format instructions
- `backend/src/services/chatService.ts`: RAG context injection, shows citation format to AI

---

## 3) Codebase Map

**Primary components/modules:**
- `frontend/src/components/ChatMessage.tsx` - Chat bubble rendering
- `frontend/src/lib/markdownConfig.tsx` - Shared markdown component overrides
- `frontend/src/components/DocumentContentViewer.tsx` - Document content display
- `frontend/src/components/ChatInterface.tsx` - Contains expand handling logic
- `frontend/src/styles/globals.css` - Typography CSS variables

**Shared dependencies:**
- ReactMarkdown with remark-gfm plugin
- Tailwind CSS prose classes (partially used)
- 33 Strategies design tokens (--font-display, --font-body, --color-accent)
- `cn()` utility for class merging

**Data flow:**
- AI generates response with `[DOC:...]` citations → `convertCitationsToMarkdownLinks()` → ReactMarkdown with custom components → CitationButton rendered inline

**Feature flags/config:** None currently

**Potential blast radius:**
- All chat messages in SharePage
- All document content in DocumentContentViewer
- Testing Dojo chat (DojoChat.tsx)
- Conversation detail panels in dashboard

---

## 4) Root Cause Analysis

**Observed Issues (from screenshots):**

1. **Dense text with poor breathing room:**
   - Line-height appears too tight for long-form content
   - Paragraphs run together without adequate spacing
   - Lists crammed together with minimal item spacing

2. **Poor visual hierarchy:**
   - Headers don't stand out enough
   - Bold text (strong) doesn't create clear emphasis
   - Numbered lists have awkward structure (number on separate line from title)

3. **Citations disrupt reading flow:**
   - Gold citation links inline with text break visual rhythm
   - Long citation text (full document + section name) is intrusive
   - Citations appear "thrown in" rather than elegantly integrated

4. **Expand button shows implementation details:**
   - User prompt becomes visible when expanding
   - Breaks the illusion of organic content expansion

**Root Causes:**

1. **Typography CSS too minimal:** Current `markdownConfig.tsx` uses basic Tailwind classes without proper typography scale
2. **No line-length constraint:** Text can span full width causing hard-to-track lines
3. **Citation design is functional but not elegant:** Full text citations vs compact numbered references
4. **Expand implementation exposes internals:** Creates visible user message rather than inline expansion

---

## 5) Research Findings

### Key Typography Values (from research)

| Property | Current | Recommended | Impact |
|----------|---------|-------------|--------|
| Line-height (body) | 1.5 (Tailwind default) | 1.6-1.7 for chat | Better readability |
| Paragraph spacing | mb-2 (~8px) | mb-4 to mb-6 (16-24px) | Visual breathing room |
| List item spacing | space-y-1 (~4px) | 8-12px | Scannability |
| Max line length | None | 66ch (~600px) | Eye tracking |
| Letter-spacing | 0 | 0.01-0.02em (dark mode) | Character separation |
| Font weight (dark) | 400 | 500 | Legibility |

### Citation Presentation Options

**Option A: Numbered Superscript References**
- Pros: Minimal disruption, academic feel, compact
- Cons: Requires footnote section, less immediately informative
- Example: "The agreement permits¹ external activities"

**Option B: Compact Inline Pills**
- Pros: Shows source at glance, modern AI pattern (Perplexity-style)
- Cons: Still inline, needs careful sizing
- Example: "The agreement permits [1] external activities" with pill styling

**Option C: End-of-Response Citation Block**
- Pros: Clean prose, all sources grouped
- Cons: Harder to track which claim maps to which source
- Example: Citations listed at end with numbers matching inline refs

**Recommendation:** Hybrid approach - compact numbered pills inline `[1]` with collapsible citation block at message end showing full details. This matches modern AI citation UX (Perplexity, Claude web).

### Expand Button Abstraction Options

**Option A: Hidden System Prompt**
- Send expansion prompt as system message, not user message
- Response appears to extend naturally from previous
- Cons: May require backend changes

**Option B: Visual Continuation**
- Send as user message but hide it from display
- Mark expansion responses with metadata to render differently
- Cons: Requires message type differentiation

**Option C: In-place Content Expansion**
- Replace original message content with expanded version
- No new message bubble appears
- Cons: Loses original concise version

**Recommendation:** Option B - Send the prompt but hide from UI. Add `isExpansionPrompt: true` flag to message, filter from display. Expansion response appears as natural continuation.

---

## 6) Clarification

1. **Citation style preference:** Do you prefer numbered superscript `¹²³`, compact pills `[1][2]`, or the current inline text format but redesigned?

2. **Citation detail location:** Should citation details appear in a collapsible block at end of each message, or only on hover/click?

3. **Expand behavior:** Should expansion replace the original message, append below it as a new "block" within the same bubble, or show as a visually distinct continuation message?

4. **System prompt changes:** Are you comfortable with us updating the backend system prompt to encourage the AI to:
   - Create more paragraph breaks
   - Use headers for structure
   - Format lists with proper spacing
   - Keep citation references compact

5. **Document viewer:** Should document viewer typography match chat exactly, or have its own optimized settings (longer line length, different spacing)?

---

## 7) Proposed Implementation Plan

### Phase 1: Typography Foundation (CSS/Tailwind)
- Update `globals.css` with typography scale variables
- Add `--leading-relaxed: 1.65` for chat content
- Add `--spacing-paragraph: 1.25rem`
- Add max-width constraints (66ch for chat, 72ch for documents)
- Increase font-weight to 500 for dark mode body text

### Phase 2: Markdown Component Overhaul
- Rewrite `markdownConfig.tsx` with proper spacing
- Add header styles with clear visual weight
- Improve list styling with proper indentation and spacing
- Add blockquote styling for quoted content

### Phase 3: Citation Redesign
- Create `CitationPill` component (compact `[1]` style)
- Create `CitationBlock` component (collapsible end-of-message)
- Update `documentReferences.ts` to support numbered citations
- Update `ChatMessage.tsx` to collect and display citation block

### Phase 4: Expand Button Abstraction
- Add `isHiddenPrompt` flag to message handling
- Filter hidden prompts from display in ChatInterface
- Style expansion responses as seamless continuation

### Phase 5: System Prompt Updates
- Add formatting guidance to `contextService.ts`
- Encourage paragraph breaks, headers, structured lists
- Specify compact citation format `[1]` not full text

### Phase 6: Document Viewer Alignment
- Apply same typography improvements to DocumentContentViewer
- Adjust spacing for document context (slightly different than chat)

---

## 8) Implementation Summary

**Completed:** 2025-12-19

### Files Changed

**Frontend:**
- `src/styles/globals.css` - Added typography scale CSS variables (--leading-chat, --spacing-paragraph, --max-line-chat, etc.)
- `src/lib/markdownConfig.tsx` - Completely rewritten with elite typography (proper line-height, paragraph spacing, custom bullets, heading hierarchy)
- `src/lib/documentReferences.ts` - Added `convertCitationsToNumbered()` function for [1], [2] style citations
- `src/components/ChatMessage.tsx` - Uses new numbered citation system with CitationPill and CitationBlock
- `src/components/chat/CitationPill.tsx` - NEW: Compact inline [1] citation component
- `src/components/chat/CitationBlock.tsx` - NEW: Collapsible end-of-message citation list
- `src/components/ChatInterface.tsx` - Added `isHiddenExpansion` flag to hide expand prompts from UI
- `src/components/DocumentContentViewer.tsx` - Applied document typography styles (max-width 72ch, line-height 1.7)
- `src/components/ConversationDetailPanel.tsx` - Updated to use new citation system (consistency)
- `src/components/TestingDojo/DojoChat.tsx` - Updated to use new citation system (consistency)

**Backend:**
- `src/services/contextService.ts` - Added "Response Formatting" section to system prompt encouraging better AI formatting

### Key Decisions Made

1. **Citation Style:** Numbered pills `[1]` with collapsible citation block at message end (Perplexity-style)
2. **Expand Behavior:** Hidden user prompt, response appears as organic continuation
3. **Typography Values:** line-height 1.65 for chat, 1.7 for documents, max-width 66ch/72ch
4. **Dark Mode Optimization:** Slightly heavier font weight, 0.01em letter-spacing for character separation
