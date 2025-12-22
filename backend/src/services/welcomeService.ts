import { prisma } from '../utils/prisma'
import { getOpenAI } from '../utils/openai'

interface DocumentOutlineSection {
  id: string
  title: string
  level: number
}

interface WelcomeContext {
  projectName: string
  documents: Array<{
    filename: string
    title: string | null
    outline: DocumentOutlineSection[] | null
  }>
  audienceDescription?: string
  communicationTone?: string
  emphasisAreas?: string[]
  agentProfile?: {
    agentIdentity?: string
    domainExpertise?: string
    targetAudience?: string
    keyTopics?: string
  }
}

/**
 * Generate a personalized welcome message for viewers
 * Uses LLM with rich context from documents, agent profile, and context layers
 */
export async function generateWelcomeMessage(projectId: string): Promise<string> {
  // Fetch rich context for personalization
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      documents: {
        where: { status: 'completed' },
        select: {
          filename: true,
          title: true,
          outline: true, // Include document structure
        },
      },
      contextLayers: {
        where: { isActive: true, category: { in: ['audience', 'communication', 'content'] } },
      },
      agentConfig: {
        select: {
          profile: true, // Include agent profile
        },
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
  const audienceLayer = project.contextLayers.find((l: { category: string }) => l.category === 'audience')
  const commLayer = project.contextLayers.find((l: { category: string }) => l.category === 'communication')
  const contentLayer = project.contextLayers.find((l: { category: string; metadata: unknown }) => l.category === 'content')

  // Extract agent profile fields (if available)
  let agentProfile: WelcomeContext['agentProfile'] = undefined
  if (project.agentConfig?.profile) {
    const profile = project.agentConfig.profile as Record<string, { content?: string }>
    agentProfile = {
      agentIdentity: profile.agentIdentity?.content,
      domainExpertise: profile.domainExpertise?.content,
      targetAudience: profile.targetAudience?.content,
      keyTopics: profile.keyTopics?.content,
    }
  }

  // Parse document outlines
  const documentsWithOutlines = project.documents.map((doc) => ({
    filename: doc.filename,
    title: doc.title,
    outline: doc.outline ? (doc.outline as unknown as DocumentOutlineSection[]) : null,
  }))

  // Build prompt for LLM
  const prompt = buildWelcomePrompt({
    projectName: project.name,
    documents: documentsWithOutlines,
    audienceDescription: audienceLayer?.content,
    communicationTone: commLayer?.content,
    emphasisAreas: (contentLayer?.metadata as { emphasis?: string[] } | null)?.emphasis,
    agentProfile,
  })

  const MAX_CHARS = 950 // Hard limit, slightly under 1000 to give buffer

  try {
    const openai = getOpenAI()

    // First attempt
    let response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant introducing yourself to a viewer who just accessed a document collection.
Be warm, professional, and helpful. Keep the welcome message concise (2-3 short paragraphs).
CRITICAL: Your response MUST be under 800 characters total. Count carefully.
Use markdown formatting for structure.
Do NOT use [DOC:...] citations in the welcome message - just mention document names naturally.
Reference SPECIFIC content from the documents - mention actual section titles, topics, or themes you see in the outlines.
Don't be generic - make it clear you understand what these documents contain.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 400, // Reduced to help enforce limit
    })

    let message = response.choices[0].message.content || getDefaultWelcome()

    // If still over limit, ask LLM to condense it
    if (message.length > MAX_CHARS) {
      console.warn(`Welcome message too long (${message.length} chars), condensing...`)
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Condense the following welcome message to be under 800 characters while preserving its key points and warmth. Keep the markdown formatting. Do not add any preamble, just output the condensed message.`,
          },
          { role: 'user', content: message },
        ],
        temperature: 0.3,
        max_tokens: 350,
      })
      message = response.choices[0].message.content || message
    }

    // Final safety truncation (preserve last complete sentence)
    if (message.length > MAX_CHARS) {
      console.warn(`Welcome message still too long (${message.length} chars), truncating...`)
      // Find last sentence end before limit
      const truncated = message.substring(0, MAX_CHARS)
      const lastSentenceEnd = Math.max(
        truncated.lastIndexOf('. '),
        truncated.lastIndexOf('.\n'),
        truncated.lastIndexOf('?'),
        truncated.lastIndexOf('!')
      )
      if (lastSentenceEnd > MAX_CHARS * 0.6) {
        message = truncated.substring(0, lastSentenceEnd + 1)
      } else {
        // Just hard truncate with ellipsis
        message = truncated.substring(0, MAX_CHARS - 3) + '...'
      }
    }

    return message
  } catch (error) {
    console.error('Failed to generate welcome message:', error)
    return getDefaultWelcome()
  }
}

function buildWelcomePrompt(context: WelcomeContext): string {
  let prompt = `Generate a welcome message for a viewer accessing the "${context.projectName}" document collection.

## Available Documents and Their Contents`

  // Include document titles AND their section outlines
  for (const doc of context.documents) {
    prompt += `\n\n### ${doc.title || doc.filename}`
    if (doc.outline && doc.outline.length > 0) {
      // Include top-level sections (level 1-2) to give content overview
      const topSections = doc.outline.filter((s) => s.level <= 2).slice(0, 8)
      if (topSections.length > 0) {
        prompt += '\nKey sections:'
        for (const section of topSections) {
          const indent = section.level === 1 ? '' : '  '
          prompt += `\n${indent}- ${section.title}`
        }
      }
    }
  }

  prompt += `

## Instructions
1. Introduce yourself as an AI assistant who KNOWS what's in these specific documents
2. Provide a brief but SPECIFIC summary of the key topics/themes across the materials (reference actual section names!)
3. Suggest 2-3 SPECIFIC things the viewer might want to explore based on the document contents
4. End with an invitation to ask questions

Be specific and demonstrate familiarity with the actual content. Avoid generic phrases like "various topics" - name the actual topics.`

  // Add agent profile context if available
  if (context.agentProfile) {
    prompt += '\n\n## Agent Persona'
    if (context.agentProfile.agentIdentity) {
      prompt += `\nIdentity: ${context.agentProfile.agentIdentity}`
    }
    if (context.agentProfile.domainExpertise) {
      prompt += `\nExpertise: ${context.agentProfile.domainExpertise}`
    }
    if (context.agentProfile.keyTopics) {
      prompt += `\nKey Topics: ${context.agentProfile.keyTopics}`
    }
  }

  if (context.audienceDescription) {
    prompt += `\n\n## Audience Context\n${context.audienceDescription}`
  }

  if (context.communicationTone) {
    prompt += `\n\n## Communication Style\n${context.communicationTone}`
  }

  if (context.agentProfile?.targetAudience) {
    prompt += `\n\n## Target Audience\n${context.agentProfile.targetAudience}`
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
