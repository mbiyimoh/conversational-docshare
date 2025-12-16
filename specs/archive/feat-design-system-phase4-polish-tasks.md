# Task Breakdown: Design System Phase 4 Polish & Finishing

Generated: December 12, 2025
Source: specs/feat-design-system-phase4-polish.md

## Overview

Complete the 33 Strategies design system migration by updating all remaining 252 occurrences of old light-mode Tailwind color classes across 21 frontend components. This is the final phase transforming the application to the premium dark 33 Strategies brand identity.

## Color Mapping Reference

All tasks use this mapping:

| Old Class | New Design System |
|-----------|-------------------|
| `bg-white` | `bg-card-bg` |
| `bg-gray-50` | `bg-background-elevated` |
| `bg-gray-100`, `bg-gray-200` | `bg-white/5` or `bg-card-bg` |
| `text-gray-400`, `text-gray-500` | `text-dim` |
| `text-gray-600`, `text-gray-700` | `text-muted` |
| `text-gray-800`, `text-gray-900` | `text-foreground` |
| `bg-blue-600`, `hover:bg-blue-700` | `Button` component or `bg-accent` |
| `text-blue-600`, `text-blue-700` | `text-accent` |
| `bg-blue-50`, `bg-blue-100` | `bg-accent/10` |
| `bg-green-50`, `bg-green-100` | `bg-success/10` |
| `text-green-600`, `text-green-700` | `text-success` |
| `bg-red-50`, `bg-red-100` | `bg-destructive/10` |
| `text-red-500`, `text-red-600` | `text-destructive` |
| `bg-yellow-50`, `bg-yellow-100` | `bg-warning/10` |
| `text-yellow-700`, `text-yellow-800` | `text-warning` |
| `border-gray-200`, `border-gray-300` | `border-border` |
| `hover:bg-gray-50`, `hover:bg-gray-100` | `hover:bg-white/5` |

---

## Phase 1: AI Modals (Batch 1)

### Task 1.1: Update CollaboratorProfileAIModal.tsx

**Description**: Update CollaboratorProfileAIModal with 33 Strategies design system (22 occurrences)
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.2, 1.3, 1.4

**Technical Requirements**:
- Import and use UI components: `Modal`, `Button`, `Input`, `Textarea` from `./ui`
- Replace all `bg-white` with `bg-card-bg`
- Replace all `text-gray-*` with `text-foreground`, `text-muted`, or `text-dim`
- Replace all `bg-blue-*` buttons with `Button` component
- Replace all `border-gray-*` with `border-border`
- Dark form inputs with gold focus states

**Implementation Pattern**:
```tsx
// Before
<div className="bg-white rounded-lg shadow p-6">
  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">

// After
import { Modal, Button, Card } from './ui'

<Card className="p-6">
  <Button>
```

**Files to modify**: `frontend/src/components/CollaboratorProfileAIModal.tsx`

**Acceptance Criteria**:
- [ ] All 22 old color class occurrences replaced
- [ ] Modal uses dark glass effect styling
- [ ] Buttons use Button component
- [ ] Form inputs have dark styling with gold focus
- [ ] Build passes with no TypeScript errors
- [ ] No unused imports

---

### Task 1.2: Update AudienceProfileAIModal.tsx

**Description**: Update AudienceProfileAIModal with 33 Strategies design system (17 occurrences)
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.1, 1.3, 1.4

**Technical Requirements**:
- Import and use UI components: `Modal`, `Button`, `Input`, `Textarea` from `./ui`
- Replace all `bg-white` with `bg-card-bg`
- Replace all `text-gray-*` with `text-foreground`, `text-muted`, or `text-dim`
- Replace all `bg-blue-*` buttons with `Button` component
- Replace all `border-gray-*` with `border-border`

**Implementation Pattern**:
```tsx
// Import UI components
import { Modal, Button, Card, Input, Textarea } from './ui'

// Replace containers
<Card className="p-6">

// Replace buttons
<Button variant="primary">Submit</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="ghost">Close</Button>

// Replace text colors
className="text-foreground"  // was text-gray-900
className="text-muted"       // was text-gray-600
className="text-dim"         // was text-gray-400
```

