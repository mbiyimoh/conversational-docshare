# Saved Audience & Collaborator Profiles

**Status:** Draft
**Author:** Claude Code
**Date:** 2025-12-07
**Related:** `docs/ideation/collaborative-capsule-enhancements.md` (Spec 5)

---

## Overview

Allow users to save reusable audience profiles (board members, investors, clients) and individual collaborator profiles (named contacts with communication preferences) on their Dashboard. When creating share links, users can import saved profiles to pre-populate configuration settings.

## Problem Statement

Currently, users must manually configure audience settings and collaborator details every time they create a share link. For users who frequently share with the same types of audiences (investors, board members) or specific individuals, this is repetitive. Saved profiles enable one-time setup with reuse across multiple projects.

## Goals

- Users can create, edit, and delete audience profiles from Dashboard
- Users can create, edit, and delete collaborator profiles from Dashboard
- Users can import an audience profile when creating a share link (copies settings, not linked)
- Users can assign a collaborator profile when creating a share link (copies settings, not linked)
- Usage count tracks how many times each profile has been used

## Non-Goals

- Linked profiles (changes to profile don't update existing share links)
- Team/organization shared profiles
- Profile templates provided by system
- Importing profiles from external sources
- Batch operations on profiles
- Profile analytics beyond usage count
- Associating collaborator profiles with audience profiles (groups)

---

## Technical Approach

### Database Models

Add two new Prisma models following existing patterns:

```prisma
// Saved audience profiles (templates for audience types)
model AudienceProfile {
  id          String   @id @default(cuid())
  ownerId     String
  owner       User     @relation("UserAudienceProfiles", fields: [ownerId], references: [id], onDelete: Cascade)

  name        String                    // "Board Members", "Series A Investors"
  description String?  @db.Text         // Optional notes about this audience

  // Configuration fields (match interview/context layer data)
  audienceDescription   String?  @db.Text  // Who they are, background
  communicationStyle    String?  @db.Text  // Formal, casual, technical level
  topicsEmphasis        String?  @db.Text  // What to focus on
  accessType            String   @default("password")  // Default access type

  timesUsed   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([ownerId])
}

// Saved individual collaborator profiles
model CollaboratorProfile {
  id          String   @id @default(cuid())
  ownerId     String
  owner       User     @relation("UserCollaboratorProfiles", fields: [ownerId], references: [id], onDelete: Cascade)

  name        String                    // "John Smith"
  email       String?                   // Contact email
  description String?  @db.Text         // Role, relationship notes

  // Collaborator-specific preferences
  communicationNotes  String?  @db.Text  // How to communicate with this person
  expertiseAreas      String[]           // What they're experts in
  feedbackStyle       String?            // "direct", "gentle", "detailed", "high-level"

  timesUsed   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([ownerId])
  @@index([email])
}
```

Update User model with relations:
```prisma
model User {
  // ... existing fields
  audienceProfiles     AudienceProfile[]     @relation("UserAudienceProfiles")
  collaboratorProfiles CollaboratorProfile[] @relation("UserCollaboratorProfiles")
}
```

### Backend API Endpoints

**Audience Profiles:**
- `GET /api/audience-profiles` - List user's audience profiles
- `POST /api/audience-profiles` - Create audience profile
- `PATCH /api/audience-profiles/:id` - Update audience profile
- `DELETE /api/audience-profiles/:id` - Delete audience profile

**Collaborator Profiles:**
- `GET /api/collaborator-profiles` - List user's collaborator profiles
- `POST /api/collaborator-profiles` - Create collaborator profile
- `PATCH /api/collaborator-profiles/:id` - Update collaborator profile
- `DELETE /api/collaborator-profiles/:id` - Delete collaborator profile

**Usage Tracking:**
- When importing a profile during share link creation, increment `timesUsed` on the profile

### Frontend Components

**New Components:**
- `AudienceProfileManager.tsx` - CRUD UI for audience profiles (modal-based)
- `CollaboratorProfileManager.tsx` - CRUD UI for collaborator profiles (modal-based)
- `SavedProfilesSection.tsx` - Dashboard section showing both profile types side-by-side

**Modified Components:**
- `DashboardPage.tsx` - Add SavedProfilesSection after My Projects
- `ShareLinkManager.tsx` (or equivalent) - Add "Import Audience" and "Add Collaborator" dropdowns

---

## Implementation Details

### Dashboard Layout (DashboardPage.tsx)

Add new section after "My Projects" section (~line 172):

```tsx
{/* Saved Profiles Section */}
<section className="mb-8">
  <div className="grid gap-6 md:grid-cols-2">
    {/* Saved Audiences */}
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Saved Audiences</h2>
        <button onClick={() => setShowAudienceModal(true)} className="text-blue-600 hover:text-blue-800">
          + New
        </button>
      </div>
      {audienceProfiles.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center shadow border border-gray-200">
          <p className="text-gray-500">No saved audiences yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {audienceProfiles.map(profile => (
            <AudienceProfileCard key={profile.id} profile={profile} onEdit={...} onDelete={...} />
          ))}
        </div>
      )}
    </div>

    {/* My Collaborators */}
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">My Collaborators</h2>
        <button onClick={() => setShowCollaboratorModal(true)} className="text-blue-600 hover:text-blue-800">
          + New
        </button>
      </div>
      {collaboratorProfiles.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center shadow border border-gray-200">
          <p className="text-gray-500">No collaborators saved yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {collaboratorProfiles.map(profile => (
            <CollaboratorProfileCard key={profile.id} profile={profile} onEdit={...} onDelete={...} />
          ))}
        </div>
      )}
    </div>
  </div>
</section>
```

### Profile Card Display

Each profile card shows:
- **Audience:** Name, description preview, access type badge, "Used X times"
- **Collaborator:** Name, email, expertise tags, feedback style badge, "Used X times"

### Share Link Import Flow

In ShareLinkManager (or share link creation form):

```tsx
{/* Import from saved profile */}
<div className="flex gap-4 mb-4">
  <select
    onChange={(e) => handleImportAudience(e.target.value)}
    className="border rounded px-3 py-2"
  >
    <option value="">Import Audience Profile...</option>
    {audienceProfiles.map(p => (
      <option key={p.id} value={p.id}>{p.name}</option>
    ))}
  </select>

  {recipientRole === 'collaborator' && (
    <select
      onChange={(e) => handleAddCollaborator(e.target.value)}
      className="border rounded px-3 py-2"
    >
      <option value="">Add Collaborator...</option>
      {collaboratorProfiles.map(p => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  )}
</div>
```

**Import Behavior:**
- Selecting an audience profile copies its fields into the share link form
- Selecting a collaborator profile copies email to `allowedEmails` (if email access type) or pre-fills viewer name
- After import, user can still modify values before creating the link
- On successful share link creation, increment `timesUsed` on used profiles

### API Client Methods (api.ts)

```typescript
// Audience Profiles
async getAudienceProfiles() {
  return this.request<{ profiles: AudienceProfile[] }>('/api/audience-profiles')
}

async createAudienceProfile(data: CreateAudienceProfileInput) {
  return this.request<{ profile: AudienceProfile }>('/api/audience-profiles', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

async updateAudienceProfile(id: string, data: UpdateAudienceProfileInput) {
  return this.request<{ profile: AudienceProfile }>(`/api/audience-profiles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

async deleteAudienceProfile(id: string) {
  return this.request<void>(`/api/audience-profiles/${id}`, { method: 'DELETE' })
}

// Collaborator Profiles (same pattern)
async getCollaboratorProfiles() { ... }
async createCollaboratorProfile(data: CreateCollaboratorProfileInput) { ... }
async updateCollaboratorProfile(id: string, data: UpdateCollaboratorProfileInput) { ... }
async deleteCollaboratorProfile(id: string) { ... }
```

---

## Testing Approach

### Essential Tests

1. **CRUD Operations:**
   - Create audience profile with all fields
   - Create collaborator profile with all fields
   - Update profile fields
   - Delete profile
   - Verify ownership validation (can't access others' profiles)

2. **Import Flow:**
   - Import audience profile populates form correctly
   - Import collaborator profile adds email to allowed list
   - `timesUsed` increments on successful share link creation

3. **Dashboard Display:**
   - Profiles load and display on dashboard
   - Empty state shows when no profiles
   - Card click opens edit modal

---

## User Experience

### Profile Creation Modal

Simple form with:
- Name (required)
- Description (optional)
- Configuration fields based on profile type
- Save / Cancel buttons

### Profile Cards

Compact display:
```
┌─────────────────────────────────────┐
│ 👥 Board Members                    │
│ Executive oversight group           │
│ 🔒 Password  •  Used 3 times       │
│                        [Edit] [🗑]  │
└─────────────────────────────────────┘
```

### Import Feedback

When profile is imported:
- Form fields animate/highlight to show what was filled
- Toast: "Imported settings from 'Board Members'"

---

## Open Questions

1. **Profile icon/avatar:** Should profiles have optional icons/colors for visual distinction?
   - **Recommendation:** Defer to Future Improvements, use emoji prefix for now

2. **Duplicate detection:** Warn if creating profile with same name?
   - **Recommendation:** Allow duplicates, user manages their own profiles

---

## Future Improvements and Enhancements

**Out of scope for initial implementation:**

- **Profile groups:** Associate collaborators with audiences (e.g., "Board Members" contains John, Sarah, Mike)
- **Profile sharing:** Share profiles across team/organization accounts
- **Profile templates:** System-provided starter profiles for common audiences
- **Import/export:** Export profiles as JSON, import from file
- **Profile analytics:** Track which profiles lead to most engagement
- **Linked profiles:** Changes to profile auto-update existing share links
- **Profile versioning:** History of profile changes
- **Profile suggestions:** AI suggests profiles based on project content
- **Bulk operations:** Delete multiple profiles, merge duplicates
- **Profile search/filter:** Search profiles by name, filter by usage
- **Profile ordering:** Custom sort order, pin favorites
- **Rich profile icons:** Upload avatar images for collaborators

---

## References

- Ideation: `docs/ideation/collaborative-capsule-enhancements.md` (Section 8, Spec 5)
- Existing patterns: `backend/src/controllers/shareLink.controller.ts`
- Dashboard layout: `frontend/src/pages/DashboardPage.tsx`
- API patterns: `frontend/src/lib/api.ts`
