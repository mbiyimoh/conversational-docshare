# API Reference (OpenAPI Specification)

**Purpose:** Complete API endpoint specifications with request/response schemas, authentication requirements, and error codes.

---

## API Overview

**Base URL:** `https://api.conversational-docshare.com`
**API Version:** v1
**Protocol:** HTTPS only
**Authentication:** JWT Bearer tokens (except public share link access)
**Content-Type:** `application/json`

---

## Authentication Endpoints

### POST /api/auth/register

Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"  // optional
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": "cm1a2b3c4d5e6f7g8h9i0j",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "creator",
    "createdAt": "2025-01-15T10:30:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800  // 7 days in seconds
}
```

**Errors:**
- `400 Bad Request` - Invalid email or password format
- `409 Conflict` - Email already registered
- `429 Too Many Requests` - Rate limit exceeded (5 attempts per hour)

**Validation Rules:**
- Email: Valid RFC 5322 email format
- Password: Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number
- Name: Optional, maximum 100 characters

---

### POST /api/auth/login

Authenticate existing user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": "cm1a2b3c4d5e6f7g8h9i0j",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "creator"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800
}
```

**Errors:**
- `401 Unauthorized` - Invalid credentials
- `429 Too Many Requests` - Rate limit exceeded (10 attempts per hour per IP)

---

### GET /api/auth/me

Get current authenticated user.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:** `200 OK`
```json
{
  "id": "cm1a2b3c4d5e6f7g8h9i0j",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "creator",
  "createdAt": "2025-01-15T10:30:00Z"
}
```

**Errors:**
- `401 Unauthorized` - Missing or invalid token

---

## Project Management Endpoints

### POST /api/projects

Create a new project.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request:**
```json
{
  "name": "IP Framework Documentation",
  "description": "Comprehensive IP strategy for board review"  // optional
}
```

**Response:** `201 Created`
```json
{
  "id": "cm2x3y4z5a6b7c8d9e0f1g",
  "ownerId": "cm1a2b3c4d5e6f7g8h9i0j",
  "name": "IP Framework Documentation",
  "description": "Comprehensive IP strategy for board review",
  "totalViews": 0,
  "totalConversations": 0,
  "createdAt": "2025-01-15T11:00:00Z",
  "updatedAt": "2025-01-15T11:00:00Z"
}
```

**Errors:**
- `400 Bad Request` - Invalid name (empty or >200 chars)
- `401 Unauthorized` - Missing or invalid token
- `429 Too Many Requests` - Rate limit (100 projects per day)

**Rate Limits:**
- Free tier: 5 projects max
- Pro tier: Unlimited

---

### GET /api/projects

List all projects for authenticated user.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 20, max 100
- `sortBy` (optional): `createdAt` | `updatedAt` | `name`, default `updatedAt`
- `order` (optional): `asc` | `desc`, default `desc`

