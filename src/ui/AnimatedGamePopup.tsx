import React, { type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react';

type PopupProps = {
  id: string | null;
  color: string;
  className?: string;
  role: 'region' | 'alert' | 'status';
  label?: string;
  children: ReactNode;
};

function PopupPanel({ color, className = '', role, label, children }: Omit<PopupProps, 'id'>) {
  const isPresent = useIsPresent();
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={`superweapon-targeting-popover ${className}`}
      style={{ '--weapon-color': color, x: '-50%' } as CSSProperties}
      initial={{ opacity: 0, y: reducedMotion ? 0 : -14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reducedMotion ? 0 : -14 }}
      transition={{ duration: reducedMotion ? 0 : 0.16, ease: 'easeOut' }}
      inert={!isPresent}
      aria-hidden={isPresent ? undefined : true}
      role={role}
      aria-label={label}
      data-popup-phase={isPresent ? 'entering-or-visible' : 'exiting'}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedGamePopup({ id, ...props }: PopupProps) {
  // Wait retains the outgoing panel and then renders the latest requested panel,
  // even if priorities change again while its exit animation is running.
  return (
    <AnimatePresence mode="wait">
      {id ? React.createElement(PopupPanel, { ...props, key: id }) : null}
    </AnimatePresence>
  );
}
