import React from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-text mb-1.5">{label}</label>}
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'w-full px-3 py-2 rounded-md border bg-surface text-text appearance-none',
            'focus-ring transition-colors',
            error ? 'border-danger' : 'border-border',
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none text-muted" />
      </div>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  )
);

Select.displayName = 'Select';
