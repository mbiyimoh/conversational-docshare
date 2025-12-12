import { cn } from '../../lib/utils'

interface AccentTextProps {
  children: React.ReactNode
  className?: string
}

export function AccentText({ children, className }: AccentTextProps) {
  return (
    <span className={cn('text-accent', className)}>
      {children}
    </span>
  )
}
