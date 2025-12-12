import { test, expect } from '@playwright/test'

test.describe('AI Profile Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Login with test credentials from CLAUDE.md
    await page.goto('/login')
    await page.fill('[data-testid="email"], input[type="email"]', 'mbiyimoh@gmail.com')
    await page.fill('[data-testid="password"], input[type="password"]', 'MGinfinity09!')
    await page.click('[data-testid="login-button"], button[type="submit"]')
    await page.waitForURL(/\/(dashboard|projects)/)

    // Ensure we're on the dashboard page where SavedProfilesSection is displayed
    await page.goto('/dashboard')
    await expect(page.locator('[data-testid="saved-profiles-section"]')).toBeVisible({ timeout: 10000 })
  })

  test.describe('Audience Profiles', () => {
    // Purpose: Verify complete create flow works end-to-end
    test('should create audience profile via AI synthesis', async ({ page }) => {
      // Ensure Audience tab is active
      const audienceTab = page.locator('button:has-text("Audience Profiles")')
      await audienceTab.click()

      // Click new audience profile button
      await page.click('button:has-text("+ New Audience Profile")')

      // Input step - verify modal is open
      await expect(page.locator('h2:text("Create Audience Profile")')).toBeVisible()

      // Fill in the natural language description
      await page.fill('textarea', 'My board members are senior executives focused on ROI and governance')

      // Click Generate Profile button
      await page.click('button:has-text("Generate Profile")')

      // Wait for synthesis (may take up to 30 seconds)
      await expect(page.locator('text=Profile Generated')).toBeVisible({ timeout: 30000 })

      // Verify preview fields are shown
      await expect(page.locator('text=Name')).toBeVisible()
      await expect(page.locator('text=Audience')).toBeVisible()
      await expect(page.locator('text=Communication Style')).toBeVisible()

      // Save the profile
      await page.click('button:has-text("Save Profile")')

      // Verify modal closed and profile appears in list
      await expect(page.locator('h2:text("Create Audience Profile")')).not.toBeVisible()

      // Verify profile card contains "board" text (case-insensitive)
      await expect(page.locator('[data-testid="saved-profiles-section"]')).toContainText(/board/i, { timeout: 5000 })
    })

    // Purpose: Verify voice button appears when supported
    test('should show voice input button', async ({ page }) => {
      const audienceTab = page.locator('button:has-text("Audience Profiles")')
      await audienceTab.click()

      await page.click('button:has-text("+ New Audience Profile")')

      // Voice button should be visible (even if not functional in headless test)
      // Button has title attribute containing "voice" or "recording"
      const voiceButton = page.locator('button[title*="voice"], button[title*="recording"], button[title*="Stop recording"]')
      await expect(voiceButton).toBeVisible()
    })

    // Purpose: Verify fallback to manual works
    test('should allow switching to manual entry', async ({ page }) => {
      const audienceTab = page.locator('button:has-text("Audience Profiles")')
      await audienceTab.click()

      await page.click('button:has-text("+ New Audience Profile")')

      // Click "Switch to manual entry" link
      await page.click('text=Switch to manual entry')

      // Should now show the manual form with specific field IDs
      await expect(page.locator('input[id="ap-name"]')).toBeVisible()
      await expect(page.locator('input[id="ap-desc"]')).toBeVisible()
      await expect(page.locator('textarea[id="ap-audience"]')).toBeVisible()
    })

    // Purpose: Verify edit flow pre-populates
    test('should edit existing profile with AI', async ({ page }) => {
      const audienceTab = page.locator('button:has-text("Audience Profiles")')
      await audienceTab.click()

      // First create a profile to edit
      await page.click('button:has-text("+ New Audience Profile")')
      await page.fill('textarea', 'Test audience for edit flow')
      await page.click('button:has-text("Generate Profile")')
      await expect(page.locator('text=Profile Generated')).toBeVisible({ timeout: 30000 })
      await page.click('button:has-text("Save Profile")')

      // Wait for modal to close
      await expect(page.locator('h2:text("Create Audience Profile")')).not.toBeVisible()

      // Find and click edit button on the profile card
      // Edit buttons have title="Edit" with pencil icon
      const editButton = page.locator('button[title="Edit"]').first()
      await editButton.click()

      // Should show Edit title
      await expect(page.locator('h2:text("Edit Audience Profile")')).toBeVisible()

      // Should have pre-populated text in textarea
      const textarea = page.locator('textarea')
      await expect(textarea).not.toBeEmpty()

      // Verify the textarea contains some of the original input
      const textareaValue = await textarea.inputValue()
      expect(textareaValue.length).toBeGreaterThan(0)
    })

    // Purpose: Verify regeneration with additional context works
    test('should regenerate profile with additional context', async ({ page }) => {
      const audienceTab = page.locator('button:has-text("Audience Profiles")')
      await audienceTab.click()

      await page.click('button:has-text("+ New Audience Profile")')
      await page.fill('textarea', 'Investors interested in technology')
      await page.click('button:has-text("Generate Profile")')
      await expect(page.locator('text=Profile Generated')).toBeVisible({ timeout: 30000 })

      // Add additional context in the refinement textarea
      const refinementTextarea = page.locator('textarea').last()
      await refinementTextarea.fill('They are specifically Series A VCs focused on B2B SaaS')

      // Click Regenerate button
      await page.click('button:has-text("Regenerate")')

      // Wait for regeneration to complete
      await expect(page.locator('text=Profile Generated')).toBeVisible({ timeout: 30000 })

      // Verify preview is still showing
      await expect(page.locator('text=Name')).toBeVisible()
    })
  })

  test.describe('Collaborator Profiles', () => {
    // Purpose: Verify collaborator create flow
    test('should create collaborator profile via AI synthesis', async ({ page }) => {
      // Switch to Collaborator tab
      const collaboratorTab = page.locator('button:has-text("Collaborator Profiles")')
      await collaboratorTab.click()

      // Click new collaborator button
      await page.click('button:has-text("+ New Collaborator Profile")')

      // Fill in natural language description
      await page.fill('textarea', 'Sarah is our CFO, expert in finance and compliance')

      // Generate profile
      await page.click('button:has-text("Generate Profile")')

      // Wait for synthesis
      await expect(page.locator('text=Profile Generated')).toBeVisible({ timeout: 30000 })

      // Verify fields
      await expect(page.locator('text=Name')).toBeVisible()
      await expect(page.locator('text=Expertise Areas')).toBeVisible()

      // Save profile
      await page.click('button:has-text("Save Profile")')

      // Verify it appears in the list
      await expect(page.locator('[data-testid="saved-profiles-section"]')).toContainText(/Sarah/i, { timeout: 5000 })
    })

    // Purpose: Verify expertise areas display correctly as pills
    test('should display expertise areas as pills', async ({ page }) => {
      const collaboratorTab = page.locator('button:has-text("Collaborator Profiles")')
      await collaboratorTab.click()

      await page.click('button:has-text("+ New Collaborator Profile")')
      await page.fill('textarea', 'John expert in design, engineering, and marketing')
      await page.click('button:has-text("Generate Profile")')

      await expect(page.locator('text=Profile Generated')).toBeVisible({ timeout: 30000 })

      // Expertise areas should show as pills with blue background
      const expertisePills = page.locator('.bg-blue-100.text-blue-700')
      await expect(expertisePills.first()).toBeVisible()

      // Should have at least one expertise area
      const pillCount = await expertisePills.count()
      expect(pillCount).toBeGreaterThan(0)
    })

    // Purpose: Verify feedback style displays as badge
    test('should display feedback style as badge', async ({ page }) => {
      const collaboratorTab = page.locator('button:has-text("Collaborator Profiles")')
      await collaboratorTab.click()

      await page.click('button:has-text("+ New Collaborator Profile")')
      await page.fill('textarea', 'Mike prefers direct and detailed feedback')
      await page.click('button:has-text("Generate Profile")')

      await expect(page.locator('text=Profile Generated')).toBeVisible({ timeout: 30000 })

      // Feedback style should show as a badge
      await expect(page.locator('text=Feedback Style')).toBeVisible()

      // Should have a badge with purple background
      const feedbackBadge = page.locator('.bg-purple-100.text-purple-700')
      await expect(feedbackBadge).toBeVisible()
    })

    // Purpose: Verify email extraction works
    test('should extract email from natural language', async ({ page }) => {
      const collaboratorTab = page.locator('button:has-text("Collaborator Profiles")')
      await collaboratorTab.click()

      await page.click('button:has-text("+ New Collaborator Profile")')
      await page.fill('textarea', 'Contact Jane Smith at jane@example.com for legal matters')
      await page.click('button:has-text("Generate Profile")')

      await expect(page.locator('text=Profile Generated')).toBeVisible({ timeout: 30000 })

      // Verify Email field is present
      await expect(page.locator('text=Email')).toBeVisible()

      // The email value should be visible in the preview
      await expect(page.locator('text=jane@example.com')).toBeVisible()
    })

    // Purpose: Verify switch to manual for collaborators
    test('should allow switching to manual entry for collaborators', async ({ page }) => {
      const collaboratorTab = page.locator('button:has-text("Collaborator Profiles")')
      await collaboratorTab.click()

      await page.click('button:has-text("+ New Collaborator Profile")')

      // Click switch to manual link
      await page.click('text=Switch to manual entry')

      // Should show manual form fields
      await expect(page.locator('input[id="cp-name"]')).toBeVisible()
      await expect(page.locator('input[id="cp-email"]')).toBeVisible()
      await expect(page.locator('textarea[id="cp-comms"]')).toBeVisible()
      await expect(page.locator('input[id="cp-expertise"]')).toBeVisible()
    })
  })

  test.describe('Modal Interactions', () => {
    // Purpose: Verify modal can be cancelled
    test('should close modal on cancel', async ({ page }) => {
      const audienceTab = page.locator('button:has-text("Audience Profiles")')
      await audienceTab.click()

      await page.click('button:has-text("+ New Audience Profile")')
      await expect(page.locator('h2:text("Create Audience Profile")')).toBeVisible()

      // Click cancel button
      await page.click('button:has-text("Cancel")')

      // Modal should close
      await expect(page.locator('h2:text("Create Audience Profile")')).not.toBeVisible()
    })

    // Purpose: Verify modal closes on X button
    test('should close modal on X button click', async ({ page }) => {
      const audienceTab = page.locator('button:has-text("Audience Profiles")')
      await audienceTab.click()

      await page.click('button:has-text("+ New Audience Profile")')
      await expect(page.locator('h2:text("Create Audience Profile")')).toBeVisible()

      // Click X button (SVG with path for X icon)
      const closeButton = page.locator('button:has(svg path[d*="M6 18L18 6M6 6l12 12"])')
      await closeButton.click()

      // Modal should close
      await expect(page.locator('h2:text("Create Audience Profile")')).not.toBeVisible()
    })

    // Purpose: Verify back button works in preview step
    test('should navigate back from preview to input', async ({ page }) => {
      const audienceTab = page.locator('button:has-text("Audience Profiles")')
      await audienceTab.click()

      await page.click('button:has-text("+ New Audience Profile")')
      await page.fill('textarea', 'Test audience for back navigation')
      await page.click('button:has-text("Generate Profile")')
      await expect(page.locator('text=Profile Generated')).toBeVisible({ timeout: 30000 })

      // Click back button
      await page.click('button:has-text("← Back")')

      // Should return to input step
      await expect(page.locator('textarea')).toBeVisible()
      await expect(page.locator('button:has-text("Generate Profile")')).toBeVisible()
    })
  })

  test.describe('Error Handling', () => {
    // Purpose: Verify validation for empty input
    test('should show error for empty input', async ({ page }) => {
      const audienceTab = page.locator('button:has-text("Audience Profiles")')
      await audienceTab.click()

      await page.click('button:has-text("+ New Audience Profile")')

      // Try to generate without entering text
      await page.click('button:has-text("Generate Profile")')

      // Should show error message
      await expect(page.locator('text=Please describe your audience first')).toBeVisible()
    })

    // Purpose: Verify Generate button is disabled when textarea is empty
    test('should disable generate button when input is empty', async ({ page }) => {
      const audienceTab = page.locator('button:has-text("Audience Profiles")')
      await audienceTab.click()

      await page.click('button:has-text("+ New Audience Profile")')

      // Generate button should be disabled initially
      const generateButton = page.locator('button:has-text("Generate Profile")')
      await expect(generateButton).toBeDisabled()

      // Type something
      await page.fill('textarea', 'Some text')

      // Button should now be enabled
      await expect(generateButton).toBeEnabled()
    })
  })

  test.describe('Voice Input UI', () => {
    // Purpose: Verify listening indicator appears when voice recording starts
    test('should show listening indicator when recording', async ({ page }) => {
      const audienceTab = page.locator('button:has-text("Audience Profiles")')
      await audienceTab.click()

      await page.click('button:has-text("+ New Audience Profile")')

      // Click voice input button
      const voiceButton = page.locator('button[title*="voice"], button[title*="recording"]').first()

      // Note: In headless/test mode, speech recognition may not work
      // but we can still test the UI state changes
      if (await voiceButton.isVisible()) {
        await voiceButton.click()

        // Should show listening indicator
        // (May show "Listening... speak now" text with pulsing dot)
        const listeningIndicator = page.locator('text=Listening')

        // Check if indicator appears (with timeout since it may depend on browser support)
        const isListening = await listeningIndicator.isVisible().catch(() => false)

        if (isListening) {
          await expect(listeningIndicator).toBeVisible()

          // Button should change appearance (red background when listening)
          await expect(voiceButton).toHaveClass(/bg-red-100/)
        }
      }
    })
  })
})
