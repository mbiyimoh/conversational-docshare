# Task Breakdown: Share Link Identifiability

Generated: December 21, 2025
Source: specs/feat-share-link-identifiability.md

## Overview

Add human-readable names and optional custom slugs to share links. This involves schema changes, backend API updates, and frontend UI modifications.

## Phase 1: Backend Foundation

### Task 1.1: Add `name` field to ShareLink schema
**Description**: Add the name field to Prisma schema and run migration
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (foundation task)

**Technical Requirements**:
- Add `name String @db.VarChar(100)` to ShareLink model in `backend/prisma/schema.prisma`
- Field is required, max 100 characters
- Migration must handle existing links by setting `name = slug` as fallback

**Implementation Steps**:
1. Edit `backend/prisma/schema.prisma`, add to ShareLink model:
```prisma
model ShareLink {
  // ... existing fields ...

  // Add after existing fields
  name String @db.VarChar(100)  // Human-readable display name (max 100 chars)
}
```

2. Run migration with fallback for existing data:
```bash
cd backend && npm run db:push
```

3. Update existing records (run in psql or via Prisma):
```sql
UPDATE share_links SET name = slug WHERE name IS NULL;
```

**Acceptance Criteria**:
- [ ] `name` field exists on ShareLink model
- [ ] Max length constraint of 100 chars
- [ ] Existing links have name set to their slug
- [ ] `npm run db:push` completes without errors

---

### Task 1.2: Update backend controller with name and custom slug support
**Description**: Modify shareLink.controller.ts to accept name/customSlug params and generate smart defaults
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: None

**Technical Requirements**:
- Add `isValidCustomSlug()` validation helper
- Add `generateDefaultName()` helper function
- Update `createShareLink` to handle new parameters
- Include `name` in all ShareLink responses
- Add PATCH endpoint to update name after creation

**Implementation Steps**:

1. Add slug validation helper to `backend/src/controllers/shareLink.controller.ts`:
```typescript
/**
 * Validate custom slug format.
 * Must start/end with alphanumeric, hyphens only between words, 3-50 chars.
 */
function isValidCustomSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 50
}
```

2. Add default name generation helper:
```typescript
/**
 * Generate default share link name from project and profile.
 * Format: "{Project Name} - {Profile Name} - {Mon DD}" or "{Project Name} - {Mon DD}"
 */
function generateDefaultName(projectName: string, profileName?: string): string {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (profileName) {
    return `${projectName} - ${profileName} - ${date}`
  }
  return `${projectName} - ${date}`
}
```

3. Update `createShareLink` function to accept new params and use helpers:
```typescript
// In the request body interface, add:
interface CreateShareLinkBody {
  accessType: string
  password?: string
  allowedEmails?: string[]
  expiresAt?: string
  recipientRole?: 'viewer' | 'collaborator'
  // New fields
  name?: string           // Optional - auto-generated if not provided
  customSlug?: string     // Optional - random if not provided
  profileName?: string    // For default name generation
}

// In createShareLink function, replace slug generation with:
const { customSlug, name, profileName } = req.body

// Generate or validate slug
let slug: string
if (customSlug) {
  if (!isValidCustomSlug(customSlug)) {
    res.status(400).json({
      error: {
        code: 'INVALID_SLUG',
        message: 'Slug must be 3-50 lowercase alphanumeric characters or hyphens, starting and ending with alphanumeric',
        retryable: false
      }
    })
    return
  }
  const existing = await prisma.shareLink.findUnique({ where: { slug: customSlug } })
  if (existing) {
    res.status(400).json({
      error: {
        code: 'SLUG_TAKEN',
        message: 'This custom URL is already taken',
        retryable: false
      }
    })
    return
  }
  slug = customSlug
} else {
  slug = generateSlug() // existing random generation with collision check
}

// Generate name if not provided
const linkName = name || generateDefaultName(project.name, profileName)

// Include name in prisma.shareLink.create data:
data: {
  // ... existing fields ...
  name: linkName,
}
```

4. Add PATCH endpoint for updating name:
```typescript
/**
 * Update share link name
 */
export async function updateShareLinkName(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { shareLinkId } = req.params
  const { name } = req.body

  if (!name || typeof name !== 'string' || name.length > 100) {
    res.status(400).json({
      error: {
        code: 'INVALID_NAME',
        message: 'Name is required and must be 100 characters or less',
        retryable: false
      }
    })
    return
  }

  const shareLink = await prisma.shareLink.findUnique({
    where: { id: shareLinkId },
    include: { project: { select: { ownerId: true } } }
  })

  if (!shareLink) {
    throw new NotFoundError('Share link')
  }

  if (shareLink.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this share link')
  }

  const updated = await prisma.shareLink.update({
    where: { id: shareLinkId },
    data: { name }
  })

  res.json({ shareLink: updated })
}
```

