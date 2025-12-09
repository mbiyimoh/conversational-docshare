import { prisma } from '../utils/prisma'
import { NotFoundError } from '../utils/errors'

/**
 * Build system prompt from context layers and document outlines
 */
export async function buildSystemPrompt(projectId: string): Promise<string> {
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
    const layers = project.contextLayers.filter((l) => l.category === category)

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
