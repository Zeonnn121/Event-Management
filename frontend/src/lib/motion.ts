export const duration = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
};

export const ease = {
  standard: [0.2, 0, 0, 1],
  emphasized: [0.16, 1, 0.3, 1],
};

export const variants = {
  pageEnter: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0 },
  },
  staggerContainer: {
    animate: {
      transition: {
        staggerChildren: 0.04,
        delayChildren: 0,
      },
    },
  },
  staggerItem: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.standard } },
  },
  buttonTap: {
    whileTap: { scale: 0.98 },
  },
  cardHover: {
    whileHover: { y: -2, transition: { duration: duration.fast } },
  },
  modalBackdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: duration.fast } },
    exit: { opacity: 0, transition: { duration: duration.fast } },
  },
  modalPanel: {
    initial: { opacity: 0, scale: 0.96, y: 8 },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: duration.base,
        ease: ease.standard,
        type: 'spring',
        stiffness: 320,
        damping: 30,
      },
    },
    exit: {
      opacity: 0,
      transition: { duration: duration.fast },
    },
  },
};

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
