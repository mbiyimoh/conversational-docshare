import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useRef } from 'react'

interface RevealTextProps {
  children: React.ReactNode
  delay?: number
  className?: string
  once?: boolean
}

export function RevealText({ children, delay = 0, className, once = false }: RevealTextProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once, margin: '-5%' })
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.25, 0.4, 0.25, 1]
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
