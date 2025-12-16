import { v4 as uuidv4 } from 'uuid'
import { getOpenAI } from '../utils/openai'
import { prisma } from '../utils/prisma'
import { NotFoundError, ConflictError } from '../utils/errors'
import type { AgentProfile, AgentProfileV2 } from './profileSynthesizer'
import type {
  ProfileSectionKey,
  ProfileSectionKeyV1,
  ProfileSectionKeyV2,
  ProfileRecommendation,
  RecommendationSet,
  AnalysisSummary,
  ProfileVersion,
  VersionHistoryResponse,
  ParsedLLMRecommendation,
  ParsedLLMResponse,
} from '../types/recommendation'
import {
  V1_SECTION_DISPLAY_NAMES,
  V2_FIELD_DISPLAY_NAMES,
} from '../types/recommendation'

// Constants
const MAX_COMMENTS = 50  // Limit comments to prevent prompt overflow
const LLM_TIMEOUT_MS = 30000  // 30 second timeout

/**
 * Helper to detect V2 braindump profile
 */
function isV2Profile(profile: unknown): profile is AgentProfileV2 {
  return (
    typeof profile === 'object' &&
    profile !== null &&
    'version' in profile &&
    (profile as { version: unknown }).version === 2 &&
    'fields' in profile
  )
}

/**
 * Get valid section IDs based on profile version
 */
function getValidSectionIds(profile: unknown): string[] {
  if (isV2Profile(profile)) {
    return Object.keys(V2_FIELD_DISPLAY_NAMES)
  }
  return Object.keys(V1_SECTION_DISPLAY_NAMES)
}

/**
 * Profile-direct analysis prompt that targets profile sections instead of interview answers
 * Supports both V1 (interview-based) and V2 (braindump-based) profiles
 */
function buildProfileAnalysisPrompt(
  profile: AgentProfile | AgentProfileV2,
  formattedComments: string,
  totalComments: number
): string {
  const isV2 = isV2Profile(profile)

  // Build section list for LLM
  const sectionsList = isV2
    ? Object.entries(V2_FIELD_DISPLAY_NAMES)
        .map(([key, name]) => `- ${key}: "${name}"`)
        .join('\n')
    : Object.entries(V1_SECTION_DISPLAY_NAMES)
        .map(([key, name]) => `- ${key}: "${name}"`)
        .join('\n')

  // Build current profile content for LLM
  const profileContent = isV2
    ? Object.entries((profile as AgentProfileV2).fields)
        .map(([key, field]) => `### ${V2_FIELD_DISPLAY_NAMES[key as ProfileSectionKeyV2]}\n${field.content}`)
        .join('\n\n')
    : Object.entries((profile as AgentProfile).sections)
        .map(([key, section]) => `### ${V1_SECTION_DISPLAY_NAMES[key as ProfileSectionKeyV1]}\n${section.content}`)
        .join('\n\n')

  return `You analyze AI agent testing feedback and generate profile recommendations.

## Current Profile ${isV2 ? 'Fields' : 'Sections'}

${profileContent}

## Valid Target ${isV2 ? 'Fields' : 'Sections'} (use these exact keys in targetSection)

${sectionsList}

## Testing Feedback Comments (${totalComments} total)

${formattedComments}

## Your Task

Analyze ALL the feedback comments holistically. Generate recommendations for profile ${isV2 ? 'fields' : 'sections'}.

CRITICAL RULES:
1. Generate AT MOST ONE recommendation per ${isV2 ? 'field' : 'section'}
2. If multiple comments affect the same ${isV2 ? 'field' : 'section'}, SYNTHESIZE them into ONE recommendation
3. Use ONLY these operation types:
   - ADD: Append new content to existing ${isV2 ? 'field' : 'section'} (preserves all existing content)
   - REMOVE: Remove specific phrase ONLY if directly contradicted by feedback
   - MODIFY: Change specific phrase (use sparingly, prefer ADD)
4. NEVER suggest deleting content that is unrelated to the feedback
5. NEVER generate full ${isV2 ? 'field' : 'section'} replacements
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
      "targetSection": "<one of the valid keys listed above>",
      "addedContent": "NEW content to append (must be substantial, at least 1-2 sentences)",
      "summaryBullets": ["Bullet 1", "Bullet 2"],
      "rationale": "Why this change is needed based on specific comment feedback...",
      "relatedCommentIds": ["comment-123", "comment-456"]
    }
  ]
}

CRITICAL FIELD REQUIREMENTS:
- For "add" type: "addedContent" is REQUIRED and must contain NEW text to append
- For "remove" type: "removedContent" is REQUIRED and must be EXACT text that exists in the current ${isV2 ? 'field' : 'section'}
- For "modify" type: "modifiedFrom" (EXACT existing text) and "modifiedTo" (replacement text) are BOTH REQUIRED

IMPORTANT: Each recommendation MUST result in an actual change to the profile. Do not suggest changes where the before and after would be identical. Reference the SPECIFIC feedback comments that informed each recommendation.

If no changes needed, return empty recommendations array with noChangeReason.`
}

