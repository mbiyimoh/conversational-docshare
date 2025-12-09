import { getOpenAI } from '../utils/openai'
import { prisma } from '../utils/prisma'
import { LLMError } from '../utils/errors'

interface InterviewData {
  audience?: string
  purpose?: string
  tone?: string
  emphasis?: string
  questions?: string
}

interface ProfileSection {
  id: string
  title: string
  content: string
  isEdited: boolean
  editedAt?: string
  editSource?: 'manual' | 'recommendation'
}

export interface AgentProfile {
  sections: {
    identityRole: ProfileSection
    communicationStyle: ProfileSection
    contentPriorities: ProfileSection
    engagementApproach: ProfileSection
    keyFramings: ProfileSection
  }
  generatedAt: string
  source: 'interview' | 'manual' | 'feedback'
}

// Constants
const MAX_SECTION_LENGTH = 4000 // Increased to accommodate preserved structure
const LLM_TIMEOUT_MS = 60000 // 60 seconds for complex structured synthesis
const STRUCTURED_INPUT_THRESHOLD = 200 // Word count threshold for "rich" input

// Section generation constants
const SECTION_ORDER = ['identityRole', 'communicationStyle', 'contentPriorities', 'engagementApproach', 'keyFramings'] as const
export type SectionId = typeof SECTION_ORDER[number]

const SECTION_NAMES: Record<SectionId, string> = {
  identityRole: 'Identity & Role',
  communicationStyle: 'Communication Style',
  contentPriorities: 'Content Priorities',
  engagementApproach: 'Engagement Approach',
  keyFramings: 'Key Framings',
}

const SECTION_DESCRIPTIONS: Record<SectionId, string> = {
  identityRole: 'Identity & Role - Define who this AI agent represents (organization, team, or role) and who it serves (target audience). Include the agent\'s core mission, expertise areas, and how it should position itself in conversations.',
  communicationStyle: 'Communication Style - Define the agent\'s tone (formal/casual/professional), language patterns, level of detail, use of examples, and how it should adapt to different conversation contexts. Include specific phrases or approaches to use or avoid.',
  contentPriorities: 'Content Priorities - what topics/areas to emphasize (PRESERVE ALL TIERS AND STRUCTURE)',
  engagementApproach: 'Engagement Approach - how to guide conversations and what questions to ask',
  keyFramings: 'Key Framings - how to frame/position key messages and reframes',
}

// Export constants for use by controller
export { SECTION_ORDER, SECTION_NAMES }

/**
 * Analyze input to determine if it's structured (tiers, lists, frameworks)
 * vs. unstructured braindump (stream of consciousness)
 */
function analyzeInputStructure(text: string): {
  isStructured: boolean
  wordCount: number
  structureSignals: string[]
} {
  const wordCount = text.split(/\s+/).filter(Boolean).length
  const structureSignals: string[] = []

  // Detect structure signals
  const patterns = [
    { regex: /(?:^|\n)\s*(?:tier|level|priority)\s*\d/im, signal: 'tiers' },
    { regex: /(?:^|\n)\s*\d+[.)]\s/m, signal: 'numbered-list' },
    { regex: /(?:^|\n)\s*[-•*]\s/m, signal: 'bullet-list' },
    { regex: /(?:^|\n)\s*#{1,3}\s/m, signal: 'headers' },
    { regex: /\b(?:must|should|could|won't)\b.*:/i, signal: 'priority-labels' },
    { regex: /(?:^|\n)\s*\w+:\s*\n/m, signal: 'section-headers' },
    { regex: /\|.*\|.*\|/m, signal: 'table' },
    { regex: /(?:from|to):\s*["']/im, signal: 'reframes' },
    { regex: /(?:best case|worst case|neutral case)/im, signal: 'scenarios' },
  ]

  for (const { regex, signal } of patterns) {
    if (regex.test(text)) {
      structureSignals.push(signal)
    }
  }

  // Input is "structured" if it has 2+ structure signals OR has clear organizational patterns
  const isStructured = structureSignals.length >= 2 ||
    (wordCount > STRUCTURED_INPUT_THRESHOLD && structureSignals.length >= 1)

  return { isStructured, wordCount, structureSignals }
}

/**
 * Convert a value to a readable string
 * Handles objects, arrays, and primitives
 */
function valueToString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }

  if (value === null || value === undefined) {
    return undefined
  }

  // Handle objects - convert to readable format
  if (typeof value === 'object') {
    // If it's an object with meaningful keys, format it nicely
    if (Array.isArray(value)) {
      // Array of strings -> join with newlines
      return value.map(item => valueToString(item)).filter(Boolean).join('\n• ')
    }

    // Object with properties -> format as key-value pairs or extract content
    const obj = value as Record<string, unknown>

    // If object has a 'content' or 'text' field, use that
    if (typeof obj.content === 'string') return obj.content
    if (typeof obj.text === 'string') return obj.text
    if (typeof obj.description === 'string') return obj.description

    // Otherwise, format all string/array values into readable text
    const parts: string[] = []
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string') {
        parts.push(`**${key}**: ${val}`)
      } else if (Array.isArray(val)) {
        const items = val.map(item => typeof item === 'string' ? item : JSON.stringify(item))
        parts.push(`**${key}**:\n• ${items.join('\n• ')}`)
      }
    }

    if (parts.length > 0) {
      return parts.join('\n\n')
    }

    // Last resort: JSON stringify
    console.warn(`[ProfileSynthesizer] Converting complex object to JSON string`)
    return JSON.stringify(value, null, 2)
  }

  // Primitives
  return String(value)
}

