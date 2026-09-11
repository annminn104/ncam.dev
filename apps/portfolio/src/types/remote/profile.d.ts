// Type declarations for the federated `profile` remote: one module per home-page
// section, all with the same { ssr, hydrate, mount } shape (see
// apps/profile/src/lib/section-module.tsx).

interface ProfileSectionSSRResult {
  html: string;
  css: string;
}

interface ProfileSectionModule {
  ssr(): Promise<ProfileSectionSSRResult>;
  hydrate(target: HTMLElement): () => void;
  mount(target: HTMLElement): () => void;
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
