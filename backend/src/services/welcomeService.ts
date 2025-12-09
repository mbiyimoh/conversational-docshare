import { prisma } from '../utils/prisma'
import { getOpenAI } from '../utils/openai'

interface WelcomeContext {
  projectName: string
  documents: Array<{ filename: string; title: string | null }>
  audienceDescription?: string
  communicationTone?: string
  emphasisAreas?: string[]
}

/**
 * Generate a personalized welcome message for viewers
 * Uses LLM to create engaging, context-aware greeting
 */
export async function generateWelcomeMessage(projectId: string): Promise<string> {
  // Fetch context for personalization
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      documents: {
        where: { status: 'completed' },
        select: { filename: true, title: true },
      },
      contextLayers: {
        where: { isActive: true, category: { in: ['audience', 'communication', 'content'] } },
      },
    },
  })

  if (!project) {
    return getDefaultWelcome()
  }

  // If no documents, return a simpler welcome
  if (project.documents.length === 0) {
    return getDefaultWelcome()
  }

  // Extract context layer info
  const audienceLayer = project.contextLayers.find((l) => l.category === 'audience')
  const commLayer = project.contextLayers.find((l) => l.category === 'communication')
  const contentLayer = project.contextLayers.find((l) => l.category === 'content')

  // Build prompt for LLM
  const prompt = buildWelcomePrompt({
    projectName: project.name,
    documents: project.documents,
    audienceDescription: audienceLayer?.content,
    communicationTone: commLayer?.content,
    emphasisAreas: (contentLayer?.metadata as { emphasis?: string[] } | null)?.emphasis,
  })

  try {
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant introducing yourself to a viewer who just accessed a document collection.
Be warm, professional, and helpful. Keep the welcome message concise (3-4 paragraphs max).
Use markdown formatting for structure.
Do NOT use [DOC:...] citations in the welcome message - just mention document names naturally.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    })

    return response.choices[0].message.content || getDefaultWelcome()
  } catch (error) {
    console.error('Failed to generate welcome message:', error)
    return getDefaultWelcome()
  }
}

function buildWelcomePrompt(context: WelcomeContext): string {
  let prompt = `Generate a welcome message for a viewer accessing the "${context.projectName}" document collection.

## Available Documents
${context.documents.map((d) => `- **${d.title || d.filename}**`).join('\n')}

## Instructions
1. Briefly introduce yourself as an AI assistant for this specific document collection
2. Provide a 2-3 sentence summary of what materials are available
3. Suggest 2-3 things the viewer might want to explore or ask about
4. End with an invitation to ask questions

Keep the tone friendly and professional. Be concise - no more than 4 short paragraphs.`

  if (context.audienceDescription) {
    prompt += `\n\n## Audience Context\n${context.audienceDescription}`
  }

  if (context.communicationTone) {
    prompt += `\n\n## Communication Style\n${context.communicationTone}`
  }

  if (Array.isArray(context.emphasisAreas) && context.emphasisAreas.length) {
    prompt += `\n\n## Key Topics to Emphasize\n- ${context.emphasisAreas.join('\n- ')}`
  }

  return prompt
}

function getDefaultWelcome(): string {
  return `**Hello! I'm your AI assistant for this document collection.**

I'm here to help you explore and understand the materials shared with you. Feel free to ask me:
- Questions about specific topics in the documents
- Requests for summaries or explanations
- Help finding particular information

What would you like to know?`
}