**Files to modify**: `frontend/src/components/AudienceProfileAIModal.tsx`

**Acceptance Criteria**:
- [ ] All 17 old color class occurrences replaced
- [ ] Modal uses dark glass effect styling
- [ ] Buttons use Button component
- [ ] Form inputs have dark styling with gold focus
- [ ] Build passes with no TypeScript errors

---

### Task 1.3: Update RecommendationApplyModal.tsx

**Description**: Update RecommendationApplyModal with 33 Strategies design system (18 occurrences)
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.1, 1.2, 1.4

**Technical Requirements**:
- Import and use UI components: `Modal`, `Button`, `Card` from `./ui`
- Replace all `bg-white` with `bg-card-bg`
- Replace all `text-gray-*` with appropriate design system tokens
- Diff preview should use dark styling with accent colors for changes
- Added content: `bg-success/10 text-success`
- Removed content: `bg-destructive/10 text-destructive`

**Implementation Pattern**:
```tsx
// Diff styling
<span className="bg-success/10 text-success">+ Added text</span>
<span className="bg-destructive/10 text-destructive line-through">- Removed text</span>

// Container
<Card className="p-4">
  <div className="text-foreground">{content}</div>
</Card>
```

**Files to modify**: `frontend/src/components/RecommendationApplyModal.tsx`

**Acceptance Criteria**:
- [ ] All 18 old color class occurrences replaced
- [ ] Diff preview uses dark theme with success/destructive colors
- [ ] Modal uses dark glass effect styling
- [ ] Build passes with no TypeScript errors

---

### Task 1.4: Update NavigationModal.tsx

**Description**: Update NavigationModal with 33 Strategies design system (10 occurrences)
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.1, 1.2, 1.3

**Technical Requirements**:
- Import and use UI components: `Modal`, `Button` from `./ui`
- Replace all `bg-white` with `bg-card-bg`
- Replace all `text-gray-*` with design system tokens
- Replace button styling with Button component

**Implementation Pattern**:
```tsx
import { Modal, Button } from '../ui'

// Use Modal component for overlay
<Modal isOpen={isOpen} onClose={onClose}>
  <div className="text-foreground">Navigation options</div>
  <Button onClick={handleConfirm}>Confirm</Button>
  <Button variant="ghost" onClick={onClose}>Cancel</Button>
</Modal>
```

**Files to modify**: `frontend/src/components/TestingDojo/NavigationModal.tsx`

**Acceptance Criteria**:
- [ ] All 10 old color class occurrences replaced
- [ ] Modal uses dark glass effect styling
- [ ] Buttons use Button component variants
- [ ] Build passes with no TypeScript errors

---

## Phase 2: Document Components (Batch 2)

### Task 2.1: Update DocumentEditor.tsx

**Description**: Update DocumentEditor with 33 Strategies design system (15 occurrences)
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 2.2, 2.3, 2.4, 2.5

**Technical Requirements**:
- Dark toolbar with gold accent highlights
- Editor area with dark background
- Replace all `bg-white` toolbars with `bg-card-bg`
- Replace all `text-gray-*` with design system tokens
- Replace all `border-gray-*` with `border-border`
- Toolbar buttons should use dark hover states

**Implementation Pattern**:
```tsx
// Toolbar styling
<div className="flex items-center gap-1 p-2 border-b border-border bg-card-bg">
  <button className="p-2 rounded hover:bg-white/10 text-muted hover:text-foreground">
    <Bold className="w-4 h-4" />
  </button>
</div>

// Editor area
<div className="bg-background-elevated text-foreground p-4">
  {/* TipTap editor content */}
</div>
```

**Files to modify**: `frontend/src/components/DocumentEditor.tsx`

**Acceptance Criteria**:
- [ ] All 15 old color class occurrences replaced
- [ ] Toolbar has dark styling with hover states
- [ ] Editor content area uses dark background
- [ ] Build passes with no TypeScript errors

---

### Task 2.2: Update DocumentVersionHistory.tsx

**Description**: Update DocumentVersionHistory with 33 Strategies design system (14 occurrences)
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 2.1, 2.3, 2.4, 2.5

