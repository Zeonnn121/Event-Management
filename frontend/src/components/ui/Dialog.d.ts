import React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
export interface DialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
}
export declare const Dialog: ({ children, ...props }: DialogProps) => React.JSX.Element;
export declare const DialogTrigger: React.ForwardRefExoticComponent<RadixDialog.DialogTriggerProps & React.RefAttributes<HTMLButtonElement>>;
export declare const DialogContent: React.ForwardRefExoticComponent<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    onOpenChange?: (open: boolean) => void;
} & React.RefAttributes<HTMLDivElement>>;
export declare const DialogHeader: ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => React.JSX.Element;
export declare const DialogTitle: React.ForwardRefExoticComponent<RadixDialog.DialogTitleProps & React.RefAttributes<HTMLHeadingElement>>;
export declare const DialogClose: React.ForwardRefExoticComponent<Omit<RadixDialog.DialogCloseProps & React.RefAttributes<HTMLButtonElement>, "ref"> & React.RefAttributes<HTMLButtonElement>>;
