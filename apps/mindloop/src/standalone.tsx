import { mount } from './mount';

// Standalone dev preview of the remote on its own (`pnpm dev` on this app).
const el = document.getElementById('app');
if (el) mount(el);
