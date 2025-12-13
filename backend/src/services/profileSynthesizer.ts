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

// ============================================================================
// V2 PROFILE TYPES (12-field braindump synthesis)
// ============================================================================

// Shared constants for braindump synthesis
export const MIN_INPUT_LENGTH = 50

// Confidence levels - qualitative, not numeric
export type ConfidenceLevel = 'EXPLICIT' | 'INFERRED' | 'ASSUMED'

// Individual profile field with confidence tracking (V2)
export interface ProfileFieldV2 {
  id: string
  title: string
  content: string
  confidence: ConfidenceLevel
  isEdited: boolean
  editedAt?: string
  editSource?: 'manual' | 'recommendation'
}

// 12-field profile structure organized by category
export interface AgentProfileV2 {
  fields: {
    // Identity & Context
    agentIdentity: ProfileFieldV2
    domainExpertise: ProfileFieldV2
    targetAudience: ProfileFieldV2
    // Communication & Style
    toneAndVoice: ProfileFieldV2
    languagePatterns: ProfileFieldV2
    adaptationRules: ProfileFieldV2
    // Content & Priorities
    keyTopics: ProfileFieldV2
    avoidanceAreas: ProfileFieldV2
    examplePreferences: ProfileFieldV2
    // Engagement & Behavior
    proactiveGuidance: ProfileFieldV2
    framingStrategies: ProfileFieldV2
    successCriteria: ProfileFieldV2
  }
  generatedAt: string
  source: 'braindump' | 'interview' | 'manual'
  version: 2
}

// Synthesis result returned to frontend
export interface BrainDumpSynthesisResult {
  profile: AgentProfileV2
  lightAreas: string[]  // Field IDs where confidence !== 'EXPLICIT'
  overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW'
  rawInput: string
}

// Field metadata for prompt construction and display
export const PROFILE_FIELD_METADATA: Record<string, { title: string; description: string; category: string }> = {
  agentIdentity: {
    title: 'Agent Identity',
    description: 'Who the agent represents - organization, team, role, mission',
    category: 'Identity & Context'
  },
  domainExpertise: {
    title: 'Domain Expertise',
    description: 'Areas of knowledge, expertise depth, credentials to claim',
    category: 'Identity & Context'
  },
  targetAudience: {
    title: 'Target Audience',
    description: 'Who the agent serves, their characteristics, what they care about',
    category: 'Identity & Context'
  },
  toneAndVoice: {
    title: 'Tone & Voice',
    description: 'Personality, formality level, character traits',
    category: 'Communication & Style'
  },
  languagePatterns: {
    title: 'Language Patterns',
    description: 'Specific phrases, terminology, level of detail, formatting preferences',
    category: 'Communication & Style'
  },
  adaptationRules: {
    title: 'Adaptation Rules',
    description: 'How to adjust for different contexts, question types, or audience signals',
    category: 'Communication & Style'
  },
  keyTopics: {
    title: 'Key Topics',
    description: 'Primary topics to emphasize, tiered by importance',
    category: 'Content & Priorities'
  },
  avoidanceAreas: {
    title: 'Avoidance Areas',
    description: 'Topics to avoid, handle carefully, or redirect',
    category: 'Content & Priorities'
  },
  examplePreferences: {
    title: 'Example Preferences',
    description: 'Use of examples, analogies, data citations, document references',
    category: 'Content & Priorities'
  },
  proactiveGuidance: {
    title: 'Proactive Guidance',
    description: 'Questions to ask, conversation steering, follow-up prompts',
    category: 'Engagement & Behavior'
  },
  framingStrategies: {
    title: 'Framing Strategies',
    description: 'How to position key messages, reframes for common objections',
    category: 'Engagement & Behavior'
  },
  successCriteria: {
    title: 'Success Criteria',
    description: 'What constitutes a good interaction, goals for each conversation',
    category: 'Engagement & Behavior'
  }
}

export const PROFILE_FIELD_IDS = Object.keys(PROFILE_FIELD_METADATA) as Array<keyof AgentProfileV2['fields']>

// ============================================================================
// V1 PROFILE CONSTANTS (existing 5-section interview synthesis)
// ============================================================================

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

// ============================================================================
// V2 BRAINDUMP SYNTHESIS FUNCTIONS
// ============================================================================

/**
 * System prompt for extracting 12-field profile from braindump
 * Uses qualitative confidence signals, not numeric scores
 */
const BRAINDUMP_SYSTEM_PROMPT = `You are an expert at analyzing natural language descriptions and extracting structured AI agent profiles.

Your task: Extract a 12-field agent profile from the user's brain dump with confidence tracking.

## Output Format (JSON)
{
  "fields": {
    "agentIdentity": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "domainExpertise": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "targetAudience": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "toneAndVoice": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "languagePatterns": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "adaptationRules": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "keyTopics": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "avoidanceAreas": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "examplePreferences": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "proactiveGuidance": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "framingStrategies": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" },
    "successCriteria": { "content": "...", "confidence": "EXPLICIT|INFERRED|ASSUMED" }
  }
}

## Field Descriptions
- agentIdentity: Who the agent represents (organization, team, role, mission)
- domainExpertise: Areas of knowledge, expertise depth, credentials to claim
- targetAudience: Who it serves, their characteristics, what they care about
- toneAndVoice: Personality, formality level, character traits
- languagePatterns: Specific phrases, terminology, level of detail, formatting
- adaptationRules: How to adjust for different contexts or question types
- keyTopics: Primary topics to emphasize, tiered by importance if structured
- avoidanceAreas: Topics to avoid, handle carefully, or redirect
- examplePreferences: Use of examples, analogies, data citations
- proactiveGuidance: Questions to ask, conversation steering
- framingStrategies: How to position key messages, reframes
- successCriteria: What constitutes a good interaction

## Confidence Levels
- EXPLICIT: User directly stated this information
- INFERRED: Reasonable inference from context (user implied but didn't state directly)
- ASSUMED: Default/guess based on common patterns (user didn't provide relevant info)

## Guidelines
- Extract specific details mentioned by the user
- Preserve user terminology and examples exactly
- For structured input (tiers, lists), maintain the structure
- Make reasonable inferences and mark them as INFERRED
- Use sensible defaults and mark them as ASSUMED
- Never leave a field empty - always provide meaningful content
- Content should be actionable instructions for an AI agent`

