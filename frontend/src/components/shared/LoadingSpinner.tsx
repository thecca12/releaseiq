import React from 'react'
import { cn } from '@/utils/cn'

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface LoadingSpinnerProps {
  size?: SpinnerSize
  className?: string
  centered?: boolean
  label?: string
}

const sizeMap: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3 border-[1.5px]',
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
  xl: 'h-12 w-12 border-4',
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className,
  centered = false,
  label,
}) => {
  const spinner = (
    <div
      role="status"
      aria-label={label ?? 'Loading'}
      className={cn('flex flex-col items-center gap-2', centered && 'justify-center')}
    >
      <div
        className={cn(
          'animate-spin rounded-full border-current border-t-transparent text-primary',
          sizeMap[size],
          className
        )}
      />
      {label && (
        <span className="text-sm text-muted-foreground animate-pulse">{label}</span>
      )}
    </div>
  )

  if (centered) {
    return (
      <div className="flex h-full w-full items-center justify-center py-12">
        {spinner}
      </div>
    )
  }

  return spinner
}

export default LoadingSpinner
