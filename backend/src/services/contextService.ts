import { prisma } from '../utils/prisma'
import { NotFoundError } from '../utils/errors'

export type ViewerDepth = 'concise' | 'balanced' | 'detailed'

/**
 * Get depth-specific instructions for the system prompt
 */
export function getDepthInstructions(depth: ViewerDepth): string {
  const instructions: Record<ViewerDepth, string> = {
    concise: `**CRITICAL: The viewer has explicitly requested CONCISE responses. This is their top priority.**

STRICT LENGTH REQUIREMENTS:
- Target: 50-150 words maximum per response
- Structure: 2-4 sentences, or 3-5 bullet points max
- NO introductory phrases like "Great question!" or "I'd be happy to help"
- NO summary paragraphs at the end
- NO examples unless the user specifically asks for one

FORMAT:
- Lead with the direct answer in the first sentence
- Use bullet points for lists (max 3-5 items)
- Omit background context unless essential to understanding

If the user wants more detail, they will ask. Brevity is respect for their time.`,

    balanced: `The viewer prefers BALANCED responses with moderate detail.

LENGTH GUIDELINES:
- Target: 150-300 words per response
- Structure: 2-3 short paragraphs OR intro + bullet list

FORMAT:
- Start with a direct answer
- Add 1-2 supporting details or context points
- Include one example only if it significantly clarifies
- Keep paragraphs to 3-4 sentences max`,

    detailed: `The viewer prefers DETAILED, comprehensive responses.

You may provide thorough explanations including:
- Full background context and reasoning
- Multiple examples and analogies
- Step-by-step breakdowns where helpful
- Anticipate follow-up questions
- No strict length limit, but stay focused and organized

Structure longer responses with headers or numbered sections for readability.`
  }

  return instructions[depth] || instructions.balanced
}

export interface BuildSystemPromptOptions {
  depth?: ViewerDepth
}

/**
 * Build system prompt from context layers and document outlines
 */
export async function buildSystemPrompt(
  projectId: string,
  options: BuildSystemPromptOptions = {}
): Promise<string> {
  const depth = options.depth || 'balanced'
  // Get project with agent config and context layers
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      agentConfig: true,
      contextLayers: {
        where: { isActive: true },
        orderBy: { priority: 'desc' },
      },
      documents: {
        where: { status: 'completed' },
        select: {
          id: true,
          filename: true,
          title: true,
          outline: true,
        },
      },
    },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  // Build system prompt sections
  const sections: string[] = []

  sections.push('# AI AGENT CONFIGURATION')
  sections.push('')
  sections.push('You are an AI representative for a document collection.')
  sections.push(
    'Your role is to answer questions about the documents by citing specific sections and providing accurate information.'
  )
  sections.push('')

  // Add context layers by category
  const categories = ['audience', 'communication', 'content', 'engagement']

  for (const category of categories) {
    const layers = project.contextLayers.filter((l: { category: string }) => l.category === category)

    if (layers.length > 0) {
      sections.push(`## ${category.toUpperCase()} CONFIGURATION`)
      sections.push('')

      for (const layer of layers) {
        sections.push(layer.content)
        sections.push('')
      }

      sections.push('---')
      sections.push('')
    }
  }

  // Add document outlines
  if (project.documents.length > 0) {
    sections.push('## AVAILABLE DOCUMENTS')
    sections.push('')

    for (const doc of project.documents) {
      sections.push(`### ${doc.title}`)
      sections.push(`**Filename for citations:** ${doc.filename}`)
      sections.push('')

      if (doc.outline && Array.isArray(doc.outline)) {
        sections.push('**Sections (use section ID in citations):**')
        for (const section of doc.outline as Array<{ id: string; title: string; level: number }>) {
          const indent = '  '.repeat(section.level - 1)
          sections.push(`${indent}- ${section.title} → section-id: \`${section.id}\``)
        }
        sections.push('')
      }
    }

    sections.push('---')
    sections.push('')
  }

  // Add citation instructions
  sections.push('## DOCUMENT REFERENCING (CRITICAL)')
  sections.push('')
  sections.push('You MUST cite documents when providing information. Citations enable the document viewer.')
  sections.push('')
  sections.push('**Citation format:** `[DOC:filename:section-id]`')
  sections.push('')
  sections.push('**Example:** If discussing content from "Business Plan.pdf" section "executive-summary-1", write:')
  sections.push('  "Our revenue model is outlined in the business plan [DOC:Business Plan.pdf:executive-summary-1]"')
  sections.push('')
  sections.push('**Rules:**')
  sections.push('1. Use the EXACT filename shown above (including extension)')
  sections.push('2. Use the EXACT section-id shown in backticks above')
  sections.push('3. Place citations inline where relevant, not just at the end')
  sections.push('4. The frontend will auto-open and highlight the cited section for the reader')
  sections.push('')
  sections.push('---')
  sections.push('')

  // Add depth preference instructions
  sections.push('## RESPONSE DEPTH PREFERENCE')
  sections.push('')
  sections.push(getDepthInstructions(depth))
  sections.push('')
  sections.push('---')
  sections.push('')

  // Add formatting instructions for readability
  sections.push('## RESPONSE FORMATTING (IMPORTANT)')
  sections.push('')
  sections.push('Format your responses for optimal readability:')
  sections.push('')
  sections.push('**Structure:**')
  sections.push('- Break content into clear paragraphs (2-4 sentences each)')
  sections.push('- Use headers (## or ###) to organize longer responses')
  sections.push('- Add blank lines between paragraphs and sections')
  sections.push('')
  sections.push('**Lists:**')
  sections.push('- Use numbered lists for sequential steps or ranked items')
  sections.push('- Use bullet points for non-sequential items')
  sections.push('- Keep list items concise (1-2 sentences)')
  sections.push('')
  sections.push('**Emphasis:**')
  sections.push('- Use **bold** for key terms and important concepts')
  sections.push('- Use *italics* sparingly for emphasis')
  sections.push('')
  sections.push('**Avoid:**')
  sections.push('- Dense walls of text without breaks')
  sections.push('- Run-on paragraphs with multiple topics')
  sections.push('- Excessive punctuation or all-caps')
  sections.push('')

  return sections.join('\n')
}

