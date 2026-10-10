import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * A modal's keyboard plumbing: focus goes to `first` when it opens and back to whatever had it
 * when it closes, and Escape (wherever the focus is, even on the canvas) calls `onEscape`.
 * Battle makes the rest of the HUD inert while a modal is open, so Tab stays inside it.
 */
export function useDialog(first: RefObject<HTMLElement | null>, onEscape: () => void): void {
  // Read in the first render: by the time effects run, this commit has made the HUD inert and
  // the browser may already have dropped the focus from a board square.
  const [opener] = useState(() => document.activeElement);
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  });

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') escape.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      // A passive cleanup runs after the commit that closed the modal, so the HUD is no longer
      // inert here. A rematch or the lobby unmounts the opener too: then there is nothing to do.
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [first, opener]);
}
