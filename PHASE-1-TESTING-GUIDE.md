# Phase 1 MVP Testing Guide

## Quick Start
- **Frontend**: http://localhost:3034
- **Backend**: http://localhost:4000
- **Database**: Supabase (ai-docshare project)

## System Status
All Phase 1 implementation complete:
- ✅ Backend API (7 routes, all endpoints working)
- ✅ Frontend Components (9 components fully built)
- ✅ Page Orchestration (5 pages with full navigation)
- ✅ Document Reference System (parser + renderer)
- ✅ Share Link System (3 access types)

---

## Test Workflow 1: Creator Experience (30-45 minutes)

### Phase 1: Account Setup & Project Creation
**Goal**: Test registration and project setup

1. **Register New Account**
   - Navigate to http://localhost:3034
   - Click "Register" or go to http://localhost:3034/register
   - Enter:
     - Email: test-creator@example.com
     - Password: TestPass123!
     - Name: Test Creator (optional)
   - Click "Register"
   - **Expected**: Redirect to dashboard

2. **Create Project**
   - Click "Create Project" button
   - Enter:
     - Name: "Q4 Board Presentation"
     - Description: "Financial projections and strategic initiatives for Q4 2024"
   - Click "Create"
   - **Expected**: Project card appears in dashboard

3. **Navigate to Project**
   - Click on "Q4 Board Presentation" project card
   - **Expected**: Project detail page with 4 tabs (Documents, AI Agent, Share, Analytics)

---

### Phase 2: Document Upload
**Goal**: Test document processing pipeline

4. **Upload Documents** (Documents Tab)
   - Click "Documents" tab (should be active by default)
   - Test uploads:
     - **PDF**: Any business PDF (financial report, presentation)
     - **DOCX**: Any Word document (if available)
     - **XLSX**: Any spreadsheet (if available)
   - Click "Upload Document" for each
   - **Expected**:
     - Progress indicator during upload
     - Success message
     - Document appears in list with processing status
     - After ~30-60 seconds: Status changes to "Processed" with summary

5. **Verify Document Processing**
   - Check that each document shows:
     - ✅ Filename
     - ✅ File size
     - ✅ Upload date
     - ✅ Processing status
     - ✅ AI-generated summary (after processing)
   - Click "View" on a document
   - **Expected**: Document outline panel opens

---

### Phase 3: AI Agent Configuration
**Goal**: Test interview system and context layer generation

6. **Complete Agent Interview** (AI Agent Tab)
   - Click "AI Agent" tab
   - Answer 5 questions:
     1. **Primary Audience**: "Board members and investors"
     2. **Purpose**: "Present Q4 financial results and strategic plans"
     3. **Communication Tone**: "Professional but approachable"
     4. **Key Emphasis Areas**: "ROI, growth projections, risk mitigation"
     5. **Sample Questions**: "What's our projected ROI? What are the main risks?"
   - Click "Submit" after each question
   - Click "Complete Configuration" at end
   - **Expected**:
     - Progress bar advances with each question
     - Success message: "Agent configured successfully"
     - Context layers created in database

7. **Preview Agent Behavior**
   - Still in AI Agent tab
   - Look for "Test Agent" or "Preview" section
   - Type test message: "What's the main focus of this project?"
   - **Expected**: AI responds based on configuration

---

### Phase 4: Share Link Creation
**Goal**: Test all 3 access control types

8. **Create Password-Protected Link** (Share Tab)
   - Click "Share" tab
   - In "Create Share Link" section:
     - Access Type: "Password Protected"
     - Password: "boardmeeting2024"
   - Click "Create Share Link"
   - **Expected**:
     - Link appears in "Existing Links" section
     - Format: `http://localhost:3034/share/{slug}`
     - Shows: Password type, 0 views, creation date
   - Click "Copy" button
   - **Expected**: Link copied to clipboard

9. **Create Email-Required Link**
   - Create another link with:
     - Access Type: "Email Required"
   - **Expected**: Link created without password field

10. **Create Public Link**
    - Create third link with:
      - Access Type: "Public (No Protection)"
    - **Expected**: Link created immediately

11. **Test Link Management**
    - Verify all 3 links appear in list
    - Test "Copy" button on each
    - Test "Delete" button (delete the public link)
    - **Expected**: Confirmation dialog, then link removed

