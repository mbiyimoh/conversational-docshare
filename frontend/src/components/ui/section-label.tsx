import { cn } from '../../lib/utils'

interface SectionLabelProps {
  number: string | number
  title: string
  className?: string
}

export function SectionLabel({ number, title, className }: SectionLabelProps) {
  const formattedNumber = String(number).padStart(2, '0')

  return (
    <p
      className={cn(
        'text-xs font-mono font-medium tracking-[0.2em] uppercase text-accent mb-4',
        className
      )}
    >
      {formattedNumber} — {title}
    </p>
  )
}