**Response:** `200 OK`
```json
{
  "projects": [
    {
      "id": "cm2x3y4z5a6b7c8d9e0f1g",
      "name": "IP Framework Documentation",
      "description": "Comprehensive IP strategy for board review",
      "totalViews": 45,
      "totalConversations": 12,
      "documentCount": 3,
      "createdAt": "2025-01-15T11:00:00Z",
      "updatedAt": "2025-01-20T14:30:00Z"
    }
  ],
  "pagination": {
    "total": 8,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Errors:**
- `401 Unauthorized` - Missing or invalid token

---

### GET /api/projects/:id

Get single project details.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:** `200 OK`
```json
{
  "id": "cm2x3y4z5a6b7c8d9e0f1g",
  "ownerId": "cm1a2b3c4d5e6f7g8h9i0j",
  "name": "IP Framework Documentation",
  "description": "Comprehensive IP strategy for board review",
  "totalViews": 45,
  "totalConversations": 12,
  "documents": [
    {
      "id": "cm3a4b5c6d7e8f9g0h1i2j",
      "filename": "IP_Framework.pdf",
      "filetype": "pdf",
      "filesize": 2457600,
      "summary": "Overview of intellectual property strategy...",
      "uploadedAt": "2025-01-15T11:15:00Z"
    }
  ],
  "agentConfig": {
    "id": "cm4b5c6d7e8f9g0h1i2j3k",
    "modelProvider": "openai",
    "modelName": "gpt-4-turbo",
    "temperature": 0.7,
    "createdAt": "2025-01-15T11:30:00Z"
  },
  "shareLinks": [
    {
      "id": "cm5c6d7e8f9g0h1i2j3k4l",
      "shareCode": "abc123xyz",
      "accessType": "email_required",
      "currentViews": 45,
      "createdAt": "2025-01-15T12:00:00Z"
    }
  ],
  "createdAt": "2025-01-15T11:00:00Z",
  "updatedAt": "2025-01-20T14:30:00Z"
}
```

**Errors:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Project belongs to different user
- `404 Not Found` - Project doesn't exist

---

### PUT /api/projects/:id

Update project details.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Updated Project Name",  // optional
  "description": "Updated description"  // optional
}
```

**Response:** `200 OK`
```json
{
  "id": "cm2x3y4z5a6b7c8d9e0f1g",
  "name": "Updated Project Name",
  "description": "Updated description",
  "updatedAt": "2025-01-20T15:00:00Z"
}
```

**Errors:**
- `400 Bad Request` - Invalid data
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Not project owner
- `404 Not Found` - Project doesn't exist

---

### DELETE /api/projects/:id

Delete project and all associated data (cascades).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:** `204 No Content`

**Errors:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Not project owner
- `404 Not Found` - Project doesn't exist

**Cascade Behavior:**
- Deletes all documents
- Deletes all document chunks and embeddings
- Deletes all context layers
- Deletes all share links
- Deletes all conversations and analytics

---

## Document Management Endpoints

### POST /api/projects/:projectId/documents

Upload document to project.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Request:**
```
POST /api/projects/cm2x3y4z5a6b7c8d9e0f1g/documents
Content-Type: multipart/form-data

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="report.pdf"
Content-Type: application/pdf

<binary data>
------WebKitFormBoundary--
```

**Response:** `202 Accepted`
```json
{
  "id": "cm3a4b5c6d7e8f9g0h1i2j",
  "filename": "report.pdf",
  "filetype": "pdf",
  "filesize": 2457600,
  "status": "processing",
  "uploadedAt": "2025-01-20T16:00:00Z",
  "estimatedProcessingTime": 30  // seconds
}
```

**Processing Status (async):**
```json
{
  "status": "processing" | "completed" | "failed",
  "progress": 75,  // percentage
  "result": {
    "fullText": "...",
    "outline": { ... },
    "quality": {
      "outlineConfidence": 0.85,
      "textCompleteness": 0.95,
      "warnings": []
    }
  }
}
```

**Errors:**
- `400 Bad Request` - Invalid file type or missing file
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Not project owner
- `404 Not Found` - Project doesn't exist
- `413 Payload Too Large` - File exceeds 50MB
- `415 Unsupported Media Type` - Invalid file extension
- `429 Too Many Requests` - Upload limit exceeded (10 docs per hour)

**Supported File Types:**
- `application/pdf` (.pdf)
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx)
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx)
- `text/markdown` (.md)

**File Size Limits:**
- PDF: 50MB
- DOCX: 50MB
- XLSX: 20MB
- Markdown: 10MB

---

### GET /api/projects/:projectId/documents/:documentId/status

Get document processing status.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:** `200 OK`
```json
{
  "id": "cm3a4b5c6d7e8f9g0h1i2j",
  "status": "completed",
  "progress": 100,
  "result": {
    "summary": "Financial projections for 18-month period...",
    "quality": {
      "outlineConfidence": 0.85,
      "textCompleteness": 0.95,
      "warnings": [
        "Some sections have low heading confidence"
      ]
    },
    "sectionCount": 12,
    "chunkCount": 45
  },
  "processedAt": "2025-01-20T16:00:30Z"
}
```

