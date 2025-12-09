import { v4 as uuidv4 } from 'uuid'
import { getOpenAI } from '../utils/openai'
import { prisma } from '../utils/prisma'
import { NotFoundError, ConflictError } from '../utils/errors'
import type { AgentProfile } from './profileSynthesizer'
import type {
  ProfileSectionKey,
  ProfileRecommendation,
  RecommendationSet,
  AnalysisSummary,
  ProfileVersion,
  VersionHistoryResponse,
  ParsedLLMRecommendation,
  ParsedLLMResponse,
} from '../types/recommendation'

// Constants
const MAX_COMMENTS = 50  // Limit comments to prevent prompt overflow
const LLM_TIMEOUT_MS = 30000  // 30 second timeout
const VALID_SECTION_IDS: ProfileSectionKey[] = [
  'identityRole',
  'communicationStyle',
  'contentPriorities',
  'engagementApproach',
  'keyFramings',
]

/**
 * Profile-direct analysis prompt that targets profile sections instead of interview answers
 */
function buildProfileAnalysisPrompt(
  profile: AgentProfile,
  formattedComments: string,
  totalComments: number
): string {
  return `You analyze AI agent testing feedback and generate profile recommendations.

## Current Profile Sections

### Identity & Role
${profile.sections.identityRole.content}

### Communication Style
${profile.sections.communicationStyle.content}

### Content Priorities
${profile.sections.contentPriorities.content}

### Engagement Approach
${profile.sections.engagementApproach.content}

### Key Framings
${profile.sections.keyFramings.content}

## Testing Feedback Comments (${totalComments} total)

${formattedComments}

## Your Task

Analyze ALL the feedback comments holistically. Generate recommendations for profile sections.

CRITICAL RULES:
1. Generate AT MOST ONE recommendation per section
2. If multiple comments affect the same section, SYNTHESIZE them into ONE recommendation
3. Use ONLY these operation types:
   - ADD: Append new content to existing section (preserves all existing content)
   - REMOVE: Remove specific phrase ONLY if directly contradicted by feedback
   - MODIFY: Change specific phrase (use sparingly, prefer ADD)
4. NEVER suggest deleting content that is unrelated to the feedback
5. NEVER generate full section replacements
6. Always preserve existing rich content
7. Include 2-3 summary bullets for each recommendation

Return JSON:
{
  "analysisSummary": {
    "overview": "2-3 sentence analysis of all feedback",
    "feedbackThemes": ["theme1", "theme2"],
    "configAlignment": "good" | "needs_update" | "partial",
    "noChangeReason": "Required if no recommendations"
  },
  "recommendations": [
    {
      "type": "add",
      "targetSection": "communicationStyle",
      "addedContent": "NEW content to append (must be substantial, at least 1-2 sentences)",
      "summaryBullets": ["Bullet 1", "Bullet 2"],
      "rationale": "Why this change is needed based on specific comment feedback...",
      "relatedCommentIds": ["comment-123", "comment-456"]
    }
  ]
}

CRITICAL FIELD REQUIREMENTS:
- For "add" type: "addedContent" is REQUIRED and must contain NEW text to append
- For "remove" type: "removedContent" is REQUIRED and must be EXACT text that exists in the current section
- For "modify" type: "modifiedFrom" (EXACT existing text) and "modifiedTo" (replacement text) are BOTH REQUIRED

IMPORTANT: Each recommendation MUST result in an actual change to the profile. Do not suggest changes where the before and after would be identical. Reference the SPECIFIC feedback comments that informed each recommendation.

If no changes needed, return empty recommendations array with noChangeReason.`
}

/**
 * Compute the preview of what content will look like after the change
 */
function computePreviewAfter(
  currentContent: string,
  rec: ParsedLLMRecommendation
): string {
  switch (rec.type) {
    case 'add':
      return currentContent.trim() + '\n\n' + (rec.addedContent || '')
    case 'remove':
      return currentContent.replace(rec.removedContent || '', '').trim()
    case 'modify':
      return currentContent.replace(rec.modifiedFrom || '', rec.modifiedTo || '')
    default:
      return currentContent
  }
}

/**
 * Count unique sessions from comments
 */
function countUniqueSessions(
  comments: { message: { session: { id: string } } }[]
): number {
  const sessionIds = new Set(comments.map((c) => c.message.session.id))
  return sessionIds.size
}

/**
 * Generate profile-direct recommendations from testing comments
 */
