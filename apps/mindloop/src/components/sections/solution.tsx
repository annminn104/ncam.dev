import { motion } from 'framer-motion';
import { useFade } from '../../lib/motion';
import { mindloopConfig as config } from '../../data/mindloop';

export function Solution() {
  const { label, features } = config.solution;
  const fade = useFade();
  return (
    <section className="border-t border-border/30 px-6 py-32 md:py-44">
      <div className="mx-auto max-w-6xl">
        <motion.p {...fade(0)} className="text-xs uppercase tracking-[3px] text-muted-foreground">
          {label}
        </motion.p>
        <motion.h2 {...fade(0.1)} className="mt-4 max-w-3xl text-4xl md:text-6xl">
          The platform for <span className="font-serif italic">meaningful</span> content
        </motion.h2>

        <motion.video
          {...fade(0.2)}
          className="mt-12 aspect-[3/1] w-full rounded-2xl object-cover"
          src={config.videos.solution}
          autoPlay
          loop
          muted
          playsInline
        />

        <div className="mt-16 grid gap-8 md:grid-cols-4">
          {features.map((f, i) => (
            <motion.div key={f.title} {...fade(0.1 * i)}>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
