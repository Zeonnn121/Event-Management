import React from 'react';
import { cn } from '@/lib/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('bg-surface-2 animate-pulse rounded-md', className)}
      {...props}
    />
  )
);

Skeleton.displayName = 'Skeleton';
