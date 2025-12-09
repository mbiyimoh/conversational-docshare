  1. Citation display: Show full [DOC:financial.pdf:section-3-2] or abbreviate to just
  "Financial Projections" with link icon?
>> full, section- or paragraph-level citation

  2. Multi-document behavior: When clicking citation to a different document:
    - A) Replace current doc in viewer (simpler)
    - B) Add tabs for multiple docs (more complex)
>> replace current doc in viewer

  3. Panel resizing: Is fixed 60/40 split acceptable, or do you want user-resizable
  panels?
>> user resizable (with width-adaptive display for both panels) ideally

  4. Filename vs ID mapping: The AI cites by filename (financial.pdf) but DB stores by
  document ID. Should we:
    - A) Build filename→ID lookup (what I'm assuming)
    - B) Change AI prompt to cite by ID (breaking change)
>> option A

  5. Re-highlight on re-click: If user scrolls away from highlighted section, should
  clicking the same citation again re-scroll and re-highlight?
>> yes

  6. Section ID verification: Need to confirm the backend's section ID generation
  matches what the AI will cite (e.g., section-3-2 format).
>> no idea

----------

1. **Profile Format & Editability**
   - Should the AI-generated profile be **read-only** (derived entirely from interview), or can creators **directly edit** the profile prose?
   - If editable: Should edits to the profile back-propagate to interview answers?
   - **Recommendation:** Read-only profile that regenerates when interview changes
   >> it should be derived from interview, and editable via a prompt / protocol (that exists under the hood) that thoughtfully applies / integrates the comments from a recent tsting dojo session into that profile. but yes, if the user also wants to manually edit different fields / sections, they can do that too

2. **Session Lifecycle**
   - When should a session "end"? Manual close, time-based auto-close, or keep open indefinitely?
   - Can creators delete sessions and their comments?
   - **Recommendation:** Sessions stay open until manually closed or new session started; deletion allowed
   >> when the user clicks an "end session" button that is somewjhere in the testing UI. if the user clicks / taps somewhere to navigate to a different tab / page, a modal should pop up asking if
  they want to keep the session live (come back to the same spot next time you return to testing mode) or end the session and apply the comments feedback to the ai's profile


3. **Comment Privacy**
   - Comments are creator-only (never shown to viewers), correct?
   - **Recommendation:** Confirm this is correct - test sessions are fully private
   >> correct

4. **Recommendation Application**
   - When recommendations suggest interview answer changes, should they:
     - (A) Pre-fill the interview form so creator can review and submit?
     - (B) Auto-apply changes with creator approval?
     - (C) Show diff/comparison of current vs suggested?
   - **Recommendation:** Option (A) with diff preview - safest UX
   >> follow your recommendation here

5. **Tab Navigation**
   - New "Test" tab between "AI Agent" and "Share"?
   - Or integrate Testing Dojo into the AI Agent tab with subtabs?
   - **Recommendation:** New top-level "Test" tab for clear separation
>> ollow your recommendation here

### Nice-to-Have Clarifications

6. **Multiple Comments per Response**
   - Can a creator leave multiple comments on the same AI response?
   - **Recommendation:** Yes, allows different types of feedback on one response
   >> follow your recommendation here

7. **Comment Templates/Suggestions**
   - Should we offer quick comment templates (e.g., "Too formal", "Missing context", "Incorrect emphasis")?
   - Or purely freeform as user described?
   - **Recommendation:** Start freeform, add templates in Phase 2 if patterns emerge
   >> yes, create a basic system of quick comment templates by thoughtfully considering the profile and what will be getting update by the feedback (ie. don't just think in general about what different types of feedback someone might give, consider the spe cific types of feedback that would help drive improvement of the core fields in the AI profile)

8. **Profile Regeneration**
   - When interview answers change, should profile auto-regenerate, or require manual trigger?
   - **Recommendation:** Auto-regenerate with "Profile updated" notification
   >> follow your recommendation here

9. **Session Comparison**
   - Should there be a way to compare two sessions side-by-side?
   - **Recommendation:** Phase 2 enhancement - start with single session view
   >> no. dont even put that in phase 2

10. **Real Documents in Testing**
    - Should Testing Dojo have access to uploaded documents for realistic testing?
    - Or use the full system context including document chunks?
    - **Recommendation:** Full system context - testing should mirror real recipient experience exactly
    >> follow your recommendation here for sure