/**
 * Build user prompt with raw input and optional additional context
 */
function buildBrainDumpPrompt(rawInput: string, additionalContext?: string): string {
  let prompt = `Please synthesize an AI agent profile from this brain dump:\n\n${rawInput}`

  if (additionalContext) {
    prompt += `\n\n## Additional Context (user refinements):\n${additionalContext}`
  }

  return prompt
}

/**
 * Calculate overall confidence from individual field confidences
 * Exported for testing
 */
export function calculateOverallConfidence(
  fields: Record<string, { confidence: ConfidenceLevel }>
): 'HIGH' | 'MEDIUM' | 'LOW' {
  const confidences = Object.values(fields).map(f => f.confidence)
  const explicitCount = confidences.filter(c => c === 'EXPLICIT').length
  const assumedCount = confidences.filter(c => c === 'ASSUMED').length

  // HIGH: 8+ explicit, 0-1 assumed
  // MEDIUM: 4-7 explicit, or 2-4 assumed
  // LOW: <4 explicit, or 5+ assumed
  if (explicitCount >= 8 && assumedCount <= 1) return 'HIGH'
  if (assumedCount >= 5 || explicitCount < 4) return 'LOW'
  return 'MEDIUM'
}

/**
 * Extract light areas (fields with non-EXPLICIT confidence)
 * Exported for testing
 */
export function extractLightAreas(
  fields: Record<string, { confidence: ConfidenceLevel }>
): string[] {
  return Object.entries(fields)
    .filter(([_, field]) => field.confidence !== 'EXPLICIT')
    .map(([fieldId]) => fieldId)
}

/**
 * Validate and transform LLM response into typed structure
 */
function validateAndTransformResponse(
  parsed: unknown,
  rawInput: string
): BrainDumpSynthesisResult {
  // Type guard for parsed response
  if (!parsed || typeof parsed !== 'object' || !('fields' in parsed)) {
    throw new LLMError('Invalid response structure: missing fields object')
  }

  const response = parsed as { fields: Record<string, { content: string; confidence: string }> }
  const now = new Date().toISOString()

  // Validate all required fields exist
  const missingFields = PROFILE_FIELD_IDS.filter(id => !response.fields[id])
  if (missingFields.length > 0) {
    throw new LLMError(`Missing required fields: ${missingFields.join(', ')}`)
  }

  // Transform to typed structure
  const fields: AgentProfileV2['fields'] = {} as AgentProfileV2['fields']

  for (const fieldId of PROFILE_FIELD_IDS) {
    const rawField = response.fields[fieldId]
    const metadata = PROFILE_FIELD_METADATA[fieldId]

    // Validate confidence level
    const confidence = ['EXPLICIT', 'INFERRED', 'ASSUMED'].includes(rawField.confidence)
      ? rawField.confidence as ConfidenceLevel
      : 'ASSUMED' // Default to ASSUMED if invalid

    fields[fieldId] = {
      id: fieldId,
      title: metadata.title,
      content: rawField.content || `[No content extracted for ${metadata.title}]`,
      confidence,
      isEdited: false
    }
  }

  // Use the transformed fields (with validated ConfidenceLevel) for helper functions
  const lightAreas = extractLightAreas(fields)
  const overallConfidence = calculateOverallConfidence(fields)

  return {
    profile: {
      fields,
      generatedAt: now,
      source: 'braindump',
      version: 2
    },
    lightAreas,
    overallConfidence,
    rawInput
  }
}

/**
 * Synthesize a 12-field agent profile from natural language braindump
 *
 * @param rawInput - Natural language description from user (voice/text)
 * @param additionalContext - Optional refinement context for regeneration
 * @returns Structured profile with confidence signals
 */
export async function synthesizeFromBrainDump(
  rawInput: string,
  additionalContext?: string
): Promise<BrainDumpSynthesisResult> {
  const openai = getOpenAI()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  const userPrompt = buildBrainDumpPrompt(rawInput, additionalContext)

  try {
    const response = await openai.chat.completions.create(
      {
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: BRAINDUMP_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 4096
      },
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new LLMError('Failed to synthesize profile: Empty response from AI')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new LLMError('Failed to parse AI response as JSON')
    }

    return validateAndTransformResponse(parsed, rawInput)

  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof LLMError) throw error

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new LLMError('Profile synthesis timed out after 60 seconds. Please try again.')
      }

      // OpenAI rate limiting
      if ('status' in error && (error as { status: number }).status === 429) {
        throw new LLMError('Rate limited by AI service. Please try again in a moment.')
      }
    }

    throw new LLMError(
      `Profile synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