**Errors:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Not project owner
- `404 Not Found` - Document doesn't exist

---

### DELETE /api/projects/:projectId/documents/:documentId

Delete document.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:** `204 No Content`

**Errors:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Not project owner
- `404 Not Found` - Document doesn't exist

**Cascade Behavior:**
- Deletes document chunks
- Deletes embeddings
- File removed from storage

---

## Agent Configuration Endpoints

### POST /api/projects/:projectId/agent-config

Create or update agent configuration via interview.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request:**
```json
{
  "interviewResponses": {
    "primaryAudience": "Board members and investors",
    "communicationStyle": "professional_approachable",
    "emphasisAreas": ["ROI projections", "Risk mitigation", "Timeline"],
    "speculationAllowed": false,
    "mainPurpose": "Explain IP framework for board review",

    // Optional deep dive questions
    "anticipatedQuestions": [
      "What's the expected ROI?",
      "What are the main risks?"
    ],
    "expertiseLevel": "business_executive",
    "sensitivTopics": ["Competitive analysis"],
    "suggestedActions": ["Schedule follow-up meeting"],
    "proactiveQuestions": ["How does this align with Q3 strategy?"],
    "relationshipDynamic": "advisory"
  },
  "modelProvider": "openai",  // optional, default "openai"
  "modelName": "gpt-4-turbo",  // optional, default "gpt-4-turbo"
  "temperature": 0.7  // optional, default 0.7
}
```

**Response:** `201 Created` or `200 OK` (if updating)
```json
{
  "id": "cm4b5c6d7e8f9g0h1i2j3k",
  "projectId": "cm2x3y4z5a6b7c8d9e0f1g",
  "modelProvider": "openai",
  "modelName": "gpt-4-turbo",
  "temperature": 0.7,
  "contextLayersGenerated": 4,
  "createdAt": "2025-01-15T11:30:00Z",
  "updatedAt": "2025-01-20T16:30:00Z"
}
```

**Errors:**
- `400 Bad Request` - Invalid interview responses
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Not project owner
- `404 Not Found` - Project doesn't exist

**Processing:**
This endpoint triggers:
1. Validation of interview responses
2. Generation of 3-4 context layers (audience, communication, content, engagement)
3. Compilation of agent config JSON
4. Storage in database

---

### GET /api/projects/:projectId/agent-config

Get current agent configuration.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:** `200 OK`
```json
{
  "id": "cm4b5c6d7e8f9g0h1i2j3k",
  "projectId": "cm2x3y4z5a6b7c8d9e0f1g",
  "analysisSummary": "Documents cover IP strategy with focus on...",
  "modelProvider": "openai",
  "modelName": "gpt-4-turbo",
  "temperature": 0.7,
  "contextLayers": [
    {
      "id": "cm5d6e7f8g9h0i1j2k3l4m",
      "name": "Audience Profile",
      "category": "audience",
      "priority": 1,
      "content": "Primary Audience: Board members...",
      "isActive": true
    }
  ],
  "configJson": {
    "audience": {
      "primary": "board_members",
      "expertiseLevel": "business_executive"
    },
    "communication": {
      "tone": "professional_approachable",
      "formalityLevel": 7
    }
  },
  "createdAt": "2025-01-15T11:30:00Z"
}
```

**Errors:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Not project owner
- `404 Not Found` - Project or config doesn't exist

---

## Share Link Endpoints

### POST /api/projects/:projectId/share

Create a new share link.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request:**
```json
{
  "accessType": "email_required",  // "public_password" | "email_required" | "whitelist"
  "password": "SecurePass123",  // optional, required if accessType="public_password"
  "whitelist": ["john@board.com", "jane@investor.com"],  // optional, required if accessType="whitelist"
  "expiresAt": "2025-02-15T00:00:00Z",  // optional
  "maxViews": 100  // optional
}
```

