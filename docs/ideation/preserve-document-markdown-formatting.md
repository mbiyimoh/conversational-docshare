# Preserve Document Markdown Formatting

**Slug:** preserve-document-markdown-formatting
**Author:** Claude Code
**Date:** 2025-12-19
**Branch:** preflight/preserve-document-markdown-formatting
**Related:** improve-text-readability-chat-document-viewer (completed)
**Status:** IDEATION

---

## 1) Intent & Assumptions

**Task brief:** Improve document viewer visual hierarchy by preserving markdown formatting during document extraction (PDF/DOCX) and using AI to enhance structure. Currently, the document processor extracts raw text, losing bulleted lists, headers, and other formatting. The frontend already renders markdown properly via ReactMarkdown - the problem is the backend extraction pipeline losing formatting.

**Assumptions:**
- The frontend DocumentContentViewer already has proper markdown rendering (ReactMarkdown + remarkGfm)
- The issue is in `documentProcessor.ts` which extracts "raw text" from PDFs and DOCX
- Both extraction improvements AND AI enhancement should be implemented
- Changes should be backward-compatible (existing documents can be re-processed)
- Cost for AI enhancement should be reasonable (<$0.01/document for most cases)

**Out of scope:**
- Changing DocumentContentViewer.tsx component (already handles markdown well)
- Modifying the chat interface rendering
- Adding support for new document types beyond PDF/DOCX/Markdown
- Implementing OCR for scanned PDFs (future enhancement)
- Complex table reconstruction (simplified tables only)

---

## 2) Pre-reading Log

- `backend/src/services/documentProcessor.ts`: Core extraction - uses `pdftotext -layout` for PDFs and `mammoth.extractRawText()` for DOCX. Both extract plain text, losing all formatting.
- `backend/src/services/documentChunker.ts`: Splits extracted text into 1000-char chunks with 200-char overlap. Format-agnostic - works with any text.
- `frontend/src/components/DocumentContentViewer.tsx`: Uses ReactMarkdown with remarkGfm - already properly renders markdown if content was markdown. Has extensive CSS styling for headings, lists, tables, etc.
- `frontend/src/lib/markdownConfig.tsx`: Shared markdown components with proper typography - headings, lists, blockquotes all styled correctly.
- `docs/ideation/improve-text-readability-chat-document-viewer.md`: Recent work improved typography, but notes document viewer shows "plain paragraphs" for what should be bulleted lists.

---

## 3) Codebase Map

**Primary components/modules:**
- `backend/src/services/documentProcessor.ts` - PDF, DOCX, XLSX, Markdown extraction
- `backend/src/services/documentChunker.ts` - Text chunking for embeddings
- `backend/src/services/processingQueue.ts` - Document processing orchestration
- `frontend/src/components/DocumentContentViewer.tsx` - Document display (already markdown-ready)

**Shared dependencies:**
- `mammoth` (npm) - DOCX processing
- `pdf-parse` (npm fallback) - PDF text extraction
- `pdftotext` (system) - Primary PDF extraction tool
- `xlsx` (npm) - Spreadsheet processing

**Data flow:**
```
Document Upload
      ↓
processDocument() [documentProcessor.ts]
      ↓
extractRawText (loses formatting!)
      ↓
chunkDocumentBySection() [documentChunker.ts]
      ↓
Store chunks in database
      ↓
Frontend fetches chunks → ReactMarkdown (renders plain text as-is)
```

**Feature flags/config:** None currently

**Potential blast radius:**
- All document chunks stored in database
- AI chat context (uses chunk content for RAG)
- Document outline generation
- Search/embedding functionality

---

## 4) Root Cause Analysis

**Reproduction steps:**
1. Upload a DOCX or PDF with bulleted lists
2. View in DocumentContentViewer
3. Observe: bullets render as plain text paragraphs

**Observed vs Expected:**
- **Observed:** "• Item one" or "- Item one" appears as plain text in a paragraph
- **Expected:** Proper `<ul><li>Item one</li></ul>` rendering with styled bullets

**Evidence:**

```typescript
// documentProcessor.ts:148 - The culprit!
const result = await mammoth.extractRawText({ buffer })
const text = result.value  // Plain text, no formatting preserved
```

```typescript
// documentProcessor.ts:82 - PDF extraction
const text = execSync(`pdftotext -layout "${filePath}" -`, {...})
// pdftotext -layout preserves visual layout but not semantic structure
```

**Root-cause hypotheses:**
1. **DOCX:** Using `mammoth.extractRawText()` instead of `mammoth.convertToHtml()` (HIGH confidence - direct cause)
2. **PDF:** pdftotext extracts visual layout, not semantic markdown (HIGH confidence)
3. **No post-processing:** Extracted text is stored as-is with no structure enhancement (MEDIUM confidence)