---

### Phase 5: Analytics Dashboard
**Goal**: Verify analytics tracking setup

12. **Check Analytics Tab**
    - Click "Analytics" tab
    - **Expected** (before any views):
      - Total Views: 0
      - Active Conversations: 0
      - Avg. Time Spent: N/A
      - Message placeholder: "No conversations yet"
    - Note: Will populate after viewer testing

---

## Test Workflow 2: Viewer Experience (15-25 minutes)

### Phase 7: Access Control Testing
**Goal**: Test all access gates work correctly

13. **Test Password Access** (Incognito/Private Window)
    - Open incognito/private browser window
    - Paste password-protected share link
    - **Expected**: Access gate screen with:
      - Project name: "Q4 Board Presentation"
      - Project description
      - Password input field

14. **Test Incorrect Password**
    - Enter wrong password: "wrongpass"
    - Click "Access Documents"
    - **Expected**: Error message "Access denied"

15. **Test Correct Password**
    - Enter correct password: "boardmeeting2024"
    - Click "Access Documents"
    - **Expected**:
      - Access granted
      - Chat interface loads
      - Welcome or empty state

---

### Phase 8: Conversational Experience
**Goal**: Test chat functionality and document references

16. **Basic Chat Interaction**
    - Type: "Hello, what is this project about?"
    - **Expected**:
      - Message appears immediately
      - AI responds with streaming text
      - Response references project description/documents

17. **Test Document References**
    - Type: "What are the main financial projections?"
    - **Expected**:
      - AI responds with information from uploaded documents
      - Response includes document references like [DOC:filename:section-id]
      - Document references are clickable links with icon

18. **Click Document Reference**
    - Click on a document reference link in AI response
    - **Expected**:
      - Document viewer panel opens on right side (50/50 split)
      - Document outline loads
      - Referenced section is highlighted/scrolled to
      - Close button (X) appears in top-right

19. **Document Viewer Navigation**
    - Click different sections in outline
    - **Expected**: Section highlights on click
    - Click "Download" button
    - **Expected**: Document downloads

20. **Close Document Viewer**
    - Click X button in document viewer
    - **Expected**: Viewer closes, chat expands to full width

---

### Phase 9: Multi-Turn Conversation
**Goal**: Test conversation flow and context retention

21. **Ask Follow-up Questions**
    - Continue conversation:
      - "What are the main risks mentioned?"
      - "How does this compare to Q3?"
      - "What's the timeline for implementation?"
    - **Expected**:
      - AI maintains context from previous messages
      - Responses reference conversation history
      - Document references continue to work

22. **Test Long Conversation**
    - Ask 5-10 questions in succession
    - **Expected**:
      - Chat scrolls smoothly
      - All messages preserved
      - Streaming works consistently
      - No performance degradation

---

### Phase 10: Email Access Testing
**Goal**: Test email gate workflow

23. **Test Email-Required Link**
    - Open new incognito window
    - Paste email-required share link
    - **Expected**: Email input form with optional name field

24. **Submit Email Access**
    - Enter email: "viewer@example.com"
    - Enter name: "Jane Viewer" (optional)
    - Click "Access Documents"
    - **Expected**:
      - Access granted immediately
      - Email and name captured in analytics
      - Chat interface loads

---

## Test Workflow 3: Analytics Verification (5 minutes)

### Phase 11: Creator Analytics Review
**Goal**: Verify all viewer interactions are tracked

25. **Return to Creator Dashboard**
    - Go back to creator account (main browser)
    - Navigate to project
    - Click "Analytics" tab
    - **Expected**:
      - Total Views: 2 (password + email access)
      - Active Conversations: 2
      - List of conversations with:
        - Viewer email (if provided)
        - Viewer name (if provided)
        - Message count
        - Time spent
        - Last active timestamp

26. **View Conversation Details**
    - Click on a conversation in the list
    - **Expected**:
      - Full conversation transcript
      - AI-generated summary
      - Key topics extracted
      - Sentiment analysis
      - Action items (if any)

27. **Check Share Link Stats**
    - Go back to "Share" tab
    - **Expected**:
      - Each link shows updated view count
      - Password link: 1 view
      - Email link: 1 view

---

## Edge Cases & Error Testing

### Error Scenarios to Test

