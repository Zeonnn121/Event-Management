import React from 'react';
export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    message: string;
    action?: React.ReactNode;
}
export declare const ErrorState: React.ForwardRefExoticComponent<ErrorStateProps & React.RefAttributes<HTMLDivElement>>;