**Decision:** The root cause is using raw text extraction methods when structure-preserving alternatives exist. For DOCX, switch to HTML→Markdown pipeline. For PDF, add AI-based structure enhancement.

---

## 5) Research Findings

### Potential Solutions

#### **Option A: Mammoth HTML → Turndown Pipeline (DOCX only)**

**Approach:** Replace `mammoth.extractRawText()` with `mammoth.convertToHtml()` then convert HTML to Markdown using Turndown.

**Pros:**
- $0 cost per document
- 100-200ms latency
- 90-95% accuracy for DOCX
- Battle-tested libraries (Mammoth + Turndown both actively maintained)
- Preserves headings, lists, bold/italic, links

**Cons:**
- Only works for DOCX, not PDF
- Table formatting may have some issues
- Doesn't add structure that wasn't in the original

**Implementation:**
```typescript
import mammoth from 'mammoth'
import TurndownService from 'turndown'

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced'
})

async function processDOCX(filePath: string): Promise<ProcessedDocument> {
  const buffer = await fs.readFile(filePath)
  const htmlResult = await mammoth.convertToHtml({ buffer })
  const markdown = turndown.turndown(htmlResult.value)
  // ... rest of processing
}
```

---

#### **Option B: AI-Enhanced Structure Detection (PDF + DOCX fallback)**

**Approach:** Use GPT-4o-mini to add markdown structure to plain text extractions.

**Pros:**
- Works for any document type (PDF, DOCX, plain text)
- Can infer structure that wasn't explicitly formatted
- 95-97% accuracy with good prompts
- Cost-effective ($0.001-0.002 per document)

**Cons:**
- Adds latency (1-3 seconds)
- Requires API calls and cost management
- Can hallucinate structure that doesn't exist
- Needs quality validation

**Implementation:**
```typescript
async function enhanceWithAI(plainText: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: `Convert plain text to well-structured Markdown:
- Detect and format headings with # hierarchy
- Identify lists and format with - or 1.
- Detect tables and format with pipe syntax
- Add **bold** and *italic* where appropriate
- Preserve original meaning exactly
Return ONLY the formatted markdown, no explanations.`
    }, {
      role: 'user',
      content: plainText
    }],
    temperature: 0.1,
    max_tokens: plainText.length * 2
  })
  return response.choices[0].message.content
}
```

---

#### **Option C: PDF Layout-Aware Extraction (unpdf/pdf2json)**

**Approach:** Replace pdftotext with layout-aware JavaScript libraries that preserve positional data.

**Pros:**
- Better structure detection from visual layout
- $0 cost per document
- Modern TypeScript-first libraries
- Can detect tables from positioning

**Cons:**
- Requires custom logic to assemble markdown from positions
- More complex implementation
- Still may miss semantic structure

**Implementation:**
```typescript
import { extractText } from 'unpdf'

async function processPDF(filePath: string): Promise<ProcessedDocument> {
  const buffer = await fs.readFile(filePath)
  const { text, metadata } = await extractText(buffer)
  // Custom assembly logic to detect structure from layout
}
```

---

#### **Option D: Hybrid Approach (Recommended)**

**Approach:** Combine Options A, B, and C based on document type and complexity.

**Processing Flow:**
1. **DOCX:** Always use Mammoth → Turndown ($0, fast, high accuracy)
2. **PDF Simple:** Use unpdf, check quality metrics
3. **PDF Complex/Poor Quality:** Enhance with GPT-4o-mini
4. **Quality Gate:** Validate markdown structure before storing

**Pros:**
- Best accuracy across all document types
- Cost-optimized (free for most documents)
- Handles edge cases with AI fallback
- Measurable quality metrics

**Cons:**
- More complex implementation
- Requires quality detection logic
- Multiple code paths to maintain

---

### Recommendation

**Implement Option D: Hybrid Approach**

**Phase 1 (Immediate Win):**
- DOCX: Switch to Mammoth → Turndown pipeline
- Impact: All DOCX documents will have proper formatting
- Effort: 2-3 hours
- Cost: $0

**Phase 2 (PDF Enhancement):**
- Add unpdf for better PDF extraction
- Implement quality metrics (heading detection, list detection)
- Effort: 4-6 hours
- Cost: $0

**Phase 3 (AI Fallback):**
- Add GPT-4o-mini enhancement for poor-quality extractions
- Implement cost tracking and budget limits
- Effort: 4-6 hours
- Cost: ~$0.001-0.002 per enhanced document

