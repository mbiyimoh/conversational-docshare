/**
 * AI Brain Dump Synthesis - Backend Service
 *
 * Core LLM synthesis service that transforms natural language descriptions
 * into structured profile data.
 *
 * Dependencies:
 * - OpenAI SDK (npm install openai)
 * - Your project's OpenAI client utility
 *
 * Adaptation:
 * 1. Change the interfaces to match your entity schema
 * 2. Modify the prompt builder functions for your fields
 * 3. Adjust temperature and model as needed
 */

import { getOpenAI } from '../utils/openai'  // Adapt this import to your setup
import { LLMError } from '../utils/errors'    // Adapt or create your error class

const LLM_TIMEOUT_MS = 60000  // 60 second timeout
const openai = getOpenAI()

// ============================================================================
// Output Interfaces - Adapt these to your entity types
// ============================================================================

export interface SynthesizedAudienceProfile {
  name: string
  description: string | null
  audienceDescription: string | null
  communicationStyle: string | null
  topicsEmphasis: string | null
  accessType: 'open' | 'email' | 'password' | 'domain'
}

export interface SynthesizedCollaboratorProfile {
  name: string
  email: string | null
  description: string | null
  communicationNotes: string | null
  expertiseAreas: string[]
  feedbackStyle: 'direct' | 'gentle' | 'detailed' | 'high-level' | null
}

// ============================================================================
// Synthesis Functions
// ============================================================================

/**
 * Synthesize an audience profile from natural language input
 * @param rawInput - Natural language description of the audience
 * @param additionalContext - Optional refinements to add to the synthesis
 * @returns Structured audience profile
 */
export async function synthesizeAudienceProfile(
  rawInput: string,
  additionalContext?: string
): Promise<SynthesizedAudienceProfile> {
  const prompt = buildAudiencePrompt(rawInput, additionalContext)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  try {
    const response = await openai.chat.completions.create(
      {
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: `You extract structured audience profile data from natural language descriptions.
Return valid JSON matching the exact schema provided. Infer reasonable defaults when information is missing.`
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,  // Low temperature for consistent extraction
        max_tokens: 2048,
      },
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new LLMError('Failed to synthesize audience profile: Empty response')
    }

    return JSON.parse(content) as SynthesizedAudienceProfile
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LLMError('Audience profile synthesis timed out. Please try again.')
    }
    throw error
  }
}

/**
 * Synthesize a collaborator profile from natural language input
 * @param rawInput - Natural language description of the collaborator
 * @param additionalContext - Optional refinements to add to the synthesis
 * @returns Structured collaborator profile
 */
export async function synthesizeCollaboratorProfile(
  rawInput: string,
  additionalContext?: string
): Promise<SynthesizedCollaboratorProfile> {
  const prompt = buildCollaboratorPrompt(rawInput, additionalContext)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  try {
    const response = await openai.chat.completions.create(
      {
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: `You extract structured collaborator profile data from natural language descriptions.
Return valid JSON matching the exact schema provided. Infer reasonable defaults when information is missing.`
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2048,
      },
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new LLMError('Failed to synthesize collaborator profile: Empty response')
    }

    return JSON.parse(content) as SynthesizedCollaboratorProfile
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LLMError('Collaborator profile synthesis timed out. Please try again.')
    }
    throw error
  }
}

// ============================================================================
// Prompt Builders - The key to accurate synthesis
// ============================================================================

/**
 * Build the prompt for audience profile synthesis
 *
 * ADAPTATION GUIDE:
 * 1. Change the JSON schema to match your interface
 * 2. Add specific guidance for each field
 * 3. Explain enum values clearly
 * 4. Include examples in field descriptions
 */
function buildAudiencePrompt(rawInput: string, additionalContext?: string): string {
  const contextSection = additionalContext
    ? `\n\nADDITIONAL CONTEXT (user provided refinements):\n${additionalContext}`
    : ''

  return `Extract an audience profile from this natural language description.

USER INPUT:
${rawInput}${contextSection}

Return JSON with this exact structure:
{
  "name": "Short descriptive name for the audience (e.g., 'Board Members', 'Enterprise Buyers')",
  "description": "Brief 1-2 sentence description of this audience",
  "audienceDescription": "Detailed description of who this audience is, their background, and characteristics",
  "communicationStyle": "How the AI should communicate with this audience (tone, formality, technical level)",
  "topicsEmphasis": "Topics to emphasize or prioritize when communicating with this audience",
  "accessType": "open" | "email" | "password" | "domain"
}

Guidelines:
- For accessType: Use "email" if they want to collect contact info, "password" for simple protection, "domain" for company-restricted access, "open" for completely public
- Infer reasonable defaults if specific information isn't provided
- Keep name concise (2-5 words)
- Be specific in the detailed fields based on the user's input`
}

/**
 * Build the prompt for collaborator profile synthesis
 */
function buildCollaboratorPrompt(rawInput: string, additionalContext?: string): string {
  const contextSection = additionalContext
    ? `\n\nADDITIONAL CONTEXT (user provided refinements):\n${additionalContext}`
    : ''

  return `Extract a collaborator profile from this natural language description.

USER INPUT:
${rawInput}${contextSection}

Return JSON with this exact structure:
{
  "name": "Collaborator's full name",
  "email": "Collaborator's email address if provided, otherwise null",
  "description": "Brief 1-2 sentence description of the collaborator's role or relationship",
  "communicationNotes": "Notes about how this collaborator prefers to communicate or receive feedback",
  "expertiseAreas": ["Area 1", "Area 2", "Area 3"],
  "feedbackStyle": "direct" | "gentle" | "detailed" | "high-level" | null
}

Guidelines:
- For feedbackStyle: "direct" for straightforward feedback, "gentle" for diplomatic approach, "detailed" for comprehensive notes, "high-level" for summaries
- expertiseAreas should be an array of strings, even if empty
- Extract email if mentioned in any format
- Infer reasonable defaults if specific information isn't provided
- If feedbackStyle cannot be determined, use null`
}
