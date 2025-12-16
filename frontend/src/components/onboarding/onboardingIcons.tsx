import { motion } from 'framer-motion'
import { FileText, MessageCircle, BrainCircuit, Share2, Sparkles } from 'lucide-react'

interface IconProps {
  className?: string
  animate?: boolean
}

// Animation wrapper for Lucide icons
function AnimatedIconWrapper({
  children,
  animate,
  className,
}: {
  children: React.ReactNode
  animate?: boolean
  className?: string
}) {
  return (
    <motion.div
      className={className}
      animate={
        animate
          ? {
              scale: [1, 1.08, 1],
            }
          : undefined
      }
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}

// 1. Document + Chat combined icon
export function DocumentChatIcon({ className, animate }: IconProps) {
  return (
    <AnimatedIconWrapper animate={animate} className={className}>
      <div className="relative w-full h-full">
        <FileText className="w-full h-full" strokeWidth={1.5} />
        <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 bg-background rounded-full p-1">
          <MessageCircle className="w-8 h-8" strokeWidth={1.5} />
        </div>
      </div>
    </AnimatedIconWrapper>
  )
}

// 2. Brain/AI icon
export function BrainIcon({ className, animate }: IconProps) {
  return (
    <AnimatedIconWrapper animate={animate} className={className}>
      <BrainCircuit className="w-full h-full" strokeWidth={1.5} />
    </AnimatedIconWrapper>
  )
}

// 3. Share icon
export function ShareLinkIcon({ className, animate }: IconProps) {
  return (
    <AnimatedIconWrapper animate={animate} className={className}>
      <Share2 className="w-full h-full" strokeWidth={1.5} />
    </AnimatedIconWrapper>
  )
}

// 4. Sparkle/magic icon
export function SparkleIcon({ className, animate }: IconProps) {
  return (
    <AnimatedIconWrapper animate={animate} className={className}>
      <Sparkles className="w-full h-full" strokeWidth={1.5} />
    </AnimatedIconWrapper>
  )
}

// Icon dispatcher
interface OnboardingIconProps extends IconProps {
  type: 'document-chat' | 'brain' | 'share-link' | 'sparkle'
}

export function OnboardingIcon({ type, ...props }: OnboardingIconProps) {
  switch (type) {
    case 'document-chat':
      return <DocumentChatIcon {...props} />
    case 'brain':
      return <BrainIcon {...props} />
    case 'share-link':
      return <ShareLinkIcon {...props} />
    case 'sparkle':
      return <SparkleIcon {...props} />
    default:
      return null
  }
}