export async function generateRecommendations(
  projectId: string
): Promise<RecommendationSet> {
  // 1. Fetch most recent comments (limited to prevent prompt overflow)
  const comments = await prisma.testComment.findMany({
    where: {
      message: {
        session: {
          projectId,
        },
      },
    },
    take: MAX_COMMENTS,
    orderBy: { createdAt: 'desc' },
    include: {
      message: {
        select: {
          content: true,
          session: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  })

  if (comments.length === 0) {
    const setId = uuidv4()
    return {
      setId,
      recommendations: [],
      analysisSummary: {
        overview: 'No feedback comments available to analyze.',
        feedbackThemes: [],
        configAlignment: 'good',
        noChangeReason: 'No testing feedback has been provided yet.',
      },
      totalComments: 0,
      sessionsAnalyzed: 0,
      generatedAt: new Date().toISOString(),
    }
  }

  // 2. Fetch current profile (not interview data)
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
    select: { profile: true },
  })

  if (!agentConfig?.profile) {
    throw new NotFoundError('Profile not found - complete interview first')
  }

  const profile = agentConfig.profile as unknown as AgentProfile

  // 3. Format comments for prompt
  const formattedComments = comments
    .map(
      (c, i) =>
        `Comment ${i + 1} (ID: ${c.id})${c.templateId ? ` [${c.templateId}]` : ''}:
  Feedback: "${c.content}"
  On AI response: "${c.message.content.substring(0, 200)}..."`
    )
    .join('\n\n')

  // 4. Build prompt with profile sections
  const prompt = buildProfileAnalysisPrompt(profile, formattedComments, comments.length)

  // 5. Call LLM with timeout
  const openai = getOpenAI()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  try {
    const response = await openai.chat.completions.create(
      {
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You analyze AI agent testing feedback and generate profile section recommendations. Always return valid JSON. Generate AT MOST ONE recommendation per section.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
      },
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Failed to generate recommendations: Empty response')
    }

    // 6. Parse and validate response
    let parsed: ParsedLLMResponse
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new Error('Failed to parse recommendations response')
    }

    // Extract analysis summary with fallback
    const analysisSummary: AnalysisSummary = {
      overview: parsed.analysisSummary?.overview || 'Analysis complete.',
      feedbackThemes: parsed.analysisSummary?.feedbackThemes || [],
      configAlignment: parsed.analysisSummary?.configAlignment || 'partial',
      noChangeReason: parsed.analysisSummary?.noChangeReason,
    }

    // 7. Generate setId
    const setId = uuidv4()

    // 8. Process recommendations - ensure max 1 per section
    const seenSections = new Set<ProfileSectionKey>()
    const validRecs = (parsed.recommendations || []).filter((rec) => {
      // Validate targetSection
      if (!VALID_SECTION_IDS.includes(rec.targetSection)) {
        console.warn(`Skipping recommendation with invalid targetSection: ${rec.targetSection}`)
        return false
      }
      // Enforce max 1 per section
      if (seenSections.has(rec.targetSection)) {
        console.warn(`Skipping duplicate recommendation for section: ${rec.targetSection}`)
        return false
      }
      seenSections.add(rec.targetSection)
      return true
    })

    // 9. Filter out recommendations that produce no actual change
    const effectiveRecs = validRecs.filter((rec) => {
      const section = profile.sections[rec.targetSection]
      const previewAfter = computePreviewAfter(section.content, rec)

      // Skip if before and after are identical (normalize whitespace for comparison)
      const normalizedBefore = section.content.trim().replace(/\s+/g, ' ')
      const normalizedAfter = previewAfter.trim().replace(/\s+/g, ' ')

      if (normalizedBefore === normalizedAfter) {
        console.warn(`Skipping recommendation for ${rec.targetSection}: before and after are identical`)
        return false
      }
      return true
    })

    // 10. Create ProfileRecommendation records in database
    const recommendations: ProfileRecommendation[] = await Promise.all(
      effectiveRecs.map(async (rec) => {
        const section = profile.sections[rec.targetSection]
        const previewBefore = section.content
        const previewAfter = computePreviewAfter(section.content, rec)

        // Validate summaryBullets - ensure 2-3 bullets
        const summaryBullets = Array.isArray(rec.summaryBullets)
          ? rec.summaryBullets.slice(0, 3)
          : ['Change recommended based on feedback']

        // Store in database
        const dbRec = await prisma.profileRecommendation.create({
          data: {
            projectId,
            setId,
            type: rec.type,
            targetSection: rec.targetSection,
            addedContent: rec.addedContent || null,
            removedContent: rec.removedContent || null,
            modifiedFrom: rec.modifiedFrom || null,
            modifiedTo: rec.modifiedTo || null,
            summaryBullets: summaryBullets,
            previewBefore,
            previewAfter,
            rationale: rec.rationale || 'Based on testing feedback.',
            relatedCommentIds: rec.relatedCommentIds || [],
            status: 'pending',
          },
        })

        return {
          id: dbRec.id,
          setId,
          type: rec.type as 'add' | 'remove' | 'modify',
          targetSection: rec.targetSection,
          addedContent: rec.addedContent,
          removedContent: rec.removedContent,
          modifiedFrom: rec.modifiedFrom,
          modifiedTo: rec.modifiedTo,
          summaryBullets,
          previewBefore,
          previewAfter,
          rationale: rec.rationale || 'Based on testing feedback.',
          relatedCommentIds: rec.relatedCommentIds || [],
          status: 'pending' as const,
        }
      })
    )

    // 10. If no recommendations, ensure noChangeReason exists
    if (recommendations.length === 0 && !analysisSummary.noChangeReason) {
      analysisSummary.noChangeReason =
        'Unable to generate specific recommendations from the provided feedback.'
    }

    return {
      setId,
      recommendations,
      analysisSummary,
      totalComments: comments.length,
      sessionsAnalyzed: countUniqueSessions(comments),
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Recommendation generation timed out. Please try again.')
    }
    throw error
  }
}

