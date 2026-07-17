import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { immersiveOceanConfig as config } from '../../data/immersive-ocean';

export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div
      className={cn(
        'absolute inset-x-0 top-0 z-20 overflow-hidden bg-black/98 backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
        open ? 'h-screen opacity-100' : 'pointer-events-none h-0 opacity-0',
      )}
    >
      <div
        className={cn(
          'flex h-full flex-col justify-center px-8 transition-all delay-100 duration-500',
          open ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
        )}
      >
        <div className="flex flex-col gap-6">
          {config.nav.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={onClose}
              className="text-3xl font-medium text-white/90 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
          <Button type="button" onClick={onClose} className="mt-6 w-fit px-8 py-3.5 text-base">
            {config.talkLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