**Response:** `201 Created`
```json
{
  "id": "cm5c6d7e8f9g0h1i2j3k4l",
  "projectId": "cm2x3y4z5a6b7c8d9e0f1g",
  "shareCode": "a7f3c2e9d1",
  "shareUrl": "https://app.conversational-docshare.com/s/a7f3c2e9d1",
  "accessType": "email_required",
  "expiresAt": "2025-02-15T00:00:00Z",
  "maxViews": 100,
  "currentViews": 0,
  "createdAt": "2025-01-20T17:00:00Z"
}
```

**Errors:**
- `400 Bad Request` - Invalid access type or missing required fields
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Not project owner
- `404 Not Found` - Project doesn't exist
- `429 Too Many Requests` - Share link limit (10 per project per day)

**Share Code Generation:**
- Length: 10 characters
- Characters: alphanumeric (a-z, A-Z, 0-9)
- Collision detection (retry if exists)

---

### GET /api/share/:shareCode

Access shared project (public endpoint, no auth).

**Query Parameters (if accessType requires):**
- `email` (optional): Viewer email address
- `password` (optional): Share link password

**Response:** `200 OK`
```json
{
  "accessGranted": true,
  "sessionId": "session_abc123",
  "project": {
    "id": "cm2x3y4z5a6b7c8d9e0f1g",
    "name": "IP Framework Documentation",
    "description": "Comprehensive IP strategy for board review"
  },
  "documents": [
    {
      "id": "cm3a4b5c6d7e8f9g0h1i2j",
      "filename": "IP_Framework.pdf",
      "summary": "Overview of intellectual property strategy..."
    }
  ],
  "agentConfigured": true
}
```

**Access Gate Scenarios:**

**1. public_password:**
```
GET /api/share/a7f3c2e9d1?password=SecurePass123

If password correct: 200 OK
If password wrong: 403 Forbidden
```

**2. email_required:**
```
GET /api/share/a7f3c2e9d1?email=viewer@example.com

Always: 200 OK (email logged for creator analytics)
```

**3. whitelist:**
```
GET /api/share/a7f3c2e9d1?email=john@board.com

If email in whitelist: 200 OK
If email not in whitelist: 403 Forbidden
```

**Errors:**
- `400 Bad Request` - Missing required parameters (email, password)
- `403 Forbidden` - Access denied (wrong password, not whitelisted)
- `404 Not Found` - Share link doesn't exist
- `410 Gone` - Share link expired or max views exceeded

---

### DELETE /api/projects/:projectId/share/:shareLinkId

Delete share link.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:** `204 No Content`

**Errors:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Not project owner
- `404 Not Found` - Share link doesn't exist

---

## Chat Endpoints

### POST /api/chat

Send message to AI agent.

**Headers (if authenticated):**
```
Authorization: Bearer <jwt_token>  // optional
Content-Type: application/json
```

**Request:**
```json
{
  "projectId": "cm2x3y4z5a6b7c8d9e0f1g",
  "sessionId": "session_abc123",
  "messages": [
    {
      "role": "user",
      "content": "What's the projected ROI in the financial projections?"
    }
  ]
}
```

**Response:** `200 OK` (streaming)

**Content-Type:** `text/event-stream`

**Stream Format:**
```
data: {"type":"token","content":"According"}
data: {"type":"token","content":" to"}
data: {"type":"token","content":" the"}
data: {"type":"token","content":" Financial"}
data: {"type":"token","content":" Projections"}
data: {"type":"reference","doc":"financial.pdf","section":"section-3-2"}
data: {"type":"token","content":", the"}
data: {"type":"token","content":" projected"}
data: {"type":"token","content":" ROI"}
data: {"type":"done","usage":{"totalTokens":250}}
```