---

## 6) Clarification Needed

1. **Re-processing existing documents:** Should we add a "re-process" button or automatically re-process all existing documents with the new pipeline?
>> automatically reprocess them all (since we shouldnt need to ever manually do it again in the future, I dont want to create a button for it)

2. **AI enhancement opt-in:** Should AI enhancement be:
   - Always on (automatic for poor quality)
   - User-triggered (button to "enhance formatting")
   - Admin setting (project-level toggle)
>> always on

3. **Cost management:** For AI enhancement:
   - Should there be a per-project budget limit?
   - Should we track and display AI enhancement costs to users?
   - Is $0.01/document acceptable for complex PDFs?
>> yes $0.01 is fine but for now lets just implement everything we can implement for free, even if that means we can't enrich / better format PDFs that are uploaded for now

4. **Quality threshold:** What quality metrics should trigger AI enhancement?
   - No headings detected in 10+ page document?
   - Markdown syntax < 2% of total characters?
   - User-reported poor formatting?
>> both bullets 1 and 2 seem resonable. maybe theres also just a button the user sees saying "smart enahnce the formatting" or something even for documents that don't trigger one of those metrics

5. **Table handling:** How important is table formatting?
   - Simple tables (basic pipe syntax)?
   - Complex tables (merged cells, nested)?
   - Skip tables and focus on lists/headings?
>> skip tables for now to focus on lists/headings and indentation in outline-style information with lists and sub-lists

6. **Processing mode:** Should enhancement happen:
   - At upload time (sync, user waits)?
   - In background (async, user notified)?
   - On-demand when viewing document?
>> at upload time but if it takes a while, also in the background (ie. initial upload is all thats need to proceed to the next step, so if the enrichment is truly a long process that can be running in the backgroudn as you configure your agent and it should be done way before anybody ever interacts with the documents from the viewer perspective, which seems to be where this format / structure enrichment will actually get manifested)

---

## 7) Proposed Implementation Plan

### Phase 1: DOCX Pipeline (1-2 days)

**Changes:**
- Install `turndown` package
- Modify `processDOCX()` to use `convertToHtml()` → `turndown()`
- Add markdown cleanup (remove excessive whitespace)
- Update tests

**Files:**
- `backend/src/services/documentProcessor.ts`
- `backend/package.json`

### Phase 2: PDF Enhancement (2-3 days)

**Changes:**
- Install `unpdf` package
- Create new `extractPDFWithLayout()` function
- Add quality metrics calculation
- Implement structure assembly from layout data

**Files:**
- `backend/src/services/documentProcessor.ts`
- `backend/src/services/documentQuality.ts` (new)
- `backend/package.json`

### Phase 3: AI Fallback (2-3 days)

**Changes:**
- Create `documentEnhancer.ts` service
- Add GPT-4o-mini integration for structure enhancement
- Implement quality gates (when to trigger AI)
- Add cost tracking

**Files:**
- `backend/src/services/documentEnhancer.ts` (new)
- `backend/src/services/documentProcessor.ts`

### Phase 4: Re-processing (1 day)

**Changes:**
- Add API endpoint for document re-processing
- Add "Re-process" button in document management UI
- Implement batch re-processing option

**Files:**
- `backend/src/controllers/document.controller.ts`
- `frontend/src/components/DocumentUpload.tsx`

---

## 8) Success Metrics

- **DOCX formatting accuracy:** 90%+ documents render with proper headings/lists
- **PDF formatting accuracy:** 80%+ simple PDFs, 90%+ with AI enhancement
- **Performance:** <500ms for standard extraction, <5s with AI enhancement
- **Cost:** <$0.005 average per document (accounting for AI usage rate)
- **User satisfaction:** Reduced complaints about "unformatted" documents

---

## 9) Dependencies & Packages

**New packages to add:**
```json
{
  "turndown": "^7.2.0",     // HTML → Markdown conversion
  "unpdf": "^0.7.1"         // Modern PDF extraction (optional)
}
```

**Existing packages (already installed):**
- `mammoth` - DOCX processing
- `openai` - GPT-4o-mini for AI enhancement

---

## 10) Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Turndown produces poor markdown | Low | Medium | Add post-processing cleanup, test with diverse documents |
| AI enhancement adds incorrect structure | Medium | Low | Use low temperature (0.1), validate output structure |
| Increased processing time | Medium | Low | Process in background, show progress indicator |
| Cost overruns from AI | Low | Medium | Implement budget limits, track usage per project |
| Breaking existing documents | Medium | High | Keep original raw text, store enhanced version separately |
