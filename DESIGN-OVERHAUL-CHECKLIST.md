# Design Overhaul Checklist: 33 Strategies Brand

**Goal:** Transform from generic SaaS aesthetic to 33 Strategies' luxury dark theme with gold accents.

**Design Reference:** `.claude/skills/33-strategies-frontend-design.md`

---

## Phase 1: Foundation (Do First)

### 1.1 Typography Setup
- [ ] Add Google Fonts import to `index.html` (Instrument Serif, DM Sans, JetBrains Mono)
- [ ] Update `tailwind.config.js` with font families
- [ ] Create font utility classes in `globals.css`

### 1.2 Color System
- [ ] Replace CSS variables in `globals.css` with 33 Strategies palette
- [ ] Update `tailwind.config.js` colors (add gold accent, update backgrounds)
- [ ] Remove light mode variables (dark mode only)

### 1.3 Dependencies
- [ ] Install `framer-motion` for animations
- [ ] Verify Tailwind backdrop-blur support

### 1.4 Base Styles
- [ ] Update body/html base styles for dark background
- [ ] Set default text colors

---

## Phase 2: Shared Components

### 2.1 Glass Card Component
- [ ] Create `GlassCard.tsx` reusable component
- [ ] Props: glow (boolean), className override

### 2.2 Section Label Component
- [ ] Create `SectionLabel.tsx` for `01 — TITLE` pattern
- [ ] Gold color, JetBrains Mono, uppercase, tracked

### 2.3 Accent Text Component
- [ ] Create `AccentText.tsx` for gold highlights in text

### 2.4 Reveal Animation Component
- [ ] Create `RevealText.tsx` with Framer Motion
- [ ] Fade-up on scroll, staggered delays

### 2.5 Button Variants
- [ ] Primary: Gold accent, dark background
- [ ] Secondary: Glass effect with border
- [ ] Ghost: Subtle text-only

---

## Phase 3: Pages (6 total)

### 3.1 LoginPage.tsx
- [ ] Dark background `#0a0a0f`
- [ ] Glass card for form container
- [ ] Gold accent on "Sign in" or brand text
- [ ] Update form inputs (dark with subtle border)
- [ ] Gold primary button
- [ ] Update link color to gold

### 3.2 RegisterPage.tsx
- [ ] Same treatment as LoginPage
- [ ] Consistent form styling

### 3.3 DashboardPage.tsx
- [ ] Dark header with subtle border
- [ ] Section labels for "My Projects", "Saved Threads"
- [ ] Glass cards for project items
- [ ] Gold accent on key stats
- [ ] Update empty state (no emoji - use geometric SVG)
- [ ] Gold CTA buttons
- [ ] Create project modal → glass card styling

### 3.4 ProjectPage.tsx
- [ ] Full dark theme treatment
- [ ] Tab styling updates
- [ ] Panel layouts with glass cards
- [ ] Gold accents on active states

### 3.5 SharePage.tsx
- [ ] Dark theme for viewer experience
- [ ] Chat interface dark styling
- [ ] Document viewer dark mode
- [ ] Comment panel styling

### 3.6 SavedThreadPage.tsx
- [ ] Dark theme consistency
- [ ] Glass card for thread display

---

## Phase 4: Core Components (Priority Order)

### 4.1 Chat Components
- [ ] `ChatInterface.tsx` - Dark container, styled messages
- [ ] `ChatMessage.tsx` - User vs assistant bubble styling
- [ ] `ChatInput.tsx` - Dark input with gold focus ring

### 4.2 Document Components
- [ ] `DocumentViewer.tsx` - Dark reading mode
- [ ] `DocumentContentViewer.tsx` - Dark text styling
- [ ] `DocumentUpload.tsx` - Glass card for file list
- [ ] `DocumentEditor.tsx` - Dark TipTap theme
- [ ] `DocumentVersionHistory.tsx` - Glass cards for versions
- [ ] `DocumentCapsule.tsx` - Update styling