/**
 * Extract a section value from parsed JSON with fallback key matching
 * Handles LLM responses that may use different key formats (e.g., identity_role vs identityRole)
 * Also handles cases where LLM returns an object instead of a string
 */
function extractSectionValue(parsed: Record<string, unknown>, sectionId: string): string | undefined {
  // Try exact match first
  const exactValue = parsed[sectionId]
  if (exactValue !== undefined) {
    const converted = valueToString(exactValue)
    if (converted) {
      if (typeof exactValue !== 'string') {
        console.warn(`[ProfileSynthesizer] Converted ${sectionId} from ${typeof exactValue} to string`)
      }
      return converted
    }
  }

  const keys = Object.keys(parsed)

  // Try case-insensitive matching with underscores ignored
  const normalizedSectionId = sectionId.toLowerCase().replace(/_/g, '')
  for (const key of keys) {
    const normalizedKey = key.toLowerCase().replace(/_/g, '')
    if (normalizedKey === normalizedSectionId) {
      const converted = valueToString(parsed[key])
      if (converted) {
        console.warn(`[ProfileSynthesizer] Fuzzy match: Expected '${sectionId}', got '${key}'`)
        return converted
      }
    }
  }

  // If only one key exists, use it (LLM likely used a different naming convention)
  if (keys.length === 1) {
    const converted = valueToString(parsed[keys[0]])
    if (converted) {
      console.warn(`[ProfileSynthesizer] Single-key fallback: Expected '${sectionId}', got '${keys[0]}'`)
      return converted
    }
  }

  return undefined
}

/**
 * Validate and truncate section content
 */
function validateSection(content: string | undefined): string {
  if (!content || typeof content !== 'string') {
    return 'Content could not be generated. Please regenerate the profile.'
  }
  return content.length > MAX_SECTION_LENGTH
    ? content.substring(0, MAX_SECTION_LENGTH) + '...'
    : content
}

/**
 * Determine input type based on structure analysis
 */
function determineInputType(interviewData: InterviewData): 'simple' | 'structured' | 'unstructured' {
  // Combine all inputs to analyze overall structure
  const allInputs = [
    interviewData.audience || '',
    interviewData.purpose || '',
    interviewData.tone || '',
    interviewData.emphasis || '',
    interviewData.questions || '',
  ].join('\n\n')

  const analysis = analyzeInputStructure(allInputs)

  // Decision logic
  if (analysis.wordCount < STRUCTURED_INPUT_THRESHOLD) {
    return 'simple'
  } else if (analysis.isStructured) {
    return 'structured'
  } else {
    return 'unstructured'
  }
}

/**
 * Generate a single profile section
 */
export async function generateSingleSection(
  interviewData: InterviewData,
  sectionId: SectionId,
  isStructured: boolean
): Promise<string> {
  const openai = getOpenAI()

  const structuredInstruction = isStructured
    ? `CRITICAL: The user provided well-structured input with tiers, lists, and frameworks.
       You MUST preserve this structure exactly. Do NOT compress into generic sentences.
       If they provided tiers, keep the tiers. If they provided bullet points, keep them.
       Completeness > brevity. Output can be LONG.`
    : `Synthesize the key points while preserving specific terminology, examples, and metrics.`

  const prompt = `Generate the "${SECTION_NAMES[sectionId]}" section for an AI agent profile.

${structuredInstruction}

INTERVIEW DATA:
- Audience: ${interviewData.audience || 'Not specified'}
- Purpose: ${interviewData.purpose || 'Not specified'}
- Tone: ${interviewData.tone || 'Not specified'}
- Emphasis: ${interviewData.emphasis || 'Not specified'}
- Questions: ${interviewData.questions || 'Not specified'}

SECTION TO GENERATE:
${SECTION_DESCRIPTIONS[sectionId]}

Generate ONLY this section as JSON:
{
  "${sectionId}": "Your detailed content here..."
}

Return valid JSON only.`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  try {
    const response = await openai.chat.completions.create(
      {
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: 'You generate JSON profile sections. Preserve user terminology exactly. Do not paraphrase specifics.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 4096,
      },
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new LLMError(`Failed to generate ${sectionId}: Empty response`)
    }

    const parsed = JSON.parse(content)
    const sectionContent = extractSectionValue(parsed, sectionId)
    return validateSection(sectionContent)
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LLMError(`Generation of ${sectionId} timed out. Please try again.`)
    }
    throw error
  }
}

