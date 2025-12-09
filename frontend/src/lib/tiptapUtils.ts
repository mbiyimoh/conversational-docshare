/**
 * TipTap document utilities
 * Mirrors backend logic from documentVersioning.ts for consistency
 */

interface TipTapNode {
  type: string
  text?: string
  content?: TipTapNode[]
}

/**
 * Convert TipTap JSON document to plain text
 * Synchronized with backend: documentVersioning.ts tipTapToPlainText()
 */
export function tipTapToPlainText(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return ''

  const docObj = doc as { content?: TipTapNode[] }
  if (!docObj.content || !Array.isArray(docObj.content)) return ''

  const lines: string[] = []

  function extractText(nodes: TipTapNode[]): void {
    for (const node of nodes) {
      if (node.type === 'text' && node.text) {
        lines.push(node.text)
      } else if (node.content && Array.isArray(node.content)) {
        extractText(node.content)
        // Add newline after block elements
        if (['paragraph', 'heading', 'listItem'].includes(node.type)) {
          lines.push('\n')
        }
      }
    }
  }

  extractText(docObj.content)
  return lines.join('').trim()
}
