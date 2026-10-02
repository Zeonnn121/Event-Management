export declare const duration: {
    fast: number;
    base: number;
    slow: number;
};
export declare const ease: {
    standard: number[];
    emphasized: number[];
};
export declare const variants: {
    pageEnter: {
        initial: {
            opacity: number;
            y: number;
        };
        animate: {
            opacity: number;
            y: number;
        };
        exit: {
            opacity: number;
        };
    };
    staggerContainer: {
        animate: {
            transition: {
                staggerChildren: number;
                delayChildren: number;
            };
        };
    };
    staggerItem: {
        initial: {
            opacity: number;
            y: number;
        };
        animate: {
            opacity: number;
            y: number;
            transition: {
                duration: number;
                ease: number[];
            };
        };
    };
    buttonTap: {
        whileTap: {
            scale: number;
        };
    };
    cardHover: {
        whileHover: {
            y: number;
            transition: {
                duration: number;
            };
        };
    };
    modalBackdrop: {
        initial: {
            opacity: number;
        };
        animate: {
            opacity: number;
            transition: {
                duration: number;
            };
        };
        exit: {
            opacity: number;
            transition: {
                duration: number;
            };
        };
    };
    modalPanel: {
        initial: {
            opacity: number;
            scale: number;
            y: number;
        };
        animate: {
            opacity: number;
            scale: number;
            y: number;
            transition: {
                duration: number;
                ease: number[];
                type: string;
                stiffness: number;
                damping: number;
            };
        };
        exit: {
            opacity: number;
            transition: {
                duration: number;
            };
        };
    };
};
export declare function prefersReducedMotion(): boolean;
