import { motion, useReducedMotion } from 'framer-motion'
import { MessageSquarePlus } from 'lucide-react'

export function CollaboratorFeatureSlide() {
  const prefersReducedMotion = useReducedMotion()

  // Animation sequence timing (in seconds)
  const timing = {
    selectionStart: 0.5,
    selectionEnd: 1.5,
    popupAppear: 2.0,
    typingStart: 2.5,
    typingEnd: 4.0,
    loopReset: 5.0,
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Illustration container - glass card */}
      <div className="relative bg-card-bg/50 backdrop-blur-sm border border-border rounded-xl p-6 overflow-hidden" style={{ minHeight: '200px' }}>
        {/* Mock document content */}
        <div className="space-y-3 mb-4">
          <div className="h-3 bg-muted/20 rounded w-3/4" />
          <div className="h-3 bg-muted/20 rounded w-full" />

          {/* Highlighted text line */}
          <div className="relative h-3 flex items-center">
            <div className="bg-muted/20 rounded w-1/4" style={{ height: '100%' }} />
            <motion.div
              className="mx-1 bg-accent/30 rounded px-1"
              initial={{ scaleX: 0, originX: 0 }}
              animate={prefersReducedMotion ? { scaleX: 1 } : {
                scaleX: [0, 1, 1, 1, 0],
                transition: {
                  duration: timing.loopReset,
                  times: [
                    timing.selectionStart / timing.loopReset,
                    timing.selectionEnd / timing.loopReset,
                    timing.popupAppear / timing.loopReset,
                    (timing.loopReset - 0.5) / timing.loopReset,
                    1
                  ],
                  repeat: Infinity,
                  ease: 'easeInOut'
                }
              }}
              style={{ height: '100%', width: '35%' }}
            >
              <span className="text-[8px] text-accent font-medium whitespace-nowrap">
                important insight
              </span>
            </motion.div>
            <div className="bg-muted/20 rounded flex-1" style={{ height: '100%' }} />
          </div>

          <div className="h-3 bg-muted/20 rounded w-5/6" />
          <div className="h-3 bg-muted/20 rounded w-2/3" />
        </div>

        {/* Animated popup */}
        <motion.div
          className="absolute left-1/2 top-[45%]"
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={prefersReducedMotion ? { opacity: 1, scale: 1, y: 0 } : {
            opacity: [0, 0, 1, 1, 0],
            scale: [0.9, 0.9, 1, 1, 0.9],
            y: [10, 10, 0, 0, 10],
            transition: {
              duration: timing.loopReset,
              times: [
                0,
                (timing.popupAppear - 0.1) / timing.loopReset,
                timing.popupAppear / timing.loopReset,
                (timing.loopReset - 0.3) / timing.loopReset,
                1
              ],
              repeat: Infinity,
            }
          }}
          style={{ transform: 'translateX(-50%)' }}
        >
          <div className="bg-card-bg border border-border rounded-lg shadow-lg p-3 w-48">
            {/* Mini comment form mockup */}
            <div className="flex items-center gap-2 text-accent text-xs font-medium mb-2">
              <MessageSquarePlus className="w-3 h-3" />
              Comment
            </div>

            {/* Typing animation */}
            <motion.div
              className="h-8 bg-background/50 rounded border border-border/50 px-2 py-1"
              initial={{ opacity: 0.5 }}
              animate={prefersReducedMotion ? { opacity: 1 } : {
                opacity: [0.5, 0.5, 0.5, 1, 1, 0.5],
                transition: {
                  duration: timing.loopReset,
                  times: [
                    0,
                    timing.typingStart / timing.loopReset,
                    (timing.typingStart + 0.1) / timing.loopReset,
                    timing.typingEnd / timing.loopReset,
                    (timing.loopReset - 0.3) / timing.loopReset,
                    1
                  ],
                  repeat: Infinity,
                }
              }}
            >
              <motion.span
                className="text-[10px] text-foreground/80"
                initial={{ opacity: 0 }}
                animate={prefersReducedMotion ? { opacity: 1 } : {
                  opacity: [0, 0, 0, 1, 1, 0],
                  transition: {
                    duration: timing.loopReset,
                    times: [
                      0,
                      timing.typingStart / timing.loopReset,
                      (timing.typingStart + 0.3) / timing.loopReset,
                      timing.typingEnd / timing.loopReset,
                      (timing.loopReset - 0.3) / timing.loopReset,
                      1
                    ],
                    repeat: Infinity,
                  }
                }}
              >
                Great point here...
              </motion.span>
            </motion.div>
          </div>

          {/* Caret */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0
            border-l-[6px] border-l-transparent
            border-r-[6px] border-r-transparent
            border-t-[6px] border-t-card-bg" />
        </motion.div>

        {/* Cursor animation */}
        <motion.div
          className="absolute w-4 h-4 pointer-events-none"
          initial={{ left: '20%', top: '30%' }}
          animate={prefersReducedMotion ? {} : {
            left: ['20%', '30%', '55%', '50%', '50%', '20%'],
            top: ['30%', '42%', '42%', '55%', '60%', '30%'],
            transition: {
              duration: timing.loopReset,
              times: [
                0,
                timing.selectionStart / timing.loopReset,
                timing.selectionEnd / timing.loopReset,
                timing.popupAppear / timing.loopReset,
                timing.typingStart / timing.loopReset,
                1
              ],
              repeat: Infinity,
              ease: 'easeInOut'
            }
          }}
        >
          {/* Custom cursor SVG */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M1 1L1 12L4.5 8.5L7 14L9 13L6.5 7.5L11 7.5L1 1Z"
              fill="#d4a54a"
              stroke="#0a0a0f"
              strokeWidth="1"
            />
          </svg>
        </motion.div>
      </div>

      {/* Instruction text */}
      <p className="text-center text-sm text-muted mt-4">
        Select any text to share your feedback
      </p>
    </div>
  )
}
