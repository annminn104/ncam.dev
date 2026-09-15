// Type declarations for the federated `profile` remote: one module per home-page
// section, all with the same { ssr, hydrate, mount } shape (see
// apps/profile/src/lib/section-module.tsx). Modules may accept an optional props
// object — the host passes `{ posts }` to `profile/blog`, nothing to the others.

interface ProfileSectionSSRResult {
  html: string;
  css: string;
}

interface ProfileSectionModule<P = unknown> {
  ssr(props?: P): Promise<ProfileSectionSSRResult>;
  hydrate(target: HTMLElement, props?: P): () => void;
  mount(target: HTMLElement, props?: P): () => void;
}

declare module 'profile/hero' {
  export const ssr: ProfileSectionModule['ssr'];
  export const hydrate: ProfileSectionModule['hydrate'];
  export const mount: ProfileSectionModule['mount'];
  const module: ProfileSectionModule;
  export default module;
}
declare module 'profile/stacks' {
  export const ssr: ProfileSectionModule['ssr'];
  export const hydrate: ProfileSectionModule['hydrate'];
  export const mount: ProfileSectionModule['mount'];
  const module: ProfileSectionModule;
  export default module;
}
declare module 'profile/experience' {
  export const ssr: ProfileSectionModule['ssr'];
  export const hydrate: ProfileSectionModule['hydrate'];
  export const mount: ProfileSectionModule['mount'];
  const module: ProfileSectionModule;
  export default module;
}
declare module 'profile/projects' {
  export const ssr: ProfileSectionModule['ssr'];
  export const hydrate: ProfileSectionModule['hydrate'];
  export const mount: ProfileSectionModule['mount'];
  const module: ProfileSectionModule;
  export default module;
}
declare module 'profile/blog' {
  export const ssr: ProfileSectionModule['ssr'];
  export const hydrate: ProfileSectionModule['hydrate'];
  export const mount: ProfileSectionModule['mount'];
  const module: ProfileSectionModule;
  export default module;
}
declare module 'profile/contact' {
  export const ssr: ProfileSectionModule['ssr'];
  export const hydrate: ProfileSectionModule['hydrate'];
  export const mount: ProfileSectionModule['mount'];
  const module: ProfileSectionModule;
  export default module;
}
