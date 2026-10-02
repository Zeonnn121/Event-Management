import React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export const Dialog = ({ children, ...props }: DialogProps) => (
  <RadixDialog.Root {...props}>{children}</RadixDialog.Root>
);

export const DialogTrigger = RadixDialog.Trigger;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Content>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Content>
>(({ className, ...props }, ref) => (
  <RadixDialog.Portal>
    <RadixDialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <RadixDialog.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
        'bg-surface border border-border rounded-lg shadow-lg',
        'p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        className
      )}
      {...props}
    />
  </RadixDialog.Portal>
));

DialogContent.displayName = 'DialogContent';

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center justify-between mb-4', className)} {...props} />
);

export const DialogTitle = RadixDialog.Title;

export const DialogClose = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Close>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Close>
>(({ className, ...props }, ref) => (
  <RadixDialog.Close ref={ref} className={cn('p-1 hover:bg-surface-2 rounded transition-colors', className)} {...props}>
    <X className="h-4 w-4" />
  </RadixDialog.Close>
));

DialogClose.displayName = 'DialogClose';
