import { useEffect } from 'react';

/** Lock window scrolling while `locked` (modals, the mobile menu). */
export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previous;
    };
  }, [locked]);
}

/** Shared dialog behaviour: scroll lock + Escape closes. */
export function useDialog(open: boolean, onClose: () => void): void {
  useScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);
}
