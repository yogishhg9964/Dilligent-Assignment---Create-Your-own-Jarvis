// Markdown text formatter for Next.js/React
// Converts **bold** and `code` markdown to styled JSX elements

export const formatMarkdownText = (text: string) => {
  const parts: (string | JSX.Element)[] = []
  let keyId = 0
  let pos = 0

  // Pattern to match **bold** and `code`
  const pattern = /((\*\*[^*]+\*\*)|(`[^`]+`))/g
  let match

  while ((match = pattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > pos) {
      parts.push(text.substring(pos, match.index))
    }

    const fullMatch = match[0]

    if (fullMatch.startsWith('**') && fullMatch.endsWith('**')) {
      // Bold text
      const content = fullMatch.substring(2, fullMatch.length - 2)
      parts.push(
        <strong key={`bold-${keyId++}`} className="font-bold text-gray-900">
          {content}
        </strong>
      )
    } else if (fullMatch.startsWith('`') && fullMatch.endsWith('`')) {
      // Code
      const content = fullMatch.substring(1, fullMatch.length - 1)
      parts.push(
        <code
          key={`code-${keyId++}`}
          className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800"
        >
          {content}
        </code>
      )
    }

    pos = pattern.lastIndex
  }

  // Add remaining text
  if (pos < text.length) {
    parts.push(text.substring(pos))
  }

  return parts.length > 0 ? parts : [text]
}