**Parsed Response:**
```json
{
  "role": "assistant",
  "content": "According to the Financial Projections [DOC:financial.pdf:section-3-2], the projected ROI is 35% over 18 months...",
  "citations": [
    {
      "filename": "financial.pdf",
      "sectionId": "section-3-2",
      "verified": true
    }
  ],
  "usage": {
    "totalTokens": 250,
    "inputTokens": 200,
    "outputTokens": 50
  }
}
```

**Errors:**
- `400 Bad Request` - Invalid projectId or messages format
- `401 Unauthorized` - Invalid session (for authenticated users)
- `403 Forbidden` - No access to project
- `404 Not Found` - Project doesn't exist
- `429 Too Many Requests` - Rate limit (100 messages per hour for free tier)
- `500 Internal Server Error` - LLM API error
- `502 Bad Gateway` - LLM provider unavailable

**Rate Limits:**
- Unauthenticated (share link): 20 messages per session
- Free tier: 100 messages per day
- Pro tier: Unlimited

---

### GET /api/chat/:sessionId/history

Get conversation history.

**Headers:**
```
Authorization: Bearer <jwt_token>  // optional for viewers
```

**Response:** `200 OK`
```json
{
  "sessionId": "session_abc123",
  "projectId": "cm2x3y4z5a6b7c8d9e0f1g",
  "messages": [
    {
      "role": "assistant",
      "content": "Hi! I'm here to help you understand the IP Framework documentation...",
      "timestamp": "2025-01-20T18:00:00Z"
    },
    {
      "role": "user",
      "content": "What's the projected ROI?",
      "timestamp": "2025-01-20T18:01:00Z"
    }
  ],
  "messageCount": 8,
  "duration": 1200,  // seconds
  "documentsViewed": ["cm3a4b5c6d7e8f9g0h1i2j"]
}
```

**Errors:**
- `404 Not Found` - Session doesn't exist

---

## Analytics Endpoints

### GET /api/projects/:projectId/analytics

Get project analytics.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `startDate` (optional): ISO 8601 date, default 30 days ago
- `endDate` (optional): ISO 8601 date, default now

**Response:** `200 OK`
```json
{
  "projectId": "cm2x3y4z5a6b7c8d9e0f1g",
  "period": {
    "start": "2024-12-21T00:00:00Z",
    "end": "2025-01-20T00:00:00Z"
  },
  "overview": {
    "totalViews": 45,
    "uniqueViewers": 28,
    "totalConversations": 12,
    "averageConversationDuration": 900,  // seconds
    "averageMessagesPerConversation": 6.5
  },
  "documentEngagement": [
    {
      "documentId": "cm3a4b5c6d7e8f9g0h1i2j",
      "filename": "IP_Framework.pdf",
      "views": 30,
      "averageTimeViewed": 420  // seconds
    }
  ],
  "topQuestions": [
    "What's the projected ROI?",
    "What are the main risks?",
    "When can we expect results?"
  ],
  "conversionRate": 0.42  // 42% of viewers created accounts
}
```

**Errors:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Not project owner
- `404 Not Found` - Project doesn't exist

---

### GET /api/projects/:projectId/conversations

List all conversations for project.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 20, max 100
- `sortBy` (optional): `createdAt` | `duration` | `messageCount`, default `createdAt`

