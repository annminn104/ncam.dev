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