/**
 * Create context layers from interview responses
 */
export async function createContextLayersFromInterview(
  projectId: string,
  interviewData: Record<string, unknown>
): Promise<void> {
  // Delete existing context layers
  await prisma.contextLayer.deleteMany({
    where: { projectId },
  })

  // Create audience layer
  if (interviewData.audience) {
    await prisma.contextLayer.create({
      data: {
        projectId,
        category: 'audience',
        priority: 10,
        isActive: true,
        content: `Primary Audience: ${interviewData.audience}

Anticipated questions and concerns from this audience have been considered in the configuration.`,
        metadata: {
          audienceType: interviewData.audience,
        },
      },
    })
  }

  // Create communication layer
  if (interviewData.tone) {
    await prisma.contextLayer.create({
      data: {
        projectId,
        category: 'communication',
        priority: 9,
        isActive: true,
        content: `Communication Style: ${interviewData.tone}

Always cite specific document sections when providing information.
Use format: [DOC:filename:section-id] for citations.`,
        metadata: {
          tone: interviewData.tone,
          citationRequired: true,
        },
      },
    })
  }

  // Create content layer
  if (interviewData.emphasis || interviewData.purpose) {
    const emphasisText = interviewData.emphasis
      ? `\nEmphasis Areas:\n- ${Array.isArray(interviewData.emphasis) ? (interviewData.emphasis as string[]).join('\n- ') : interviewData.emphasis}`
      : ''

    await prisma.contextLayer.create({
      data: {
        projectId,
        category: 'content',
        priority: 8,
        isActive: true,
        content: `Main Purpose: ${interviewData.purpose || 'Provide information about the documents'}${emphasisText}

Stick to documented facts only. Do not speculate beyond what is in the documents.`,
        metadata: JSON.parse(JSON.stringify({
          purpose: interviewData.purpose,
          emphasis: interviewData.emphasis,
          allowSpeculation: false,
        })),
      },
    })
  }

  // Create engagement layer
  if (interviewData.questions) {
    const questionsText = Array.isArray(interviewData.questions)
      ? (interviewData.questions as string[]).join('\n- ')
      : interviewData.questions

    await prisma.contextLayer.create({
      data: {
        projectId,
        category: 'engagement',
        priority: 7,
        isActive: true,
        content: `Proactive Questions to Guide Conversation:
- ${questionsText}

Offer to drill deeper into specific sections when relevant.
Suggest related documents or sections when appropriate.`,
        metadata: {
          proactiveQuestions: true,
          suggestFollowUps: true,
        },
      },
    })
  }
}

/**
 * Get context layers for a project
 */
export async function getContextLayers(projectId: string) {
  return await prisma.contextLayer.findMany({
    where: { projectId },
    orderBy: { priority: 'desc' },
  })
}
