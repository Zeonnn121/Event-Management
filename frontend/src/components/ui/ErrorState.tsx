import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message: string;
  action?: React.ReactNode;
}

export const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  ({ title = 'Error', message, action, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}
      {...props}
    >
      <AlertCircle className="h-12 w-12 text-danger mb-4" />
      <h3 className="text-lg font-semibold text-text mb-2">{title}</h3>
      <p className="text-muted text-sm mb-4">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
);

ErrorState.displayName = 'ErrorState';
