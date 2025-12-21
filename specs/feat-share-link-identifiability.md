# Share Link Identifiability

## Status
Approved

## Authors
Claude - December 21, 2025

## Overview
Add human-readable names and optional custom slugs to share links so creators can easily identify and share meaningful URLs. Currently, share links only have random 16-character hex slugs making them indistinguishable.

## Problem Statement
When a creator has multiple share links for a project (e.g., one for investors, one for advisors), they cannot tell them apart without clicking through each one. The current random slugs like `a1b2c3d4e5f6g7h8` provide no context and result in unmemorable URLs.

## Goals
1. Add a `name` field to ShareLink with smart auto-generated defaults
2. Allow optional custom URL slugs with validation
3. Display link names prominently in the share link list UI

## Non-Goals
- Changing the share link access/verification flow
- Adding link analytics or tracking beyond existing `currentViews`
- Bulk operations on share links
- Link categories or folders
- Slug editing after creation (would break existing URLs)

## Technical Approach

### Schema Changes
Add two fields to the `ShareLink` model in `prisma/schema.prisma`:

```prisma
model ShareLink {
  // ... existing fields ...

  name String  // Human-readable display name (required)
  // slug already exists - will now accept optional custom value
}
```

### Key Files to Modify
- `backend/prisma/schema.prisma` - Add `name` field
- `backend/src/controllers/shareLink.controller.ts` - Accept name/customSlug params, generate defaults
- `frontend/src/components/ShareLinkManager.tsx` - Add name input, optional custom slug input, display names in list
- `frontend/src/lib/api.ts` - Update `createShareLink` params

### Default Name Generation
Format: `"{Project Name} - {Profile Name} - {Mon DD}"`

Examples:
- "Pitch Deck - Investors - Dec 21"
- "Q4 Report - Board Members - Dec 21"
- "Pitch Deck - Dec 21" (if no profile selected)

### Custom Slug Validation
- URL-safe characters only: lowercase alphanumeric + hyphens
- Length: 3-50 characters
- Must be unique (check before creation)
- Fallback to random slug if not provided

## Implementation Details

### Backend Changes

**1. Schema Migration (`prisma/schema.prisma`)**
```prisma
model ShareLink {
  // Add after existing fields
  name String @db.VarChar(100)  // Required - display name for the link (max 100 chars)
}
```

**2. Controller Updates (`shareLink.controller.ts`)**

Update `createShareLink` to accept new parameters:
```typescript
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
```

Add slug validation helper:
```typescript
function isValidCustomSlug(slug: string): boolean {
  // Must start/end with alphanumeric, hyphens only between words, 3-50 chars
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 50
}
```

Update creation logic:
```typescript
// Generate or validate slug
let slug: string
if (customSlug) {
  if (!isValidCustomSlug(customSlug)) {
    throw new ValidationError('Slug must be 3-50 lowercase alphanumeric characters or hyphens')
  }
  const existing = await prisma.shareLink.findUnique({ where: { slug: customSlug } })
  if (existing) {
    throw new ValidationError('This custom URL is already taken')
  }
  slug = customSlug
} else {
  slug = generateSlug() // existing random generation
}

// Generate name if not provided
const linkName = name || generateDefaultName(project.name, profileName)

function generateDefaultName(projectName: string, profileName?: string): string {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (profileName) {
    return `${projectName} - ${profileName} - ${date}`
  }
  return `${projectName} - ${date}`
}
```

**3. API Response**
Include `name` in all ShareLink responses.

### Frontend Changes

**1. API Client (`api.ts`)**
Update `createShareLink` signature:
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
})
```

**2. ShareLinkManager Component**

Add to creation form:
- Name input field (optional, shows generated preview)
- Custom slug input (optional, with live preview)
- Slug availability indicator

Display in link list:
- Show name as primary identifier
- Show URL with slug below name
- Keep existing badges (access type, views, etc.)

### Migration for Existing Links
Existing links without names: Set `name` to slug value as fallback. This is handled in migration:

```sql
UPDATE share_links SET name = slug WHERE name IS NULL;
```

## User Experience

### Creation Flow
1. User opens share link creation modal
2. **Name field** shows auto-generated preview based on project + selected profile
3. User can edit name or leave default
4. **Custom URL field** (collapsed by default, expandable)
   - Shows preview: `yoursite.com/share/[custom-slug]`
   - Real-time validation feedback
   - "Check availability" on blur
5. User clicks Create
6. New link appears in list with name displayed

### Link List Display
```
┌─────────────────────────────────────────────────────────┐
│ Pitch Deck - Investors - Dec 21          [Password] 42 views │
│ yoursite.com/share/investor-deck                    [Copy] [Delete] │
├─────────────────────────────────────────────────────────┤
│ Pitch Deck - Advisors - Dec 20           [Email] 12 views │
│ yoursite.com/share/a1b2c3d4e5f6g7h8                 [Copy] [Delete] │
└─────────────────────────────────────────────────────────┘
```

## Testing Approach

### Key Scenarios to Test
1. **Default name generation**: Create link with profile selected → name includes profile name
2. **Default name without profile**: Create link without profile → name is project + date only
3. **Custom name**: Provide custom name → uses provided name
4. **Custom slug validation**: Invalid characters rejected, too short/long rejected
5. **Slug uniqueness**: Duplicate custom slug returns error
6. **Random slug fallback**: No custom slug → generates random hex
7. **Name display in list**: Names show correctly in UI

### Manual Testing
- Create multiple links with different profiles
- Verify names are distinguishable at a glance
- Test custom slug with special characters (should fail)
- Test slug collision handling

## Resolved Questions
1. **Allow editing name after creation?** Yes - add `PATCH /api/share-links/:id` to update `name` field
2. **Maximum name length?** 100 characters - add `@db.VarChar(100)` to schema

## Future Improvements and Enhancements

**OUT OF SCOPE for initial implementation:**

- **Slug editing after creation**: Complex (breaks bookmarks) - could add "create new link with same settings"
- **Slug suggestions**: Auto-suggest based on profile name (e.g., "investor-deck")
- **Link search/filter**: Search links by name when there are many
- **Link grouping**: Group links by audience type or creation date
- **Bulk operations**: Rename, delete, or export multiple links
- **Link templates**: Save commonly used configurations
- **Custom domain support**: Allow custom domains for share links
- **QR code generation**: Generate QR codes with embedded link name
- **Link analytics**: Track clicks over time, geographic data, etc.
- **Profanity filter**: Block offensive custom slugs

## References
- ShareLink model: `backend/prisma/schema.prisma:297-332`
- Slug generation: `backend/src/controllers/shareLink.controller.ts:10-12`
- ShareLinkManager UI: `frontend/src/components/ShareLinkManager.tsx`