### 4.3 Profile Components
- [ ] `AgentProfile.tsx` - Glass sections
- [ ] `AgentInterview.tsx` - Dark interview UI
- [ ] `ProfileSectionContent.tsx` - Dark markdown rendering
- [ ] `SavedProfilesSection.tsx` - Glass cards
- [ ] `ProfileField.tsx` - Dark form inputs

### 4.4 Testing Dojo Components
- [ ] `TestingDojo/TestingDojo.tsx` - Container styling
- [ ] `TestingDojo/DojoChat.tsx` - Dark chat theme
- [ ] `TestingDojo/SessionManager.tsx` - Glass cards for sessions
- [ ] `TestingDojo/CommentSidebar.tsx` - Dark sidebar
- [ ] `TestingDojo/CommentOverlay.tsx` - Dark overlays
- [ ] `TestingDojo/NavigationModal.tsx` - Glass modal

### 4.5 Recommendation Components
- [ ] `RecommendationPanel.tsx` - Glass cards
- [ ] `RecommendationCard.tsx` - Type-based color coding
- [ ] `RecommendationApplyModal.tsx` - Glass modal with diff styling
- [ ] `ConversationRecommendations.tsx` - Dark styling

### 4.6 Analytics Components
- [ ] `AnalyticsDashboard.tsx` - Dark charts, gold highlights
- [ ] `AnalyticsCommentsSection.tsx` - Glass cards
- [ ] `ConversationDetailPanel.tsx` - Dark detail view
- [ ] `CommonQuestionsCard.tsx` - Glass card
- [ ] `KnowledgeGapsCard.tsx` - Glass card
- [ ] `DocumentSuggestionsCard.tsx` - Glass card

### 4.7 Sharing & Access
- [ ] `ShareLinkManager.tsx` - Glass cards, gold for active states
- [ ] `SavedThreadsSection.tsx` - Dark thread cards

### 4.8 Modal Components
- [ ] `LeaveMessageModal.tsx` - Glass modal
- [ ] `EndSessionModal.tsx` - Glass modal
- [ ] `AudienceProfileAIModal.tsx` - Glass modal, dark UI
- [ ] `CollaboratorProfileAIModal.tsx` - Glass modal

### 4.9 Other Components
- [ ] `CollaboratorCommentPanel.tsx` - Dark comment UI
- [ ] `DocumentCommentMarker.tsx` - Gold highlight for markers
- [ ] `DocumentCommentsDrawer.tsx` - Dark drawer
- [ ] `AudienceSynthesisPanel.tsx` - Glass cards
- [ ] `SynthesisVersionSelector.tsx` - Dark dropdown
- [ ] `RecipientMessageDisplay.tsx` - Dark message styling

---

## Phase 5: Polish

### 5.1 Animations
- [ ] Add scroll-triggered reveals to key sections
- [ ] Stagger animations on card grids
- [ ] Subtle glow pulses on active elements

### 5.2 Backgrounds
- [ ] Add atmospheric gold glow behind hero sections
- [ ] Layer depth with blur effects

### 5.3 Empty States
- [ ] Replace all emoji with geometric SVG icons
- [ ] Consistent empty state messaging

### 5.4 Loading States
- [ ] Update loading indicators (gold dots instead of gray)
- [ ] Skeleton loaders with glass effect

### 5.5 Final QA
- [ ] Check all focus states (gold ring)
- [ ] Verify hover states consistency
- [ ] Test responsive breakpoints
- [ ] Verify contrast ratios for accessibility

---

## Progress Tracking

| Phase | Items | Completed | Status |
|-------|-------|-----------|--------|
| Foundation | 4 sections | 0 | Not Started |
| Shared Components | 5 components | 0 | Not Started |
| Pages | 6 pages | 0 | Not Started |
| Core Components | 29 components | 0 | Not Started |
| Polish | 5 sections | 0 | Not Started |

**Total Items:** ~49 major items

---

## Execution Notes

1. **Start with Phase 1** - Foundation must be complete before component work
2. **Test incrementally** - Run the app after each major change
3. **Commit often** - Small, focused commits for each section
4. **Use `/design:overhaul`** - For systematic component-by-component work
5. **Visual verification** - Screenshot before/after for each page
