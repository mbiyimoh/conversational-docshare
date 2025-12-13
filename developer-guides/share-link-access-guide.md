# Share Link & Access Control - Developer Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SHARE LINK & ACCESS CONTROL                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CREATOR SIDE                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   ShareLinkManager.tsx                               │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐   │   │
│  │  │ Profile Import  │  │  Access Type     │  │  Recipient Role   │   │   │
│  │  │                 │  │                  │  │                   │   │   │
│  │  │ - Audience      │  │ ○ Password       │  │ ○ Viewer          │   │   │
│  │  │   profiles      │  │ ○ Email (list)   │  │   (chat only)     │   │   │
│  │  │ - Collaborator  │  │ ○ Public (open)  │  │ ○ Collaborator    │   │   │
│  │  │   profiles      │  │ ○ Domain         │  │   (chat+comments) │   │   │
│  │  └─────────────────┘  └──────────────────┘  └───────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                         │                                   │
│                                         ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   shareLink.controller.ts                            │   │
│  │                                                                       │   │
│  │  createShareLink()                                                    │   │
│  │  - Generate 16-char hex slug                                         │   │
│  │  - Hash password (bcrypt, 12 rounds)                                 │   │
│  │  - Store email whitelist / domain whitelist                          │   │
│  │  - Set expiration / max views                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                                             │
│  VIEWER SIDE                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      SharePage.tsx                                   │   │
│  │                                                                       │   │
│  │  ┌───────────────────────────────────────────────────────────────┐   │   │
│  │  │                     ACCESS GATE                                │   │   │
│  │  │                                                                 │   │   │
│  │  │  accessType = 'open'                                           │   │   │
│  │  │  └─▶ Auto-grant, create conversation                           │   │   │
│  │  │                                                                 │   │   │
│  │  │  accessType = 'password'                                       │   │   │
│  │  │  └─▶ Show password input → verify → grant                      │   │   │
│  │  │                                                                 │   │   │
│  │  │  accessType = 'email'                                          │   │   │
│  │  │  └─▶ Show email input → check whitelist → grant                │   │   │
│  │  │                                                                 │   │   │
│  │  │  accessType = 'domain'                                         │   │   │
│  │  │  └─▶ Show email input → check domain → grant                   │   │   │
│  │  └───────────────────────────────────────────────────────────────┘   │   │
│  │                              │                                        │   │
│  │                              ▼ accessGranted                          │   │
│  │  ┌───────────────────────────────────────────────────────────────┐   │   │
│  │  │                   VIEWER EXPERIENCE                            │   │   │
│  │  │                                                                 │   │   │
│  │  │  ┌─────────────┐              ┌─────────────────────┐         │   │   │
│  │  │  │    Chat     │◀────────────▶│   Document Viewer   │         │   │   │
│  │  │  │             │   Citations   │                     │         │   │   │
│  │  │  │ ChatInterface│   click      │ DocumentContentViewer│         │   │   │
│  │  │  │             │              │                     │         │   │   │
│  │  │  └─────────────┘              └─────────────────────┘         │   │   │
│  │  │                                                                 │   │   │
│  │  │  recipientRole = 'collaborator'                                │   │   │
│  │  │  └─▶ Enable highlight-to-comment feature                       │   │   │
│  │  │      (CollaboratorCommentPanel)                                │   │   │
│  │  └───────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         AccessLog                                    │   │
│  │                                                                       │   │
│  │  Every access attempt logged:                                        │   │
│  │  - viewerEmail, viewerIp, userAgent                                  │   │
│  │  - accessGranted (true/false)                                        │   │
│  │  - denialReason (if denied)                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Dependencies & Key Functions

### External Dependencies
- `bcrypt` - Password hashing (12 rounds)
- `crypto` - Slug generation (randomBytes)
- `prisma` - ShareLink, AccessLog, Conversation models

### Internal Dependencies
- `backend/src/utils/password.ts` - `hashPassword()`, `verifyPassword()`, `validatePasswordStrength()`
- `backend/src/utils/errors.ts` - NotFoundError, AuthorizationError, ValidationError

