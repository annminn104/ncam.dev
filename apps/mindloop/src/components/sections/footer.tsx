import { mindloopConfig as config } from '../../data/mindloop';

export function Footer() {
  return (
    <footer className="flex flex-col items-center justify-between gap-4 px-8 py-12 md:flex-row md:px-28">
      <p className="text-sm text-muted-foreground">{config.footer.copyright}</p>
      <div className="flex items-center gap-6">
        {config.footer.links.map((l) => (
          <a
            key={l}
            href="#"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {l}
          </a>
        ))}
      </div>
    </footer>
  );
}
