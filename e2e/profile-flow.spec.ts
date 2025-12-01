import { test, expect } from '@playwright/test'

test.describe('AI Agent Profile Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login with test credentials from CLAUDE.md
    await page.goto('/login')
    await page.fill('[data-testid="email"], input[type="email"]', 'mbiyimoh@gmail.com')
    await page.fill('[data-testid="password"], input[type="password"]', 'MGinfinity09!')
    await page.click('[data-testid="login-button"], button[type="submit"]')
    await page.waitForURL(/\/(dashboard|projects)/)
  })

  test('should display profile after completing interview', async ({ page }) => {
    // Navigate to a project
    await page.click('[data-testid="project-card"]:first-child, .project-card:first-child')

    // Go to AI Agent tab
    await page.click('[data-testid="tab-agent"], [role="tab"]:has-text("Agent"), button:has-text("AI Agent")')

    // Complete interview if not already done
    const continueToProfileBtn = page.locator('text=Continue to Profile')
    if (await continueToProfileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueToProfileBtn.click()
    }

    // Verify profile sections are displayed
    await expect(page.locator('text=Identity & Role')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=Communication Style')).toBeVisible()
    await expect(page.locator('text=Content Priorities')).toBeVisible()
    await expect(page.locator('text=Engagement Approach')).toBeVisible()
    await expect(page.locator('text=Key Framings')).toBeVisible()
  })

  test('should allow editing profile sections', async ({ page }) => {
    // Navigate to project and profile
    await page.click('[data-testid="project-card"]:first-child, .project-card:first-child')
    await page.click('[data-testid="tab-agent"], [role="tab"]:has-text("Agent"), button:has-text("AI Agent")')

    // Wait for profile to load
    await expect(page.locator('text=Identity & Role')).toBeVisible({ timeout: 15000 })

    // Click edit on first section
    const editButtons = page.locator('button:has-text("Edit")')
    await editButtons.first().click()

    // Verify textarea appears and edit content
    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible()

    await textarea.fill('Updated identity content for E2E test')
    await page.click('button:has-text("Save")')

    // Verify save notification
    await expect(page.locator('text=Section saved, text=saved')).toBeVisible({ timeout: 5000 })

    // Verify "Manually edited" badge appears
    await expect(page.locator('text=Manually edited')).toBeVisible()
  })

  test('should regenerate profile from interview', async ({ page }) => {
    // Navigate to project and profile
    await page.click('[data-testid="project-card"]:first-child, .project-card:first-child')
    await page.click('[data-testid="tab-agent"], [role="tab"]:has-text("Agent"), button:has-text("AI Agent")')

    // Wait for profile to load
    await expect(page.locator('text=Identity & Role')).toBeVisible({ timeout: 15000 })

    // Click regenerate button
    await page.click('text=Regenerate profile from interview')

    // Wait for regeneration (includes LLM call)
    await expect(page.locator('text=Profile generated successfully, text=generated')).toBeVisible({
      timeout: 20000,
    })
  })

  test('should navigate to Testing Dojo on continue', async ({ page }) => {
    // Navigate to project and profile
    await page.click('[data-testid="project-card"]:first-child, .project-card:first-child')
    await page.click('[data-testid="tab-agent"], [role="tab"]:has-text("Agent"), button:has-text("AI Agent")')

    // Wait for profile to load
    await expect(page.locator('text=Identity & Role')).toBeVisible({ timeout: 15000 })

    // Click continue to testing
    await page.click('button:has-text("Continue to Testing")')

    // Verify test tab is now active or testing interface is shown
    await expect(
      page.locator('[data-testid="tab-test"][aria-selected="true"], text=Testing Dojo, text=Test')
    ).toBeVisible({ timeout: 5000 })
  })

  test('should navigate back to interview from profile', async ({ page }) => {
    // Navigate to project and profile
    await page.click('[data-testid="project-card"]:first-child, .project-card:first-child')
    await page.click('[data-testid="tab-agent"], [role="tab"]:has-text("Agent"), button:has-text("AI Agent")')

    // Wait for profile to load
    await expect(page.locator('text=Identity & Role')).toBeVisible({ timeout: 15000 })

    // Click edit interview button
    await page.click('button:has-text("Edit Interview")')

    // Verify interview questions are shown
    await expect(page.locator('text=Who is your primary audience')).toBeVisible({ timeout: 5000 })
  })
})