**Technical Requirements**:
- Dark list styling for version history
- Diff view with dark background
- Replace all `bg-white` with `bg-card-bg`
- Replace all `text-gray-*` with design system tokens
- Version badges using Badge component

**Implementation Pattern**:
```tsx
import { Card, Badge, Button } from './ui'

// Version list item
<div className="p-4 border-b border-border hover:bg-white/5 cursor-pointer">
  <div className="flex items-center justify-between">
    <span className="text-foreground font-medium">Version {version.number}</span>
    <Badge variant="secondary">{version.source}</Badge>
  </div>
  <span className="text-sm text-muted">{formatDate(version.createdAt)}</span>
</div>

// Diff styling
<div className="bg-success/10 text-success">+ Added line</div>
<div className="bg-destructive/10 text-destructive">- Removed line</div>
```

**Files to modify**: `frontend/src/components/DocumentVersionHistory.tsx`

**Acceptance Criteria**:
- [ ] All 14 old color class occurrences replaced
- [ ] Version list has dark styling
- [ ] Diff view uses success/destructive colors
- [ ] Build passes with no TypeScript errors

---

### Task 2.3: Update DocumentViewer.tsx

**Description**: Update DocumentViewer with 33 Strategies design system (12 occurrences)
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 2.1, 2.2, 2.4, 2.5

**Technical Requirements**:
- Dark outline/sidebar styling
- Replace all `bg-white` with `bg-card-bg`
- Replace all `text-gray-*` with design system tokens
- Replace all `border-gray-*` with `border-border`

**Implementation Pattern**:
```tsx
// Outline sidebar
<div className="w-64 border-r border-border bg-background-elevated overflow-y-auto">
  <div className="p-4">
    <h3 className="text-sm font-medium text-muted uppercase tracking-wide">Outline</h3>
    <ul className="mt-2 space-y-1">
      <li className="text-foreground hover:text-accent cursor-pointer">Section 1</li>
    </ul>
  </div>
</div>
```

**Files to modify**: `frontend/src/components/DocumentViewer.tsx`

**Acceptance Criteria**:
- [ ] All 12 old color class occurrences replaced
- [ ] Outline sidebar has dark styling
- [ ] Build passes with no TypeScript errors

---

### Task 2.4: Update DocumentContentViewer.tsx

**Description**: Update DocumentContentViewer with 33 Strategies design system (12 occurrences)
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 2.1, 2.2, 2.3, 2.5

**Technical Requirements**:
- Dark content rendering area
- Replace all `bg-white` with `bg-card-bg`
- Replace all `text-gray-*` with design system tokens
- Ensure markdown content renders with proper dark theme colors

**Implementation Pattern**:
```tsx
// Content container
<div className="bg-card-bg rounded-lg p-6">
  <div className="prose prose-invert max-w-none">
    {/* Markdown content */}
  </div>
</div>

// Section headers
<h2 className="text-xl font-display text-foreground border-b border-border pb-2">
  {sectionTitle}
</h2>
```

**Files to modify**: `frontend/src/components/DocumentContentViewer.tsx`

**Acceptance Criteria**:
- [ ] All 12 old color class occurrences replaced
- [ ] Content renders with dark theme
- [ ] Prose styles work with dark background
- [ ] Build passes with no TypeScript errors

---

### Task 2.5: Update DocumentCommentsDrawer.tsx

**Description**: Update DocumentCommentsDrawer with 33 Strategies design system (11 occurrences)
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 2.1, 2.2, 2.3, 2.4

**Technical Requirements**:
- Dark drawer styling
- Comment cards with dark background
- Replace all `bg-white` with `bg-card-bg`
- Replace all `text-gray-*` with design system tokens

**Implementation Pattern**:
```tsx
import { Card, Badge, Button } from './ui'

// Drawer container
<div className="w-80 bg-background-elevated border-l border-border h-full">
  <div className="p-4 border-b border-border">
    <h3 className="font-medium text-foreground">Comments</h3>
  </div>

  // Comment card
  <Card className="p-3 m-2">
    <div className="text-sm text-foreground">{comment.content}</div>
    <div className="text-xs text-muted mt-1">{comment.author}</div>
  </Card>
</div>
```

