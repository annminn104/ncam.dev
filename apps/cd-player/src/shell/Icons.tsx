const common = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  focusable: false,
} as const;

export const PlayIcon = () => (
  <svg {...common}>
    <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
  </svg>
);
export const PauseIcon = () => (
  <svg {...common}>
    <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
  </svg>
);
export const PrevIcon = () => (
  <svg {...common}>
    <path d="M6 5h2v14H6zM19 5.5v13L9.5 12 19 5.5z" fill="currentColor" />
  </svg>
);
export const NextIcon = () => (
  <svg {...common}>
    <path d="M16 5h2v14h-2zM5 5.5v13l9.5-6.5L5 5.5z" fill="currentColor" />
  </svg>
);
export const StopIcon = () => (
  <svg {...common}>
    <path d="M6.5 6.5h11v11h-11z" fill="currentColor" />
  </svg>
);
/** Two arrows chasing each other round a loop. */
export const RepeatIcon = () => (
  <svg {...common}>
    <path
      d="M3 13V9a2 2 0 0 1 2-2h10V4l5 4-5 4V9H5v4zM21 11v4a2 2 0 0 1-2 2H9v3l-5-4 5-4v3h10v-4z"
      fill="currentColor"
    />
  </svg>
);
/** Two lines crossing, each ending in an arrow. */
export const ShuffleIcon = () => (
  <svg {...common}>
    <path
      d="M3 16h3.47l6-9H17V4.5L21.5 8 17 11.5V9h-3.47l-6 9H3zM3 8h3.47l6 9H17v2.5l4.5-3.5-4.5-3.5V15h-3.47l-6-9H3z"
      fill="currentColor"
    />
  </svg>
);
/** Zoom out. */
export const MinusIcon = () => (
  <svg {...common}>
    <path d="M5 11h14v2H5z" fill="currentColor" />
  </svg>
);
/** Zoom in. */
export const PlusIcon = () => (
  <svg {...common}>
    <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" fill="currentColor" />
  </svg>
);
/** An arrow turning back round a circle: the view back to where it began. */
export const ResetViewIcon = () => (
  <svg {...common}>
    <path d="M12 5a7 7 0 1 1-7 7h2a5 5 0 1 0 5-5zM12 2.5 8 6l4 3.5z" fill="currentColor" />
  </svg>
);
/** A tick: the colourway in use. */
export const CheckIcon = () => (
  <svg {...common}>
    <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />
  </svg>
);