/**
 * Get content from a section/field regardless of profile version
 */
function getSectionContent(profile: AgentProfile | AgentProfileV2, sectionKey: string): string {
  if (isV2Profile(profile)) {
    const field = profile.fields[sectionKey as ProfileSectionKeyV2]
    return field?.content || ''
  }
  const section = (profile as AgentProfile).sections[sectionKey as ProfileSectionKeyV1]
  return section?.content || ''
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
      (c: { id: string; templateId: string | null; content: string; message: { content: string } }, i: number) =>
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
    const validSectionIds = getValidSectionIds(profile)
    const seenSections = new Set<ProfileSectionKey>()
    const validRecs = (parsed.recommendations || []).filter((rec) => {
      // Validate targetSection against profile version's valid keys
      if (!validSectionIds.includes(rec.targetSection)) {
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
      const sectionContent = getSectionContent(profile, rec.targetSection)
      const previewAfter = computePreviewAfter(sectionContent, rec)

      // Skip if before and after are identical (normalize whitespace for comparison)
      const normalizedBefore = sectionContent.trim().replace(/\s+/g, ' ')
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
        const previewBefore = getSectionContent(profile, rec.targetSection)
        const previewAfter = computePreviewAfter(previewBefore, rec)

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
 * Supports both V1 (interview) and V2 (braindump) profiles
 */
export async function applyRecommendations(
  projectId: string,
  setId: string
): Promise<{ profile: AgentProfile | AgentProfileV2; version: ProfileVersion }> {
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

  const profile = JSON.parse(JSON.stringify(agentConfig.profile)) as AgentProfile | AgentProfileV2
  const isV2 = isV2Profile(profile)

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

  // 3. Apply each recommendation (version-aware)
  for (const rec of recommendations) {
    const sectionKey = rec.targetSection

    if (isV2) {
      // V2 profile: update fields
      const v2Profile = profile as AgentProfileV2
      const field = v2Profile.fields[sectionKey as ProfileSectionKeyV2]
      if (field) {
        switch (rec.type) {
          case 'add':
            field.content = field.content.trim() + '\n\n' + (rec.addedContent || '')
            break
          case 'remove':
            field.content = field.content.replace(rec.removedContent || '', '').trim()
            break
          case 'modify':
            field.content = field.content.replace(
              rec.modifiedFrom || '',
              rec.modifiedTo || ''
            )
            break
        }
        field.isEdited = true
        field.editedAt = new Date().toISOString()
      }
    } else {
      // V1 profile: update sections
      const v1Profile = profile as AgentProfile
      const section = v1Profile.sections[sectionKey as ProfileSectionKeyV1]
      if (section) {
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
    }
  }

  // Update profile source
  if (!isV2) {
    (profile as AgentProfile).source = 'feedback'
  }

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
 * Returns V1 or V2 profile depending on what was stored
 */
export async function rollbackToVersion(
  projectId: string,
  targetVersion: number
): Promise<AgentProfile | AgentProfileV2> {
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

  return version.profile as unknown as AgentProfile | AgentProfileV2
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
    versions: versions.map((v: {
      version: number;
      source: string;
      createdAt: Date;
      recommendationSetId: string | null;
    }) => ({
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