### Provided Functions

**shareLink.controller.ts:**
- `createShareLink(projectId, data)` - Create new share link
- `getProjectShareLinks(projectId)` - List all links for project
- `updateShareLink(shareLinkId, data)` - Update link settings
- `deleteShareLink(shareLinkId)` - Remove link
- `getShareLinkBySlug(slug)` - Public: get link info
- `verifyShareLinkAccess(slug, credentials)` - Public: verify access
- `getDocumentsBySlug(slug)` - Public: get documents for viewer
- `getDocumentChunksBySlug(slug, documentId)` - Public: get chunks

**password.ts:**
- `validatePasswordStrength(password)` - Min 8 chars, upper/lower/number
- `hashPassword(password)` - bcrypt hash with validation
- `verifyPassword(password, hash)` - bcrypt compare

## User Experience Flow

### Creator Flow: Create Share Link

1. Open ShareLinkManager
2. (Optional) Import settings from saved profile
3. Select access type: password / email / open
4. Select recipient role: viewer / collaborator
5. (If password) Enter password (strength validated)
6. (If email) Enter allowed emails
7. Click "Create Share Link"
8. Copy link URL to share

### Viewer Flow: Access Share Link

1. Visit `/share/:slug`
2. Frontend loads share link info
3. **Access Gate** based on accessType:
   - `open`: Auto-grant, create conversation
   - `password`: Show password form → verify → grant
   - `email`: Show email form → check whitelist → grant
   - `domain`: Show email form → check domain → grant
4. On grant: Create conversation, show chat + documents
5. **Collaborator only**: Enable highlight-to-comment

## File & Code Mapping

### Key Files

| File | Responsibility | Lines |
|------|----------------|-------|
| `backend/src/controllers/shareLink.controller.ts` | All share link logic | 672 |
| `backend/src/routes/shareLink.routes.ts` | API routes | 80 |
| `backend/src/utils/password.ts` | Password hashing | 50 |
| `frontend/src/components/ShareLinkManager.tsx` | Link creation UI | 391 |
| `frontend/src/pages/SharePage.tsx` | Public share page | 596 |

### Entry Points

**Authenticated (Creator):**
- `POST /api/projects/:projectId/share-links` - Create link
- `GET /api/projects/:projectId/share-links` - List links
- `PATCH /api/share-links/:shareLinkId` - Update link
- `DELETE /api/share-links/:shareLinkId` - Delete link

**Public (Viewer):**
- `GET /api/share/:slug` - Get link info
- `POST /api/share/:slug/verify` - Verify access
- `GET /api/share/:slug/documents` - Get documents
- `GET /api/share/:slug/documents/:documentId/chunks` - Get chunks

### Database Models

```prisma
ShareLink {
  id, projectId, slug (unique 16-char hex)
  accessType: 'open' | 'password' | 'email' | 'domain'
  recipientRole: 'viewer' | 'collaborator'
  passwordHash, allowedEmails[], allowedDomains[]
  maxViews, currentViews, expiresAt, isActive
  accessLogs: AccessLog[]
  conversations: Conversation[]
}

AccessLog {
  id, shareLinkId, viewerEmail, viewerIp, userAgent
  accessGranted, denialReason, accessedAt
}
```

## Connections to Other Parts

### Integration Points

| System | Connection |
|--------|------------|
| Chat System | Conversation created per share link access |
| Documents | Documents accessed via share link endpoints |
| Comments | Collaborator role enables document comments |
| Analytics | AccessLog tracks all access attempts |
| Saved Profiles | Import audience/collaborator profile settings |

### Access Type Verification Flow

