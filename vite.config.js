import { defineConfig } from 'vite';

// Vanilla setup — no framework plugins needed.
// `public/` is served at the web root, so frames live at <base>frames_webp/*.
// On GitHub Pages the site is served from /tuscan-villa/, so the build uses
// that base; local dev stays at '/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/tuscan-villa/' : '/',
  server: { open: true },
}));
