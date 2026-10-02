import React from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-text mb-1.5">{label}</label>}
      <textarea
        ref={ref}
        className={cn(
          'w-full px-3 py-2 rounded-md border bg-surface text-text',
          'focus-ring transition-colors resize-none',
          error ? 'border-danger' : 'border-border',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      {helperText && <p className="mt-1 text-sm text-muted">{helperText}</p>}
    </div>
  )
);

Textarea.displayName = 'Textarea';
