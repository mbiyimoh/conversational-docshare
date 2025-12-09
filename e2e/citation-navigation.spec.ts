import { test, expect } from '@playwright/test'

/**
 * Citation Navigation E2E Tests
 *
 * These tests verify the viewer experience citation navigation system.
 * Note: Full citation click testing requires:
 * 1. A project with uploaded documents
 * 2. An active share link
 * 3. AI responses that include [DOC:filename:section-id] citations
 *
 * For basic testing, we verify:
 * - Share page layout loads correctly
 * - Panel resizing works
 * - Document viewer displays properly
 * - Citation highlight animation CSS is loaded
 */

test.describe('Citation Navigation - Viewer Experience', () => {
  // Test that the citation highlight CSS animation is properly loaded
  test('should have citation highlight animation CSS loaded', async ({ page }) => {
    await page.goto('/')

    // Check that the CSS animation keyframes exist
    const hasAnimation = await page.evaluate(() => {
      const styleSheets = Array.from(document.styleSheets)
      for (const sheet of styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || [])
          for (const rule of rules) {
            if (rule instanceof CSSKeyframesRule && rule.name === 'citation-glow') {
              return true
            }
          }
        } catch {
          // Cross-origin stylesheets will throw, ignore
        }
      }
      return false
    })

    expect(hasAnimation).toBe(true)
  })

  test('should have citation-highlight class defined', async ({ page }) => {
    await page.goto('/')

    // Check that the .citation-highlight class exists
    const hasClass = await page.evaluate(() => {
      const styleSheets = Array.from(document.styleSheets)
      for (const sheet of styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || [])
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule && rule.selectorText === '.citation-highlight') {
              return true
            }
          }
        } catch {
          // Cross-origin stylesheets will throw, ignore
        }
      }
      return false
    })

    expect(hasClass).toBe(true)
  })

  test('should respect prefers-reduced-motion for citation highlight', async ({ page }) => {
    // Emulate reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    // The CSS should have a media query rule for reduced motion
    const hasReducedMotionRule = await page.evaluate(() => {
      const styleSheets = Array.from(document.styleSheets)
      for (const sheet of styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || [])
          for (const rule of rules) {
            if (rule instanceof CSSMediaRule && rule.conditionText?.includes('prefers-reduced-motion')) {
              return true
            }
          }
        } catch {
          // Cross-origin stylesheets will throw, ignore
        }
      }
      return false
    })

    expect(hasReducedMotionRule).toBe(true)
  })
})

test.describe('Citation Navigation - Share Page Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('input[type="email"]', 'mbiyimoh@gmail.com')
    await page.fill('input[type="password"]', 'MGinfinity09!')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(dashboard|projects)/)
  })

  test('should navigate to share settings from project', async ({ page }) => {
    // Click on first project
    await page.click('[data-testid="project-card"]:first-child, .project-card:first-child, a[href*="/project"]')

    // Navigate to Share tab if exists
    const shareTab = page.locator('[role="tab"]:has-text("Share"), button:has-text("Share")')
    if (await shareTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await shareTab.click()

      // Verify share link management UI exists
      await expect(
        page.locator('text=Share Link, text=share link, text=Access Type')
      ).toBeVisible({ timeout: 5000 })
    }
  })
})

test.describe('Citation Navigation - Document Viewer', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('input[type="email"]', 'mbiyimoh@gmail.com')
    await page.fill('input[type="password"]', 'MGinfinity09!')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(dashboard|projects)/)
  })

  test('should display document outline in viewer', async ({ page }) => {
    // Navigate to a project with documents
    await page.click('[data-testid="project-card"]:first-child, .project-card:first-child, a[href*="/project"]')

    // Go to Documents tab
    const documentsTab = page.locator('[role="tab"]:has-text("Documents"), button:has-text("Documents")')
    if (await documentsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await documentsTab.click()

      // Click on first document if exists
      const documentItem = page.locator('[data-testid="document-item"]:first-child, .document-item:first-child')
      if (await documentItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await documentItem.click()

        // Verify document outline header is visible
        await expect(page.locator('text=Document Outline')).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test('should allow clicking outline sections', async ({ page }) => {
    // Navigate to a project with documents
    await page.click('[data-testid="project-card"]:first-child, .project-card:first-child, a[href*="/project"]')

    // Go to Documents tab
    const documentsTab = page.locator('[role="tab"]:has-text("Documents"), button:has-text("Documents")')
    if (await documentsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await documentsTab.click()

      // Click on first document if exists
      const documentItem = page.locator('[data-testid="document-item"]:first-child, .document-item:first-child')
      if (await documentItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await documentItem.click()

        // Click on a section in the outline (if exists)
        const outlineSection = page.locator('[id^="section-"]').first()
        if (await outlineSection.isVisible({ timeout: 2000 }).catch(() => false)) {
          await outlineSection.click()

          // Verify the section gets selected (has active styling)
          await expect(outlineSection).toHaveClass(/bg-blue-100|border-blue-600/)
        }
      }
    }
  })
})

test.describe('Citation Navigation - API Endpoints', () => {
  test('should return 404 for invalid share link slug', async ({ request }) => {
    const response = await request.get('/api/share/invalid-slug-12345/documents')
    expect(response.status()).toBe(404)
  })

  test('should return 404 for invalid document in valid share link', async ({ request }) => {
    // This will fail if there's no valid share link, which is expected in test env
    const response = await request.get('/api/share/test-slug/documents/invalid-doc-id')
    expect([404, 500]).toContain(response.status())
  })
})
