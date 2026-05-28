import React from 'react'
import { cn } from '@/utils/cn'

export type StatusType =
  | 'healthy'
  | 'warning'
  | 'critical'
  | 'open'
  | 'resolved'
  | 'in_progress'
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'info'
  | 'unknown'

type BadgeSize = 'sm' | 'md' | 'lg'

interface StatusBadgeProps {
  status: StatusType | string
  size?: BadgeSize
  showDot?: boolean
  className?: string
  label?: string
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  healthy: {
    bg: 'bg-emerald-100 dark:bg-emerald-950/50',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    label: 'Healthy',
  },
  warning: {
    bg: 'bg-amber-100 dark:bg-amber-950/50',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
    label: 'Warning',
  },
  critical: {
    bg: 'bg-red-100 dark:bg-red-950/50',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
    label: 'Critical',
  },
  open: {
    bg: 'bg-blue-100 dark:bg-blue-950/50',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
    label: 'Open',
  },
  resolved: {
    bg: 'bg-emerald-100 dark:bg-emerald-950/50',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    label: 'Resolved',
  },
  in_progress: {
    bg: 'bg-orange-100 dark:bg-orange-950/50',
    text: 'text-orange-700 dark:text-orange-400',
    dot: 'bg-orange-500',
    label: 'In Progress',
  },
  scheduled: {
    bg: 'bg-purple-100 dark:bg-purple-950/50',
    text: 'text-purple-700 dark:text-purple-400',
    dot: 'bg-purple-500',
    label: 'Scheduled',
  },
  completed: {
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-500',
    label: 'Completed',
  },
  cancelled: {
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-500 dark:text-slate-500',
    dot: 'bg-slate-400',
    label: 'Cancelled',
  },
  info: {
    bg: 'bg-sky-100 dark:bg-sky-950/50',
    text: 'text-sky-700 dark:text-sky-400',
    dot: 'bg-sky-500',
    label: 'Info',
  },
  unknown: {
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-400',
    label: 'Unknown',
  },
}

const sizeMap: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px] font-medium',
  md: 'px-2.5 py-1 text-xs font-medium',
  lg: 'px-3 py-1.5 text-sm font-medium',
}

const dotSizeMap: Record<BadgeSize, string> = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-2.5 w-2.5',
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showDot = true,
  className,
  label,
}) => {
  const normalised = status.toLowerCase().replace(/\s+/g, '_') as StatusType
  const config = statusConfig[normalised] ?? statusConfig.unknown
  const displayLabel = label ?? config.label

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full',
        config.bg,
        config.text,
        sizeMap[size],
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            'rounded-full flex-shrink-0',
            dotSizeMap[size],
            config.dot
          )}
        />
      )}
      {displayLabel}
    </span>
  )
}

export default StatusBadge
