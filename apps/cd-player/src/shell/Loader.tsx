import { loaderLine } from '../view';

/**
 * Holds the scene's place until it is live: a disc spun by CSS from the first paint (still under
 * reduced motion) and one line, with the GLB's download once its size is known. Server-rendered and
 * plain from the first paint: it never enters at opacity 0, and fades out only with the canvas's
 * fade-in (styles/app.css).
 */
export function Loader({ percent }: { percent: number | null }) {
  return (
    <div className="cdp-loader">
      <svg
        className="cdp-loader__disc"
        width="44"
        height="44"
        viewBox="0 0 44 44"
        aria-hidden="true"
        focusable="false"
      >
        {/* The disc, its centre hole cut out. */}
        <path
          className="cdp-loader__face"
          fillRule="evenodd"
          d="M22 1a21 21 0 1 1 0 42a21 21 0 1 1 0-42zM22 19a3 3 0 1 0 0 6a3 3 0 1 0 0-6z"
        />
        {/* Two glints, opposite each other, so the turn shows. */}
        <path
          className="cdp-loader__sheen"
          d="M14.82 2.27A21 21 0 0 1 35.5 5.91L27.14 15.87A8 8 0 0 0 19.26 14.48ZM29.18 41.73A21 21 0 0 1 8.5 38.09L16.86 28.13A8 8 0 0 0 24.74 29.52Z"
        />
        {/* The clamping ring round the hole. */}
        <circle className="cdp-loader__hub" cx="22" cy="22" r="8" />
      </svg>
      <p className="cdp-loader__line">{loaderLine(percent)}</p>
    </div>
  );
}