/**
 * Generate a batch of profile sections
 */
async function generateSectionBatch(
  openai: ReturnType<typeof getOpenAI>,
  interviewData: InterviewData,
  sections: string[],
  isStructured: boolean
): Promise<Record<string, string>> {
  // Use global SECTION_DESCRIPTIONS constant
  const sectionsToGenerate = sections.map(s => `"${s}": "${SECTION_DESCRIPTIONS[s as SectionId]}"`).join(',\n  ')

  const structuredInstruction = isStructured
    ? `CRITICAL: The user provided well-structured input with tiers, lists, and frameworks.
       You MUST preserve this structure exactly. Do NOT compress into generic sentences.
       If they provided tiers, keep the tiers. If they provided bullet points, keep them.
       Completeness > brevity. Output can be LONG.`
    : `Synthesize the key points while preserving specific terminology, examples, and metrics.`

  const prompt = `Generate the following profile sections based on interview data.

${structuredInstruction}

INTERVIEW DATA:
- Audience: ${interviewData.audience || 'Not specified'}
- Purpose: ${interviewData.purpose || 'Not specified'}
- Tone: ${interviewData.tone || 'Not specified'}
- Emphasis: ${interviewData.emphasis || 'Not specified'}
- Questions: ${interviewData.questions || 'Not specified'}

Generate ONLY these sections as JSON:
{
  ${sectionsToGenerate}
}

Return valid JSON only.`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  try {
    const response = await openai.chat.completions.create(
      {
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: 'You generate JSON profile sections. Preserve user terminology exactly. Do not paraphrase specifics.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 4096,
      },
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new LLMError('Failed to generate sections: Empty response')
    }

    return JSON.parse(content)
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LLMError('Profile generation timed out. Please try again.')
    }
    throw error
  }
}

/**
 * Synthesize an agent profile from interview data using LLM
 * Uses two batches to stay within token limits for detailed structured input
 */
export async function synthesizeProfile(
  interviewData: InterviewData
): Promise<AgentProfile> {
  const openai = getOpenAI()

  // Analyze input to determine if structured
  const inputType = determineInputType(interviewData)
  const useStructuredMode = inputType === 'structured'

  // Generate in two batches to stay within 4096 token limit
  // Batch 1: Identity, Communication, Content (content is usually the longest)
  // Batch 2: Engagement, Key Framings
  const [batch1, batch2] = await Promise.all([
    generateSectionBatch(
      openai,
      interviewData,
      ['identityRole', 'communicationStyle', 'contentPriorities'],
      useStructuredMode
    ),
    generateSectionBatch(
      openai,
      interviewData,
      ['engagementApproach', 'keyFramings'],
      useStructuredMode
    ),
  ])

  const generated = { ...batch1, ...batch2 }

  // Extract sections with fallback key matching
  const sectionIds = ['identityRole', 'communicationStyle', 'contentPriorities', 'engagementApproach', 'keyFramings'] as const
  const extractedSections: Record<string, string | undefined> = {}

  for (const sectionId of sectionIds) {
    extractedSections[sectionId] = extractSectionValue(generated, sectionId)
  }

  // Log warning if any sections are missing
  const missingFields = sectionIds.filter(field => !extractedSections[field])
  if (missingFields.length > 0) {
    console.warn(`[ProfileSynthesizer] Missing/invalid fields: ${missingFields.join(', ')}`)
  }

  const now = new Date().toISOString()

  return {
    sections: {
      identityRole: {
        id: 'identityRole',
        title: 'Identity & Role',
        content: validateSection(extractedSections.identityRole),
        isEdited: false,
      },
      communicationStyle: {
        id: 'communicationStyle',
        title: 'Communication Style',
        content: validateSection(extractedSections.communicationStyle),
        isEdited: false,
      },
      contentPriorities: {
        id: 'contentPriorities',
        title: 'Content Priorities',
        content: validateSection(extractedSections.contentPriorities),
        isEdited: false,
      },
      engagementApproach: {
        id: 'engagementApproach',
        title: 'Engagement Approach',
        content: validateSection(extractedSections.engagementApproach),
        isEdited: false,
      },
      keyFramings: {
        id: 'keyFramings',
        title: 'Key Framings',
        content: validateSection(extractedSections.keyFramings),
        isEdited: false,
      },
    },
    generatedAt: now,
    source: 'interview',
  }
}

/**
 * Regenerate profile for a project and save to database
 */
export async function regenerateProfile(
  projectId: string
): Promise<AgentProfile> {
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
  })

  if (!agentConfig) {
    throw new Error('Agent config not found')
  }

  const interviewData = agentConfig.interviewData as InterviewData
  const profile = await synthesizeProfile(interviewData)

  await prisma.agentConfig.update({
    where: { projectId },
    data: {
      profile: JSON.parse(JSON.stringify(profile)),
      profileGeneratedAt: new Date(),
      profileSource: 'interview',
    },
  })

  return profile
}