**Files to modify**: `frontend/src/components/DocumentCommentsDrawer.tsx`

**Acceptance Criteria**:
- [ ] All 11 old color class occurrences replaced
- [ ] Drawer has dark styling
- [ ] Comment cards use Card component
- [ ] Build passes with no TypeScript errors

---

## Phase 3: Recommendations & Analytics (Batch 3)

### Task 3.1: Update RecommendationCard.tsx

**Description**: Update RecommendationCard with 33 Strategies design system (17 occurrences)
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 2 complete
**Can run parallel with**: Task 3.2, 3.3, 3.4, 3.5

**Technical Requirements**:
- Use Card component for container
- Use Badge component for status/type badges
- Dark expandable section styling
- Replace all old color classes

**Implementation Pattern**:
```tsx
import { Card, Badge, Button } from './ui'

<Card className="p-4">
  <div className="flex items-center justify-between">
    <Badge variant="secondary">{recommendation.type}</Badge>
    <Badge variant={getStatusVariant(recommendation.status)}>
      {recommendation.status}
    </Badge>
  </div>

  <div className="mt-2 text-foreground">{recommendation.content}</div>

  // Expandable section
  <div className="mt-3 pt-3 border-t border-border">
    <button className="text-sm text-accent hover:text-accent/80">
      {expanded ? 'Show less' : 'Show more'}
    </button>
  </div>
</Card>
```

**Files to modify**: `frontend/src/components/RecommendationCard.tsx`

**Acceptance Criteria**:
- [ ] All 17 old color class occurrences replaced
- [ ] Uses Card and Badge components
- [ ] Expandable sections work with dark theme
- [ ] Build passes with no TypeScript errors

---

### Task 3.2: Update AudienceSynthesisPanel.tsx

**Description**: Update AudienceSynthesisPanel with 33 Strategies design system (15 occurrences)
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 2 complete
**Can run parallel with**: Task 3.1, 3.3, 3.4, 3.5

**Technical Requirements**:
- Use Card component for stats cards
- Dark styling for synthesis results
- Replace all `bg-white` with `bg-card-bg`
- Replace all `text-gray-*` with design system tokens

**Implementation Pattern**:
```tsx
import { Card, Badge, SectionLabel } from './ui'

<div className="space-y-4">
  <SectionLabel>Audience Synthesis</SectionLabel>

  // Stats card
  <Card className="p-4">
    <div className="text-sm text-muted">Total Conversations</div>
    <div className="text-2xl font-display text-accent">{stats.total}</div>
  </Card>

  // Synthesis result
  <Card className="p-4">
    <h4 className="font-medium text-foreground">Common Themes</h4>
    <ul className="mt-2 space-y-1 text-muted">
      {themes.map(theme => <li key={theme}>{theme}</li>)}
    </ul>
  </Card>
</div>
```

**Files to modify**: `frontend/src/components/AudienceSynthesisPanel.tsx`

**Acceptance Criteria**:
- [ ] All 15 old color class occurrences replaced
- [ ] Stats use Card component with accent colors
- [ ] Build passes with no TypeScript errors

---

### Task 3.3: Update CommentSidebar.tsx

**Description**: Update CommentSidebar with 33 Strategies design system (15 occurrences)
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 2 complete
**Can run parallel with**: Task 3.1, 3.2, 3.4, 3.5

**Technical Requirements**:
- Dark sidebar styling
- Comment cards with dark background
- Replace all `bg-white` with `bg-card-bg`
- Replace all `text-gray-*` with design system tokens

**Implementation Pattern**:
```tsx
import { Card, Badge, Button } from '../ui'

// Sidebar container
<div className="bg-background-elevated h-full overflow-y-auto">
  <div className="p-4 border-b border-border">
    <h3 className="text-sm font-medium text-foreground uppercase tracking-wide font-mono">
      Comments
    </h3>
  </div>

  // Comment item
  <div className="p-3 border-b border-border hover:bg-white/5">
    <div className="text-sm text-foreground">{comment.content}</div>
    <div className="text-xs text-dim mt-1">{formatDate(comment.createdAt)}</div>
  </div>
</div>
```

