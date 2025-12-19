import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { cn } from '../../lib/utils'
import {
  SAMPLE_RESPONSES,
  SAMPLE_USER_QUESTION,
  FONT_OPTIONS,
  THEME_OPTIONS,
  DepthLevel,
  FontFamily,
  ThemeName
} from './viewerPrefsConfig'

interface PreviewResponseProps {
  depth: DepthLevel
  fontFamily: FontFamily
  theme: ThemeName
}

export function PreviewResponse({ depth, fontFamily, theme }: PreviewResponseProps) {
  const font = useMemo(
    () => FONT_OPTIONS.find(f => f.value === fontFamily),
    [fontFamily]
  )

  const themeColors = useMemo(
    () => THEME_OPTIONS.find(t => t.value === theme)?.colors,
    [theme]
  )

  const responseContent = SAMPLE_RESPONSES[depth]

  if (!themeColors) return null

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        backgroundColor: `hsl(${themeColors.bg})`,
        borderColor: `hsl(${themeColors.border})`,
        fontFamily: font?.fontStack
      }}
    >
      {/* User message */}
      <div className="p-4 flex justify-end">
        <div
          className="max-w-[80%] rounded-lg px-4 py-2"
          style={{
            backgroundColor: `hsl(${themeColors.accent})`,
            color: `hsl(${themeColors.bg})`
          }}
        >
          <p className="text-sm">{SAMPLE_USER_QUESTION}</p>
        </div>
      </div>

      {/* AI response */}
      <div className="p-4 pt-0 flex justify-start">
        <div
          className="max-w-[80%] rounded-lg px-4 py-2 border"
          style={{
            backgroundColor: `hsl(${themeColors.bgElevated})`,
            borderColor: `hsl(${themeColors.border})`,
            color: `hsl(${themeColors.text})`
          }}
        >
          <div className={cn(
            'prose prose-sm max-w-none',
            'prose-headings:text-inherit prose-p:text-inherit',
            'prose-strong:text-inherit prose-li:text-inherit'
          )}>
            <ReactMarkdown>{responseContent}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}
