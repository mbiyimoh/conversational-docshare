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