5. Add route in `backend/src/routes/shareLink.routes.ts`:
```typescript
router.patch('/:shareLinkId/name', authenticate, asyncHandler(updateShareLinkName))
```

6. Ensure all ShareLink responses include `name` field (already included via Prisma select).

**Acceptance Criteria**:
- [ ] `isValidCustomSlug()` rejects invalid formats (e.g., `---`, `-abc`, `ABC`)
- [ ] `generateDefaultName()` produces correct format with/without profile
- [ ] Custom slug validation returns proper error messages
- [ ] Slug uniqueness check works correctly
- [ ] Random slug fallback works when no customSlug provided
- [ ] Name auto-generation works when no name provided
- [ ] PATCH endpoint updates name successfully
- [ ] All ShareLink responses include `name` field

---

## Phase 2: Frontend Updates

### Task 2.1: Update API client with new parameters
**Description**: Update frontend api.ts to support name, customSlug, and profileName params
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: None

**Technical Requirements**:
- Update `createShareLink` method signature
- Add `updateShareLinkName` method
- Update ShareLink type to include `name`

**Implementation Steps**:

1. Update `createShareLink` in `frontend/src/lib/api.ts`:
```typescript
async createShareLink(projectId: string, data: {
  accessType: string
  password?: string
  allowedEmails?: string[]
  expiresAt?: string
  recipientRole?: 'viewer' | 'collaborator'
  name?: string
  customSlug?: string
  profileName?: string
}) {
  return this.request<{ shareLink: unknown }>(`/api/projects/${projectId}/share-links`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
```

2. Add `updateShareLinkName` method:
```typescript
async updateShareLinkName(shareLinkId: string, name: string) {
  return this.request<{ shareLink: unknown }>(`/api/share-links/${shareLinkId}/name`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}
```

3. Update the ShareLink interface used in components to include `name`:
```typescript
interface ShareLink {
  id: string
  slug: string
  name: string  // Add this field
  accessType: string
  currentViews: number
  createdAt: string
  expiresAt?: string
  isActive: boolean
}
```

**Acceptance Criteria**:
- [ ] `createShareLink` accepts name, customSlug, profileName params
- [ ] `updateShareLinkName` method works correctly
- [ ] ShareLink interface includes `name` field
- [ ] TypeScript compiles without errors

---

### Task 2.2: Update ShareLinkManager UI with name and custom slug inputs
**Description**: Add name input, custom slug input, and update list display in ShareLinkManager component
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1
**Can run parallel with**: None

**Technical Requirements**:
- Add name input field with auto-generated preview
- Add collapsible custom slug input with live preview and validation
- Update link list to show name as primary identifier
- Keep existing access type badges, views count, copy/delete buttons

**Implementation Steps**:

1. Add state for new fields in ShareLinkManager:
```typescript
const [linkName, setLinkName] = useState('')
const [customSlug, setCustomSlug] = useState('')
const [showCustomSlug, setShowCustomSlug] = useState(false)
const [slugError, setSlugError] = useState('')
```

2. Add slug validation function:
```typescript
function validateSlug(slug: string): string | null {
  if (!slug) return null // Empty is valid (will use random)
  if (slug.length < 3) return 'Slug must be at least 3 characters'
  if (slug.length > 50) return 'Slug must be 50 characters or less'
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return 'Use lowercase letters, numbers, and hyphens only (no leading/trailing hyphens)'
  }
  return null
}
```

3. Generate default name preview based on selected profile:
```typescript
const defaultName = useMemo(() => {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const profileName = selectedProfile?.name
  if (profileName) {
    return `${project.name} - ${profileName} - ${date}`
  }
  return `${project.name} - ${date}`
}, [project.name, selectedProfile])
```

4. Add form fields in creation section (after existing fields):
```tsx
{/* Link Name */}
<div className="space-y-2">
  <label className="text-sm font-medium text-foreground">Link Name</label>
  <input
    type="text"
    value={linkName}
    onChange={(e) => setLinkName(e.target.value)}
    placeholder={defaultName}
    maxLength={100}
    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted"
  />
  <p className="text-xs text-muted">
    {linkName ? `Using: ${linkName}` : `Default: ${defaultName}`}
  </p>
</div>

{/* Custom URL (collapsible) */}
<div className="space-y-2">
  <button
    type="button"
    onClick={() => setShowCustomSlug(!showCustomSlug)}
    className="text-sm text-accent hover:underline flex items-center gap-1"
  >
    {showCustomSlug ? '− Hide' : '+ Customize URL'}
  </button>

  {showCustomSlug && (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted">{window.location.origin}/share/</span>
        <input
          type="text"
          value={customSlug}
          onChange={(e) => {
            const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
            setCustomSlug(val)
            setSlugError(validateSlug(val) || '')
          }}
          placeholder="custom-url"
          maxLength={50}
          className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted"
        />
      </div>
      {slugError && <p className="text-xs text-destructive">{slugError}</p>}
      {customSlug && !slugError && (
        <p className="text-xs text-success">URL: {window.location.origin}/share/{customSlug}</p>
      )}
    </div>
  )}
</div>
```

