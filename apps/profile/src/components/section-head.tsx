import type { ReactNode } from 'react';

interface SectionHeadProps {
  label: string;
  title: ReactNode;
  lead?: string;
}

/** Mono eyebrow + Syne display title + optional lede, laid out as two columns on desktop. */
export function SectionHead({ label, title, lead }: SectionHeadProps) {
  return (
    <div className="sec__head">
      <div>
        <p className="label">{label}</p>
        <h2 className="sec__title">{title}</h2>
      </div>
      {lead ? <p className="sec__lead">{lead}</p> : null}
    </div>
  );
}