**Files to modify**: `frontend/src/components/TestingDojo/CommentSidebar.tsx`

**Acceptance Criteria**:
- [ ] All 15 old color class occurrences replaced
- [ ] Sidebar has dark styling
- [ ] Comment items have proper hover states
- [ ] Build passes with no TypeScript errors

---

### Task 3.4: Update ProfileSectionContent.tsx

**Description**: Update ProfileSectionContent with 33 Strategies design system (10 occurrences)
**Size**: Small
**Priority**: High
**Dependencies**: Phase 2 complete
**Can run parallel with**: Task 3.1, 3.2, 3.3, 3.5

**Technical Requirements**:
- Dark markdown rendering
- Replace all `text-gray-*` with design system tokens
- Ensure ReactMarkdown prose styles work with dark theme

**Implementation Pattern**:
```tsx
// Markdown container
<div className="prose prose-invert prose-sm max-w-none">
  <ReactMarkdown
    components={{
      p: ({ children }) => <p className="text-foreground">{children}</p>,
      h1: ({ children }) => <h1 className="text-foreground">{children}</h1>,
      h2: ({ children }) => <h2 className="text-foreground">{children}</h2>,
      li: ({ children }) => <li className="text-muted">{children}</li>,
      strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
    }}
  >
    {content}
  </ReactMarkdown>
</div>
```

**Files to modify**: `frontend/src/components/ProfileSectionContent.tsx`

**Acceptance Criteria**:
- [ ] All 10 old color class occurrences replaced
- [ ] Markdown renders with dark theme
- [ ] Build passes with no TypeScript errors

---

### Task 3.5: Update ConversationRecommendations.tsx

**Description**: Update ConversationRecommendations with 33 Strategies design system (6 occurrences)
**Size**: Small
**Priority**: High
**Dependencies**: Phase 2 complete
**Can run parallel with**: Task 3.1, 3.2, 3.3, 3.4

**Technical Requirements**:
- Dark recommendation list styling
- Replace all `bg-white` with `bg-card-bg`
- Replace all `text-gray-*` with design system tokens

**Implementation Pattern**:
```tsx
import { Card, Badge } from './ui'

<div className="space-y-3">
  {recommendations.map(rec => (
    <Card key={rec.id} className="p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground">{rec.title}</span>
        <Badge variant="secondary">{rec.type}</Badge>
      </div>
      <p className="text-sm text-muted mt-1">{rec.description}</p>
    </Card>
  ))}
</div>
```

**Files to modify**: `frontend/src/components/ConversationRecommendations.tsx`

**Acceptance Criteria**:
- [ ] All 6 old color class occurrences replaced
- [ ] Uses Card and Badge components
- [ ] Build passes with no TypeScript errors

---

## Phase 4: Supporting Components (Batch 4)

### Task 4.1: Update RecipientMessageDisplay.tsx

**Description**: Update RecipientMessageDisplay with 33 Strategies design system (9 occurrences)
**Size**: Small
**Priority**: Medium
**Dependencies**: Phase 3 complete
**Can run parallel with**: Task 4.2, 4.3, 4.4, 4.5, 4.6, 4.7

**Technical Requirements**:
- Accent-themed message box
- Replace all `bg-blue-*` with `bg-accent/10`
- Replace all `text-blue-*` with `text-accent`

**Implementation Pattern**:
```tsx
<div className="p-4 bg-accent/10 border border-accent/30 rounded-lg">
  <div className="text-xs font-medium text-accent uppercase tracking-wide font-mono mb-2">
    Message from Recipient
  </div>
  <div className="text-foreground">{message.content}</div>
  <div className="text-xs text-muted mt-2">
    {message.viewerName || message.viewerEmail}
  </div>
</div>
```

**Files to modify**: `frontend/src/components/RecipientMessageDisplay.tsx`

**Acceptance Criteria**:
- [ ] All 9 old color class occurrences replaced
- [ ] Uses accent color scheme
- [ ] Build passes with no TypeScript errors

---

### Task 4.2: Update CollaboratorCommentPanel.tsx