5. Update handleCreateLink to pass new params:
```typescript
const handleCreateLink = async () => {
  // Validate custom slug if provided
  if (customSlug) {
    const error = validateSlug(customSlug)
    if (error) {
      setSlugError(error)
      return
    }
  }

  try {
    await api.createShareLink(projectId, {
      accessType,
      password: accessType === 'password' ? password : undefined,
      allowedEmails: accessType === 'email' ? allowedEmails : undefined,
      recipientRole,
      name: linkName || undefined,  // Let backend generate default if empty
      customSlug: customSlug || undefined,
      profileName: selectedProfile?.name,
    })

    // Reset form
    setLinkName('')
    setCustomSlug('')
    setShowCustomSlug(false)
    setSlugError('')

    loadShareLinks()
  } catch (err) {
    // Handle slug-taken error specifically
    if (err instanceof Error && err.message.includes('already taken')) {
      setSlugError('This URL is already taken. Try a different one.')
    } else {
      setError(err instanceof Error ? err.message : 'Failed to create link')
    }
  }
}
```

6. Update link list display to show name prominently:
```tsx
{shareLinks.map((link) => (
  <div key={link.id} className="p-4 border border-border rounded-lg bg-card-bg">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        {/* Name as primary identifier */}
        <p className="font-medium text-foreground truncate">{link.name}</p>
        {/* URL below name */}
        <code className="text-sm text-muted font-mono">
          {window.location.origin}/share/{link.slug}
        </code>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Access type badge */}
        <Badge variant="secondary">{link.accessType}</Badge>
        {/* View count */}
        <span className="text-sm text-muted">{link.currentViews} views</span>
        {/* Copy button */}
        <Button size="sm" variant="ghost" onClick={() => copyLink(link.slug)}>
          Copy
        </Button>
        {/* Delete button */}
        <Button size="sm" variant="ghost" onClick={() => deleteLink(link.id)}>
          Delete
        </Button>
      </div>
    </div>
  </div>
))}
```

**Acceptance Criteria**:
- [ ] Name input shows auto-generated preview based on project + profile
- [ ] Custom slug input is collapsible (hidden by default)
- [ ] Custom slug validates in real-time with error messages
- [ ] URL preview updates as user types custom slug
- [ ] Create button passes all new parameters to API
- [ ] Link list shows name as primary identifier
- [ ] Link list shows URL/slug below name
- [ ] Existing badges and buttons still work

---

## Phase 3: Testing & Verification

### Task 3.1: Manual testing and verification
**Description**: Test all scenarios manually to ensure feature works end-to-end
**Size**: Small
**Priority**: High
**Dependencies**: Task 2.2
**Can run parallel with**: None

**Test Scenarios**:

1. **Default name generation with profile**:
   - Select an audience profile
   - Don't enter a custom name
   - Create link
   - Verify name is "{Project} - {Profile} - {Date}"

2. **Default name generation without profile**:
   - Don't select a profile
   - Don't enter a custom name
   - Create link
   - Verify name is "{Project} - {Date}"

3. **Custom name**:
   - Enter custom name "VIP Investors Link"
   - Create link
   - Verify name shows as entered

4. **Custom slug - valid**:
   - Expand custom URL section
   - Enter "investor-deck"
   - Create link
   - Verify URL is /share/investor-deck

5. **Custom slug - invalid characters**:
   - Enter "Investor Deck!"
   - Verify error message about valid characters
   - Button should be disabled or show error

6. **Custom slug - already taken**:
   - Create link with slug "test-slug"
   - Try to create another with same slug
   - Verify "already taken" error

7. **Random slug fallback**:
   - Don't enter custom slug
   - Create link
   - Verify 16-char hex slug is generated

8. **Name display in list**:
   - Create multiple links with different names
   - Verify list shows names prominently
   - Verify URLs shown below names

9. **Name editing**:
   - Use API or future UI to update name
   - Verify name updates in list

**Acceptance Criteria**:
- [ ] All 9 test scenarios pass
- [ ] No regressions in existing share link functionality
- [ ] Error messages are clear and helpful
- [ ] UI is responsive and intuitive

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1 | 1.1, 1.2 | Backend schema + controller changes |
| Phase 2 | 2.1, 2.2 | Frontend API client + UI updates |
| Phase 3 | 3.1 | Manual testing and verification |

**Total Tasks**: 5
**Critical Path**: 1.1 → 1.2 → 2.1 → 2.2 → 3.1 (sequential)
**Parallel Opportunities**: None (linear dependencies)

**Execution Order**:
1. Task 1.1: Schema migration (foundation)
2. Task 1.2: Backend controller updates
3. Task 2.1: Frontend API client
4. Task 2.2: Frontend UI changes
5. Task 3.1: Testing and verification
