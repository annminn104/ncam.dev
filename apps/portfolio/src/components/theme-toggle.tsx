import { useEffect } from 'react';
import { syncThemeColor, toggleTheme, useTheme } from '../lib/theme';

/**
 * Flips the site between light and dark and remembers the choice.
 *
 * The two icons are BOTH rendered and CSS picks which one shows (see
 * `.theme-toggle` in styles.css), so the button looks right on the server-
 * rendered first paint even though the server cannot know the visitor's theme.
 * Only the accessible name needs the real value, which is why the label — and
 * nothing else — waits for hydration.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();

  // The one place the address-bar colour is kept in step after first paint —
  // covers a local toggle, another tab's toggle and the OS switching schemes.
  useEffect(() => syncThemeColor(theme), [theme]);

  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className={className ? `theme-toggle ${className}` : 'theme-toggle'}
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      suppressHydrationWarning
    >
      <svg
        className="theme-toggle__icon theme-toggle__icon--sun"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6L17 17M7 7 5.4 5.4" />
      </svg>
      <svg
        className="theme-toggle__icon theme-toggle__icon--moon"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8Z" />
      </svg>
    </button>
  );
}
