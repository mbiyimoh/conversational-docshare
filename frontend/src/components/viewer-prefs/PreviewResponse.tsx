import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  SAMPLE_RESPONSES,
  SAMPLE_USER_QUESTION,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  THEME_OPTIONS,
  DepthLevel,
  FontFamily,
  FontSize,
  ThemeName
} from './viewerPrefsConfig'

interface PreviewResponseProps {
  depth: DepthLevel
  fontFamily: FontFamily
  fontSize?: FontSize
  theme: ThemeName
}

export function PreviewResponse({ depth, fontFamily, fontSize = 'medium', theme }: PreviewResponseProps) {
  const font = useMemo(
    () => FONT_OPTIONS.find(f => f.value === fontFamily),
    [fontFamily]
  )

  const fontSizeConfig = useMemo(
    () => FONT_SIZE_OPTIONS.find(f => f.value === fontSize),
    [fontSize]
  )

  const themeColors = useMemo(
    () => THEME_OPTIONS.find(t => t.value === theme)?.colors,
    [theme]
  )

  const responseContent = SAMPLE_RESPONSES[depth]

  if (!themeColors) return null

  // Create CSS custom properties for this preview's theme colors
  const previewStyles = {
    '--preview-text': `hsl(${themeColors.text})`,
    '--preview-text-muted': `hsl(${themeColors.textMuted})`,
    '--preview-accent': `hsl(${themeColors.accent})`,
  } as React.CSSProperties

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        ...previewStyles,
        backgroundColor: `hsl(${themeColors.bg})`,
        borderColor: `hsl(${themeColors.border})`,
        fontFamily: font?.fontStack,
        fontSize: fontSizeConfig?.previewSize
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
          <p className="text-sm font-medium">{SAMPLE_USER_QUESTION}</p>
        </div>
      </div>

      {/* AI response */}
      <div className="p-4 pt-0 flex justify-start">
        <div
          className="max-w-[90%] rounded-lg px-4 py-3 border"
          style={{
            backgroundColor: `hsl(${themeColors.bgElevated})`,
            borderColor: `hsl(${themeColors.border})`
          }}
        >
          {/* Use direct color styling instead of prose classes to ensure theme colors apply */}
          <div
            className="leading-relaxed [&>p]:mb-2 [&>p:last-child]:mb-0 [&>strong]:font-semibold [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:space-y-1"
            style={{ color: `hsl(${themeColors.text})`, fontSize: 'inherit' }}
          >
            <ReactMarkdown
              components={{
                p: ({ children }) => <p style={{ color: 'inherit' }}>{children}</p>,
                strong: ({ children }) => (
                  <strong style={{ color: `hsl(${themeColors.accent})`, fontWeight: 600 }}>
                    {children}
                  </strong>
                ),
                li: ({ children }) => <li style={{ color: 'inherit' }}>{children}</li>,
                ul: ({ children }) => <ul className="list-disc pl-4 space-y-1">{children}</ul>
              }}
            >
              {responseContent}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}
