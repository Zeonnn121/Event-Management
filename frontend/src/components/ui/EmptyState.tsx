import React from 'react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ title, description, icon, action, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}
      {...props}
    >
      {icon && <div className="mb-4 text-muted">{icon}</div>}
      <h3 className="text-lg font-semibold text-text mb-2">{title}</h3>
      {description && <p className="text-muted text-sm mb-4">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
);

EmptyState.displayName = 'EmptyState';