**Response:** `200 OK`
```json
{
  "conversations": [
    {
      "id": "cm6e7f8g9h0i1j2k3l4m5n",
      "sessionId": "session_abc123",
      "viewerEmail": "john@board.com",
      "messageCount": 8,
      "duration": 1200,
      "documentsViewed": ["cm3a4b5c6d7e8f9g0h1i2j"],
      "summary": "Viewer asked about ROI projections and timeline...",
      "keyTopics": ["ROI", "Timeline", "Risks"],
      "sentiment": "positive",
      "createdAt": "2025-01-20T18:00:00Z"
    }
  ],
  "pagination": {
    "total": 12,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Errors:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Not project owner
- `404 Not Found` - Project doesn't exist

---

### GET /api/conversations/:conversationId

Get detailed conversation view.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:** `200 OK`
```json
{
  "id": "cm6e7f8g9h0i1j2k3l4m5n",
  "projectId": "cm2x3y4z5a6b7c8d9e0f1g",
  "sessionId": "session_abc123",
  "viewerEmail": "john@board.com",
  "messages": [
    {
      "role": "assistant",
      "content": "Hi! I'm here to help...",
      "timestamp": "2025-01-20T18:00:00Z"
    }
  ],
  "messageCount": 8,
  "duration": 1200,
  "documentsViewed": ["cm3a4b5c6d7e8f9g0h1i2j"],
  "summary": "Viewer asked about ROI projections and timeline. Showed particular interest in risk mitigation strategies. Asked clarifying questions about competitive analysis. Overall engaged and positive.",
  "keyTopics": ["ROI", "Timeline", "Risks", "Competition"],
  "questions": [
    "What's the projected ROI?",
    "What are the main risks?",
    "How does this compare to competitors?"
  ],
  "sentiment": "positive",
  "actionItems": [
    "Prepare contingency timeline document",
    "Schedule follow-up on competitive analysis"
  ],
  "createdAt": "2025-01-20T18:00:00Z"
}
```

**Errors:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Not project owner
- `404 Not Found` - Conversation doesn't exist

---

## Error Response Format

All error responses follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": {
      "field": "email",
      "constraint": "required"
    }
  },
  "requestId": "req_abc123xyz",
  "timestamp": "2025-01-20T18:00:00Z"
}
```

**Common Error Codes:**
- `VALIDATION_ERROR` - Request validation failed
- `AUTHENTICATION_REQUIRED` - Missing authentication token
- `INVALID_TOKEN` - Token expired or malformed
- `FORBIDDEN` - User lacks permission
- `NOT_FOUND` - Resource doesn't exist
- `CONFLICT` - Resource already exists
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `PAYLOAD_TOO_LARGE` - File or request too large
- `UNSUPPORTED_MEDIA_TYPE` - Invalid file type
- `INTERNAL_ERROR` - Server error
- `LLM_ERROR` - LLM provider error
- `SERVICE_UNAVAILABLE` - Temporary service issue

---

## Rate Limiting

**Headers (all responses):**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642694400
```

**Rate Limits by Endpoint:**

| Endpoint | Free Tier | Pro Tier |
|----------|-----------|----------|
| POST /api/auth/register | 5/hour | N/A |
| POST /api/auth/login | 10/hour | 50/hour |
| POST /api/projects | 10/day | Unlimited |
| POST /api/projects/:id/documents | 10/hour | 100/hour |
| POST /api/chat | 100/day | Unlimited |
| All other endpoints | 1000/hour | 10000/hour |

**Response when rate limit exceeded:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Try again in 3600 seconds.",
    "retryAfter": 3600
  }
}
```

---

## Webhooks (Future)

**Coming in Phase 3:**

```
POST /api/projects/:projectId/webhooks

Configure webhooks for events:
- document.uploaded
- document.processed
- share_link.accessed
- conversation.started
- conversation.ended
```

---

## OpenAPI 3.0 Schema

**Full OpenAPI specification available at:**
`https://api.conversational-docshare.com/openapi.json`

**Swagger UI:**
`https://api.conversational-docshare.com/docs`

---

## Summary

This API reference provides:

- ✅ **Complete endpoint specifications** - All 25+ endpoints documented
- ✅ **Request/response schemas** - JSON examples for every endpoint
- ✅ **Authentication requirements** - JWT bearer tokens with clear rules
- ✅ **Error handling** - Standardized error codes and formats
- ✅ **Rate limiting** - Clear limits per tier and endpoint
- ✅ **Validation rules** - Input constraints documented
- ✅ **Cascade behaviors** - Delete operations clearly specified

**Next Steps:**
1. Generate OpenAPI 3.0 schema file
2. Set up Swagger UI for interactive docs
3. Implement rate limiting middleware
4. Add request validation middleware
5. Create API client libraries (TypeScript, Python)
