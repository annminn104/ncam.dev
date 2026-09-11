import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useDialog } from '../../lib/use-dialog';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog. */
  label: string;
  children: ReactNode;
  /** Classes for the dialog panel. */
  className?: string;
  /** Hide the default close button (e.g. when the content renders its own). */
  hideClose?: boolean;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Full-screen framer-motion modal: blurred backdrop (click to close), Escape
 * closes, body scroll locked while open, focus moved to the panel.
 */
export function Modal({ open, onClose, label, children, className, hideClose }: ModalProps) {
  useDialog(open, onClose);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true });
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="modal"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-jungle-black/90 backdrop-blur-sm"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            className={cn('relative outline-none', className)}
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            {hideClose ? null : (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-jungle-black/60 text-off-white backdrop-blur-md transition hover:border-tropical-lime hover:text-tropical-lime"
              >
                <X size={18} />
              </button>
            )}
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