**Description**: Update CollaboratorCommentPanel with 33 Strategies design system (8 occurrences)
**Size**: Small
**Priority**: Medium
**Dependencies**: Phase 3 complete
**Can run parallel with**: Task 4.1, 4.3, 4.4, 4.5, 4.6, 4.7

**Technical Requirements**:
- Dark floating panel styling
- Replace all `bg-white` with `bg-card-bg`
- Replace all `text-gray-*` with design system tokens

**Implementation Pattern**:
```tsx
import { Card, Button, Textarea } from './ui'

<Card className="absolute z-50 w-72 p-4 shadow-lg">
  <div className="text-sm font-medium text-foreground mb-2">Add Comment</div>
  <Textarea
    value={comment}
    onChange={(e) => setComment(e.target.value)}
    placeholder="Enter your comment..."
    className="mb-2"
  />
  <div className="flex justify-end gap-2">
    <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
    <Button size="sm" onClick={onSubmit}>Submit</Button>
  </div>
</Card>
```

**Files to modify**: `frontend/src/components/CollaboratorCommentPanel.tsx`

**Acceptance Criteria**:
- [ ] All 8 old color class occurrences replaced
- [ ] Uses Card, Button, Textarea components
- [ ] Build passes with no TypeScript errors

---

### Task 4.3: Update KnowledgeGapsCard.tsx

**Description**: Update KnowledgeGapsCard with 33 Strategies design system (6 occurrences)
**Size**: Small
**Priority**: Medium
**Dependencies**: Phase 3 complete
**Can run parallel with**: Task 4.1, 4.2, 4.4, 4.5, 4.6, 4.7

**Technical Requirements**:
- Use Card component for container
- Use Badge component for gap categories
- Replace all old color classes

**Implementation Pattern**:
```tsx
import { Card, Badge } from './ui'

<Card className="p-4">
  <h3 className="font-medium text-foreground mb-3">Knowledge Gaps</h3>
  <ul className="space-y-2">
    {gaps.map(gap => (
      <li key={gap.id} className="flex items-start gap-2">
        <Badge variant="warning">{gap.category}</Badge>
        <span className="text-sm text-muted">{gap.description}</span>
      </li>
    ))}
  </ul>
</Card>
```

**Files to modify**: `frontend/src/components/KnowledgeGapsCard.tsx`

**Acceptance Criteria**:
- [ ] All 6 old color class occurrences replaced
- [ ] Uses Card and Badge components
- [ ] Build passes with no TypeScript errors

---

### Task 4.4: Update AnalyticsCommentsSection.tsx

**Description**: Update AnalyticsCommentsSection with 33 Strategies design system (5 occurrences)
**Size**: Small
**Priority**: Medium
**Dependencies**: Phase 3 complete
**Can run parallel with**: Task 4.1, 4.2, 4.3, 4.5, 4.6, 4.7

**Technical Requirements**:
- Dark comment list styling
- Replace all `bg-white` with `bg-card-bg`
- Replace all `text-gray-*` with design system tokens

**Implementation Pattern**:
```tsx
<div className="space-y-3">
  {comments.map(comment => (
    <div key={comment.id} className="p-3 bg-card-bg rounded-lg border border-border">
      <div className="text-sm text-foreground">{comment.content}</div>
      <div className="text-xs text-dim mt-1">{formatDate(comment.createdAt)}</div>
    </div>
  ))}
</div>
```

**Files to modify**: `frontend/src/components/AnalyticsCommentsSection.tsx`

**Acceptance Criteria**:
- [ ] All 5 old color class occurrences replaced
- [ ] Dark comment list styling
- [ ] Build passes with no TypeScript errors

---

### Task 4.5: Update CommonQuestionsCard.tsx

**Description**: Update CommonQuestionsCard with 33 Strategies design system (4 occurrences)
**Size**: Small
**Priority**: Medium
**Dependencies**: Phase 3 complete
**Can run parallel with**: Task 4.1, 4.2, 4.3, 4.4, 4.6, 4.7

**Technical Requirements**:
- Use Card component for container
- Use Badge component if needed
- Replace all old color classes