```
┌───────────────────────────────────────────────────────────────────┐
│                      verifyShareLinkAccess()                      │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. validateShareLinkStatus()                                     │
│     ├─ isActive check                                             │
│     ├─ expiresAt check                                            │
│     └─ maxViews check                                             │
│                                                                   │
│  2. Access Type Verification                                      │
│     ├─ open      → auto-grant                                     │
│     ├─ password  → bcrypt.compare(password, hash)                 │
│     ├─ email     → allowedEmails.includes(email)                  │
│     └─ domain    → allowedDomains.includes(email.split('@')[1])   │
│                                                                   │
│  3. On Success                                                    │
│     ├─ Create AccessLog (accessGranted: true)                     │
│     ├─ Increment currentViews                                     │
│     └─ Return { accessGranted: true }                             │
│                                                                   │
│  4. On Failure                                                    │
│     └─ Return error with code (retryable: true/false)             │
└───────────────────────────────────────────────────────────────────┘
```

## Critical Notes & Pitfalls

### Security

**Password Strength Validation:**
```typescript
// password.ts
function validatePasswordStrength(password: string): void {
  if (password.length < 8) throw new Error('Min 8 characters')
  if (!/[A-Z]/.test(password)) throw new Error('Need uppercase')
  if (!/[a-z]/.test(password)) throw new Error('Need lowercase')
  if (!/\d/.test(password)) throw new Error('Need number')
}
```

**bcrypt Configuration:**
```typescript
const salt = await bcrypt.genSalt(12)  // 12 rounds
return await bcrypt.hash(password, salt)
```

**Slug Generation:**
```typescript
// 16-char hex = 8 random bytes
function generateSlug(): string {
  return crypto.randomBytes(8).toString('hex')
}
```

### Data Integrity

**Link Status Validation (Applied to ALL access):**
```typescript
function validateShareLinkStatus(shareLink): ShareLinkValidationResult {
  if (!shareLink.isActive) return { errorCode: 'LINK_INACTIVE' }
  if (shareLink.expiresAt < new Date()) return { errorCode: 'LINK_EXPIRED' }
  if (shareLink.currentViews >= shareLink.maxViews) return { errorCode: 'MAX_VIEWS_EXCEEDED' }
  return { isValid: true }
}
```

### Known Edge Cases

**Slug Collision Retry:**
```typescript
// Only tries 10 times to generate unique slug
let attempts = 0
while (attempts < 10) {
  const existing = await prisma.shareLink.findUnique({ where: { slug } })
  if (!existing) break
  slug = generateSlug()
  attempts++
}
// At scale, might need longer slugs or more retries
```

**Open Access Auto-Grant:**
```typescript
// SharePage.tsx:162-165
if ((data.shareLink as ShareLink).accessType === 'open') {
  await createConversationAndGrant(data.shareLink)
  // Skips verification entirely - seamless UX
}
```

**Recipient Role Check:**
```typescript
// SharePage.tsx:110
const isCollaborator = shareLink?.recipientRole === 'collaborator'

// Only collaborators see comment button
{isCollaborator && selectedDocumentId && (
  <Button onClick={() => setCommentsDrawerOpen(true)}>
    Comments
  </Button>
)}
```

**Error Response Format:**
```typescript
{
  error: {
    code: 'LINK_EXPIRED',
    message: 'This link has expired',
    retryable: false  // false = permanent error, true = try again
  }
}
```

## Common Development Scenarios

### 1. Adding a New Access Type

**Files to modify:**
1. `backend/src/controllers/shareLink.controller.ts`:
   - Add validation case in `createShareLink()`
   - Add verification case in `verifyShareLinkAccess()`
2. `frontend/src/components/ShareLinkManager.tsx`:
   - Add radio option for new type
3. `frontend/src/pages/SharePage.tsx`:
   - Add form handling for new type

**Pattern:**
```typescript
// Controller
if (accessType === 'newType') {
  // Validate required fields
  if (!newField) throw new ValidationError('Field required')
  // Verify access
  const isValid = await checkNewTypeAccess(credentials)
  if (!isValid) return res.status(401).json({ error: {...} })
}
```

### 2. Adding Link Expiration Options