28. **Upload Invalid File**
    - Try uploading: .exe, .zip, .txt
    - **Expected**: Error message "Unsupported file type"

29. **Upload Very Large File**
    - Try uploading >10MB file
    - **Expected**: Progress indicator, or size limit error if configured

30. **Expired Share Link** (if expiration implemented)
    - Set expiration date in past
    - Try to access
    - **Expected**: "This link has expired" message

31. **Network Interruption During Upload**
    - Start upload, pause Wi-Fi
    - **Expected**: Error handling, retry option

32. **Chat During Streaming Interruption**
    - Send message, kill backend server
    - **Expected**: Error message, graceful degradation

---

## Known Phase 1 Limitations

These are **expected** and will be addressed in Phase 2+:

1. **Document Viewer**: Currently shows outline only, not full PDF rendering
   - Click "Download" to view full document
   - Phase 2 will add PDF.js integration for in-browser viewing

2. **Context Layers**: Not visible to creator
   - Generated automatically from interview
   - Phase 2 will add inspection/debugging UI

3. **Conversation Export**: Not yet implemented
   - Phase 2 will add PDF/CSV export

4. **Email Whitelist**: Create form doesn't show whitelist field yet
   - Backend supports it
   - Phase 2 will add UI

5. **Agent Model Selection**: Fixed to OpenAI GPT-4
   - Phase 2 will add model selector (Anthropic, etc.)

6. **Mobile Responsive**: Basic layout only
   - Phase 4 will optimize for mobile/tablet

---

## Success Criteria for Phase 1 MVP

### Creator Workflow ✓
- [ ] Register account and login
- [ ] Create project with name/description
- [ ] Upload documents (PDF, DOCX, XLSX)
- [ ] Documents process and generate summaries
- [ ] Complete 5-question AI agent interview
- [ ] Create share links (all 3 types)
- [ ] Copy share links to clipboard
- [ ] View analytics dashboard

### Viewer Workflow ✓
- [ ] Access password-protected link
- [ ] Access email-required link
- [ ] Start conversation with AI
- [ ] Receive streaming responses
- [ ] Click document references to open viewer
- [ ] Navigate document outline
- [ ] Download documents
- [ ] Continue multi-turn conversation

### System Integration ✓
- [ ] All API endpoints functional
- [ ] Database stores all entities correctly
- [ ] Context layers compose properly
- [ ] Document processing completes
- [ ] Analytics tracking works
- [ ] Access control enforced

### Key Performance Indicators
- **Creator First Project**: Should complete in <45 minutes
- **Viewer Engagement**: Should ask >5 questions
- **System Responsiveness**: Chat responses stream in <2 seconds
- **Document Processing**: Completes in <60 seconds per document

---

## Troubleshooting

### Common Issues

**Problem**: "Failed to load project"
- **Solution**: Check backend is running on port 4000
- Run: `cd backend && npm run dev`

**Problem**: "Database connection failed"
- **Solution**: Check Supabase credentials in .env
- Verify pooler connection strings

**Problem**: Frontend not loading
- **Solution**: Check frontend port (3033 or 3034)
- Run: `cd frontend && npm run dev -- --port 3033`

**Problem**: Document processing stuck
- **Solution**: Check backend logs for errors
- Verify OpenAI API key in backend .env

**Problem**: Share link 404
- **Solution**: Verify slug in database
- Check SharePage route in App.tsx

### Debug Commands

```bash
# Check backend health
curl http://localhost:4000/health

# Check database connection
cd backend && npx prisma db push

# Restart services
# Kill all node processes, then restart both servers

# Check logs
# Backend logs appear in terminal where you ran `npm run dev`

# TypeScript errors
cd frontend && npx tsc --noEmit

# Lint errors
cd frontend && npm run lint
```

---

## Next Steps After Testing

1. **Document Issues**: Note any bugs or unexpected behavior
2. **Performance**: Record response times for chat and uploads
3. **UX Feedback**: Identify confusing flows or missing features
4. **Phase 2 Prep**: Prioritize which features to build next

---

## Testing Completed On
- Date: _______________
- Tester: ______________
- Result: ☐ PASS  ☐ FAIL (with notes)
- Issues Found: ____________________

---

**Phase 1 MVP Status**: ✅ **IMPLEMENTATION COMPLETE - READY FOR TESTING**
