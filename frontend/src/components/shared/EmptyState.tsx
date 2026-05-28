import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
  compact?: boolean
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4' : 'py-16 px-6',
        className
      )}
    >
      {icon && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className={cn(
            'rounded-2xl flex items-center justify-center mb-4',
            'bg-muted/60 text-muted-foreground',
            compact ? 'h-12 w-12' : 'h-16 w-16'
          )}
        >
          <span className={cn(compact ? '[&>svg]:h-6 [&>svg]:w-6' : '[&>svg]:h-8 [&>svg]:w-8')}>
            {icon}
          </span>
        </motion.div>
      )}

      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className={cn(
          'font-semibold text-foreground',
          compact ? 'text-sm' : 'text-base'
        )}
      >
        {title}
      </motion.h3>

      {description && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={cn(
            'text-muted-foreground mt-1.5 max-w-sm',
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          {description}
        </motion.p>
      )}

      {(action || secondaryAction) && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-6 flex items-center gap-3"
        >
          {action && (
            <button
              onClick={action.onClick}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                compact && 'px-3 py-1.5 text-xs'
              )}
            >
              {action.icon && <span className="[&>svg]:h-4 [&>svg]:w-4">{action.icon}</span>}
              {action.label}
            </button>
          )}

          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
                'border border-border bg-background text-foreground hover:bg-muted',
                'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                compact && 'px-3 py-1.5 text-xs'
              )}
            >
              {secondaryAction.label}
            </button>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}

export default EmptyState