/**
 * Apply all pending recommendations from a set
 */
export async function applyRecommendations(
  projectId: string,
  setId: string
): Promise<{ profile: AgentProfile; version: ProfileVersion }> {
  // 1. Get current profile and pending recommendations
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
    select: { profile: true, profileVersion: true },
  })

  const recommendations = await prisma.profileRecommendation.findMany({
    where: { setId, status: 'pending' },
  })

  if (!agentConfig?.profile || recommendations.length === 0) {
    throw new NotFoundError('No profile or pending recommendations')
  }

  // 1b. Concurrent apply protection - check if already applied
  const alreadyApplied = await prisma.profileRecommendation.findFirst({
    where: { setId, status: 'applied' },
  })
  if (alreadyApplied) {
    throw new ConflictError('This recommendation set has already been applied')
  }

  const profile = JSON.parse(JSON.stringify(agentConfig.profile)) as AgentProfile

  // 2. Create version snapshot BEFORE changes
  const newVersion = (agentConfig.profileVersion || 1) + 1
  const versionRecord = await prisma.profileVersion.create({
    data: {
      projectId,
      version: newVersion,
      profile: JSON.parse(JSON.stringify(profile)),
      source: 'recommendation',
      recommendationSetId: setId,
    },
  })

  // 3. Apply each recommendation
  for (const rec of recommendations) {
    const sectionKey = rec.targetSection as ProfileSectionKey
    const section = profile.sections[sectionKey]

    switch (rec.type) {
      case 'add':
        section.content = section.content.trim() + '\n\n' + (rec.addedContent || '')
        break
      case 'remove':
        section.content = section.content.replace(rec.removedContent || '', '').trim()
        break
      case 'modify':
        section.content = section.content.replace(
          rec.modifiedFrom || '',
          rec.modifiedTo || ''
        )
        break
    }

    section.isEdited = true
    section.editedAt = new Date().toISOString()
    section.editSource = 'recommendation'
  }

  // Update profile source
  profile.source = 'feedback'

  // 4. Update profile and mark recommendations as applied
  await prisma.$transaction([
    prisma.agentConfig.update({
      where: { projectId },
      data: {
        profile: JSON.parse(JSON.stringify(profile)),
        profileVersion: newVersion,
        profileSource: 'feedback',
      },
    }),
    prisma.profileRecommendation.updateMany({
      where: { setId },
      data: { status: 'applied', appliedAt: new Date() },
    }),
  ])

  return {
    profile,
    version: {
      id: versionRecord.id,
      projectId,
      version: newVersion,
      profile,
      source: 'recommendation',
      recommendationSetId: setId,
      createdAt: versionRecord.createdAt.toISOString(),
    },
  }
}

/**
 * Rollback profile to a previous version
 */
export async function rollbackToVersion(
  projectId: string,
  targetVersion: number
): Promise<AgentProfile> {
  // 1. Get target version
  const version = await prisma.profileVersion.findUnique({
    where: {
      projectId_version: { projectId, version: targetVersion },
    },
  })

  if (!version) {
    throw new NotFoundError(`Version ${targetVersion} not found`)
  }

  // 2. Restore profile
  await prisma.agentConfig.update({
    where: { projectId },
    data: {
      profile: version.profile as object,
      profileVersion: targetVersion,
      profileSource: version.source,
    },
  })

  return version.profile as unknown as AgentProfile
}

/**
 * Get version history for a project
 */
export async function getVersionHistory(
  projectId: string
): Promise<VersionHistoryResponse> {
  const versions = await prisma.profileVersion.findMany({
    where: { projectId },
    orderBy: { version: 'desc' },
    take: 10, // Limit to last 10 versions
    select: {
      version: true,
      source: true,
      createdAt: true,
      recommendationSetId: true,
    },
  })

  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
    select: { profileVersion: true },
  })

  return {
    versions: versions.map((v) => ({
      version: v.version,
      source: v.source,
      createdAt: v.createdAt.toISOString(),
      recommendationSetId: v.recommendationSetId || undefined,
    })),
    currentVersion: agentConfig?.profileVersion || 1,
  }
}

/**
 * Dismiss a single recommendation
 */
export async function dismissRecommendation(
  projectId: string,
  recommendationId: string
): Promise<void> {
  const rec = await prisma.profileRecommendation.findFirst({
    where: { id: recommendationId, projectId },
  })

  if (!rec) {
    throw new NotFoundError('Recommendation not found')
  }

  await prisma.profileRecommendation.update({
    where: { id: recommendationId },
    data: { status: 'dismissed' },
  })
}
