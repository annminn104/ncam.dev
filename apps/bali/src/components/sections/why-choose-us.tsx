import { Award, Compass, Sparkles, Star } from 'lucide-react';
import { stats, type StatIcon } from '../../data/bali';
import { gsap, useGsap, useRevealChildren } from '../../lib/gsap';
import { Accent, SectionHeading } from '../ui/section-heading';

const ICONS: Record<StatIcon, typeof Compass> = {
  compass: Compass,
  sparkles: Sparkles,
  award: Award,
  star: Star,
};

export function WhyChooseUs() {
  const gridRef = useRevealChildren<HTMLDivElement>({ y: 40, stagger: 0.1 });

  // Count each figure up from zero once the grid scrolls into view.
  useGsap(() => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.querySelectorAll<HTMLElement>('[data-count]').forEach((node) => {
      const target = Number(node.dataset.count);
      const decimals = Number(node.dataset.decimals ?? 0);
      const suffix = node.dataset.suffix ?? '';
      const state = { value: 0 };
      const render = () => {
        node.textContent = `${state.value.toFixed(decimals)}${suffix}`;
      };
      render();
      gsap.to(state, {
        value: target,
        duration: 1.8,
        ease: 'power2.out',
        onUpdate: render,
        scrollTrigger: { trigger: grid, start: 'top 75%', once: true },
      });
    });
  });

  return (
    <section id="why-us" className="relative scroll-mt-28 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          align="center"
          eyebrow="Why travel with us"
          title={
            <>
              Built in Ubud, <Accent>not</Accent> in a call centre
            </>
          }
          description="We are a small studio with big relationships: temple priests, villa owners, boat captains and the grandmothers who still cook the best lawar on the island."
        />

        <div ref={gridRef} className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = ICONS[stat.icon];
            return (
              <div
                key={stat.label}
                className="glass group rounded-3xl p-8 transition-colors duration-500 hover:border-tropical-lime/40"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-tropical-lime/12 text-tropical-lime transition-shadow duration-500 group-hover:shadow-lime">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <p
                  data-count={stat.value}
                  data-decimals={stat.decimals ?? 0}
                  data-suffix={stat.suffix}
                  className="mt-8 font-display text-6xl leading-none tracking-wide text-off-white"
                >
                  {stat.value.toFixed(stat.decimals ?? 0)}
                  {stat.suffix}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-off-white">{stat.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-soft-gray">{stat.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
