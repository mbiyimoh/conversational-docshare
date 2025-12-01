import ReactMarkdown from 'react-markdown'

interface ProfileSectionContentProps {
  content: string
  className?: string
}

/**
 * Converts camelCase or snake_case to Title Case with spaces
 */
function camelToTitle(str: string): string {
  return str
    // Insert space before uppercase letters
    .replace(/([A-Z])/g, ' $1')
    // Replace underscores with spaces
    .replace(/_/g, ' ')
    // Capitalize first letter of each word
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim()
}

/**
 * Pre-process content to normalize formatting issues
 */
function preprocessContent(content: string): string {
  let processed = content

  // 1. Convert **camelCaseKey**: patterns to ## Title Case Header
  // Matches: **someKey**: or **someKey**:
  processed = processed.replace(
    /\*\*([a-zA-Z_][a-zA-Z0-9_]*)\*\*\s*:?\s*/g,
    (_, key) => `\n## ${camelToTitle(key)}\n\n`
  )

  // 2. Convert inline bullets (• item • item) to proper list
  // Only if there are multiple bullets on the same line
  processed = processed.replace(
    /([^\n]*)\s+•\s+([^\n]*•[^\n]*)/g,
    (match) => {
      const items = match.split(/\s*•\s*/).filter(Boolean)
      return items.map(item => `\n- ${item.trim()}`).join('')
    }
  )

  // 3. Convert inline from/to JSON objects to formatted text
  // Matches: {"from":"X","to":"Y"} or { "from": "X", "to": "Y" }
  processed = processed.replace(
    /\{\s*"from"\s*:\s*"([^"]+)"\s*,\s*"to"\s*:\s*"([^"]+)"\s*\}/g,
    (_, from, to) => `\n> **From:** "${from}"\n> \n> **To:** "${to}"\n`
  )

  // 4. Convert inline question/purpose JSON objects
  // Matches: {"question":"X","purpose":"Y"}
  processed = processed.replace(
    /\{\s*"question"\s*:\s*"([^"]+)"\s*,\s*"purpose"\s*:\s*"([^"]+)"\s*\}/g,
    (_, question, purpose) => `\n> **Question:** "${question}"\n> \n> *Purpose: ${purpose}*\n`
  )

  // 5. Handle standalone bullets at start of line
  processed = processed.replace(/^•\s*/gm, '- ')

  // 6. Handle colon-separated key-value on same line (key: value)
  // But NOT if it's a URL or time format
  processed = processed.replace(
    /^([a-zA-Z][a-zA-Z0-9_\s]{0,30}):\s+([A-Z])/gm,
    (_, key, firstChar) => `**${key.trim()}:** ${firstChar}`
  )

  // 7. Clean up excessive newlines
  processed = processed.replace(/\n{3,}/g, '\n\n')

  return processed.trim()
}

/**
 * Check if content is JSON and try to convert it to readable format
 */
function tryConvertJson(content: string): string | null {
  const trimmed = content.trim()

  // Must start and end with JSON delimiters
  if (!(trimmed.startsWith('{') && trimmed.endsWith('}')) &&
      !(trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed)
    return convertJsonToMarkdown(parsed)
  } catch {
    return null
  }
}

/**
 * Recursively convert JSON to markdown
 */
function convertJsonToMarkdown(value: unknown, depth = 0): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  // Check for from/to reframe objects
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>

    // Reframe object
    if ('from' in obj && 'to' in obj && typeof obj.from === 'string' && typeof obj.to === 'string') {
      return `> **From:** "${obj.from}"\n> \n> **To:** "${obj.to}"`
    }

    // Question/purpose object
    if ('question' in obj && 'purpose' in obj && typeof obj.question === 'string' && typeof obj.purpose === 'string') {
      return `> **"${obj.question}"**\n> \n> *Purpose: ${obj.purpose}*`
    }
  }

  // Array handling
  if (Array.isArray(value)) {
    // Check if it's an array of reframes or questions
    if (value.length > 0 && typeof value[0] === 'object') {
      const first = value[0] as Record<string, unknown>

      // Array of reframes
      if ('from' in first && 'to' in first) {
        return value.map(item => {
          const obj = item as { from: string; to: string }
          return `> **From:** "${obj.from}"\n> \n> **To:** "${obj.to}"`
        }).join('\n\n---\n\n')
      }

      // Array of questions
      if ('question' in first && 'purpose' in first) {
        return value.map(item => {
          const obj = item as { question: string; purpose: string }
          return `> **"${obj.question}"**\n> \n> *Purpose: ${obj.purpose}*`
        }).join('\n\n')
      }
    }

    // Generic array - bullet list
    return value.map(item => `- ${convertJsonToMarkdown(item, depth + 1)}`).join('\n')
  }

  // Object handling
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const lines: string[] = []

    for (const [key, val] of Object.entries(obj)) {
      const title = camelToTitle(key)
      const headerPrefix = depth === 0 ? '##' : '###'

      if (typeof val === 'string') {
        lines.push(`${headerPrefix} ${title}\n\n${val}`)
      } else if (Array.isArray(val) || typeof val === 'object') {
        lines.push(`${headerPrefix} ${title}\n\n${convertJsonToMarkdown(val, depth + 1)}`)
      } else if (val !== null && val !== undefined) {
        lines.push(`${headerPrefix} ${title}\n\n${String(val)}`)
      }
    }

    return lines.join('\n\n')
  }

  return String(value)
}

/**
 * Smart content renderer that handles markdown, JSON, and mixed content
 */
export function ProfileSectionContent({ content, className = '' }: ProfileSectionContentProps) {
  // First try to parse as JSON
  const jsonConverted = tryConvertJson(content)
  const displayContent = jsonConverted ?? preprocessContent(content)

  return (
    <div className={`prose prose-sm prose-gray max-w-none ${className}`}>
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h2 className="text-base font-bold text-gray-900 mt-4 mb-2 first:mt-0 border-b border-gray-100 pb-1">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1 first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-gray-700 mb-3 last:mb-0 leading-relaxed">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="text-gray-600">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-5 space-y-1 text-gray-700 my-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-5 space-y-1 text-gray-700 my-2">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-gray-700 leading-relaxed">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-300 bg-blue-50 pl-4 pr-3 py-2 my-3 rounded-r-lg">
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr className="my-4 border-gray-200" />
          ),
          code: ({ children }) => (
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">{children}</code>
          ),
        }}
      >
        {displayContent}
      </ReactMarkdown>
    </div>
  )
}