**File:** `frontend/src/components/ShareLinkManager.tsx`

Add UI controls for:
- `expiresAt` - DateTime picker
- `maxViews` - Number input

Backend already supports these fields.

### 3. Debugging Access Denied

**Steps:**
1. Check link status: `isActive`, `expiresAt`, `maxViews`
2. Check access type requirements
3. Look at `AccessLog` for denial reason
4. Verify credentials format (email format, password)

**Database query:**
```sql
SELECT * FROM share_links WHERE slug = 'xxx';
SELECT * FROM access_logs WHERE "shareLinkId" = 'yyy' ORDER BY "accessedAt" DESC;
```

### 4. Adding Email Invitation System

**New functionality to add:**
1. Email service integration (SendGrid, SES, etc.)
2. Invitation tracking table
3. Email template with password included
4. Frontend UI for "Invite by Email"

## Testing Strategy

### Manual Testing Checklist
- [ ] Create password-protected link
- [ ] Access with wrong password → error
- [ ] Access with correct password → granted
- [ ] Create email whitelist link
- [ ] Access with non-whitelisted email → error
- [ ] Access with whitelisted email → granted
- [ ] Create open link → auto-access
- [ ] Set maxViews, exceed it → error
- [ ] Set expiresAt in past → error
- [ ] Deactivate link → error

### Smoke Tests
```bash
# Create link
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"accessType":"password","password":"SecurePass1","recipientRole":"viewer"}' \
  http://localhost:4000/api/projects/$PROJECT_ID/share-links

# Get link info
curl http://localhost:4000/api/share/$SLUG

# Verify access
curl -X POST -H "Content-Type: application/json" \
  -d '{"password":"SecurePass1"}' \
  http://localhost:4000/api/share/$SLUG/verify
```

### Debugging Tips
- Check `AccessLog` table for all access attempts
- Look at `ShareLink.currentViews` vs `maxViews`
- Test password with `bcrypt.compare()` directly
- Check expiration in UTC (database stores UTC)

## Quick Reference

### Access Types

| Type | Required Field | Verification |
|------|----------------|--------------|
| `open` | None | Auto-grant |
| `password` | `password` | bcrypt compare |
| `email` | `email` | `allowedEmails.includes()` |
| `domain` | `email` | `allowedDomains.includes(domain)` |

### Recipient Roles

| Role | Capabilities |
|------|--------------|
| `viewer` | Chat, view documents, navigate citations |
| `collaborator` | All viewer capabilities + highlight-to-comment |

### Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `LINK_INACTIVE` | 403 | Link deactivated |
| `LINK_EXPIRED` | 410 | Past expiration date |
| `MAX_VIEWS_EXCEEDED` | 403 | View limit reached |
| `PASSWORD_REQUIRED` | 401 | Need password |
| `INVALID_PASSWORD` | 401 | Wrong password |
| `EMAIL_REQUIRED` | 401 | Need email |
| `EMAIL_NOT_ALLOWED` | 403 | Email not in whitelist |
| `DOMAIN_NOT_ALLOWED` | 403 | Domain not in whitelist |

### Key Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/projects/:id/share-links` | Yes | Create |
| GET | `/api/projects/:id/share-links` | Yes | List |
| PATCH | `/api/share-links/:id` | Yes | Update |
| DELETE | `/api/share-links/:id` | Yes | Delete |
| GET | `/api/share/:slug` | No | Get info |
| POST | `/api/share/:slug/verify` | No | Verify |
| GET | `/api/share/:slug/documents` | No | List docs |
| GET | `/api/share/:slug/documents/:id/chunks` | No | Get chunks |

### Critical Files Checklist
1. `backend/src/controllers/shareLink.controller.ts` - Core logic
2. `backend/src/utils/password.ts` - Password security
3. `frontend/src/components/ShareLinkManager.tsx` - Creation UI
4. `frontend/src/pages/SharePage.tsx` - Viewer experience
5. `backend/prisma/schema.prisma` - ShareLink, AccessLog models
