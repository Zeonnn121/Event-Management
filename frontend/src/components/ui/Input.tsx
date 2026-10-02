import React from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className="block text-sm font-medium text-text mb-1.5">{label}</label>}
        <input
          ref={ref}
          className={cn(
            'w-full px-3 py-2 rounded-md border bg-surface text-text',
            'focus-ring transition-colors',
            error ? 'border-danger' : 'border-border',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
        {helperText && <p className="mt-1 text-sm text-muted">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