**Implementation Pattern**:
```tsx
import { Card, Badge } from './ui'

<Card className="p-4">
  <h3 className="font-medium text-foreground mb-3">Common Questions</h3>
  <ul className="space-y-2">
    {questions.map((q, idx) => (
      <li key={idx} className="text-sm text-muted">
        <span className="text-accent mr-2">Q{idx + 1}:</span>
        {q}
      </li>
    ))}
  </ul>
</Card>
```

**Files to modify**: `frontend/src/components/CommonQuestionsCard.tsx`

**Acceptance Criteria**:
- [ ] All 4 old color class occurrences replaced
- [ ] Uses Card component
- [ ] Build passes with no TypeScript errors

---

### Task 4.6: Update DocumentSuggestionsCard.tsx

**Description**: Update DocumentSuggestionsCard with 33 Strategies design system (4 occurrences)
**Size**: Small
**Priority**: Medium
**Dependencies**: Phase 3 complete
**Can run parallel with**: Task 4.1, 4.2, 4.3, 4.4, 4.5, 4.7

**Technical Requirements**:
- Use Card component for container
- Replace all old color classes

**Implementation Pattern**:
```tsx
import { Card } from './ui'

<Card className="p-4">
  <h3 className="font-medium text-foreground mb-3">Suggested Documents</h3>
  <ul className="space-y-2">
    {suggestions.map(doc => (
      <li key={doc.id} className="text-sm text-accent hover:text-accent/80 cursor-pointer">
        {doc.title}
      </li>
    ))}
  </ul>
</Card>
```

**Files to modify**: `frontend/src/components/DocumentSuggestionsCard.tsx`

**Acceptance Criteria**:
- [ ] All 4 old color class occurrences replaced
- [ ] Uses Card component
- [ ] Build passes with no TypeScript errors

---

### Task 4.7: Update SynthesisVersionSelector.tsx

**Description**: Update SynthesisVersionSelector with 33 Strategies design system (1 occurrence)
**Size**: Small
**Priority**: Low
**Dependencies**: Phase 3 complete
**Can run parallel with**: Task 4.1, 4.2, 4.3, 4.4, 4.5, 4.6

**Technical Requirements**:
- Dark select input styling
- Replace old color class

**Implementation Pattern**:
```tsx
<select className="px-3 py-2 bg-card-bg border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent">
  {versions.map(v => (
    <option key={v.id} value={v.id}>{v.label}</option>
  ))}
</select>
```

**Files to modify**: `frontend/src/components/SynthesisVersionSelector.tsx`

**Acceptance Criteria**:
- [ ] 1 old color class occurrence replaced
- [ ] Select has dark styling
- [ ] Build passes with no TypeScript errors

---

## Phase 5: Final Verification

### Task 5.1: Run Final Verification

**Description**: Verify zero remaining old color class occurrences
**Size**: Small
**Priority**: High
**Dependencies**: Phase 4 complete
**Can run parallel with**: None

**Technical Requirements**:
Run verification command:
```bash
grep -rE "(bg-white|bg-gray-|text-gray-|bg-blue-|text-blue-|bg-green-|text-green-|bg-red-|text-red-|bg-yellow-)" --include="*.tsx" frontend/src/components | wc -l
```

Target: 0 occurrences

**Acceptance Criteria**:
- [ ] Grep returns 0 occurrences
- [ ] Build passes: `npm run build`
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Application renders correctly in browser

---

## Summary

| Phase | Tasks | Occurrences | Priority |
|-------|-------|-------------|----------|
| Phase 1 | 4 | 67 | High |
| Phase 2 | 5 | 64 | High |
| Phase 3 | 5 | 63 | High |
| Phase 4 | 7 | 37 | Medium |
| Phase 5 | 1 | 0 | High |
| **Total** | **22** | **231** | - |

**Parallel Execution Opportunities**:
- Phase 1: All 4 tasks can run in parallel
- Phase 2: All 5 tasks can run in parallel
- Phase 3: All 5 tasks can run in parallel
- Phase 4: All 7 tasks can run in parallel
- Phase 5: Sequential (final verification)

**Critical Path**: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
