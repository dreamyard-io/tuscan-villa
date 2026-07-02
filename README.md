# Tuscan Villa

**Live:** https://dreamyard-io.github.io/tuscan-villa/

A scroll-scrubbed hero for a restored Tuscan villa. As you scroll, a 120-frame
WebP sequence (ruin → build → finished villa) is painted onto a `<canvas>`,
driven by scroll position. A synchronised text layer fades a short story through
four beats, over a full-width editorial header and a final CTA. Below it: "The
Story", a quiet reading section with scroll reveals, and a lazy-loaded 100-frame
fly-through.

Vanilla JS + Vite. No frameworks, no runtime dependencies.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # preview the build
```

## Structure

```
index.html                    markup: nav, hero, "The Story", fly-through
src/main.js                   boots hero + fly-through + reveals, HMR teardown
src/scrollScrub.js            reusable scroll-scrub engine (shared driver)
src/heroScrollSequence.js     hero wrapper: loader + story layer over scrollScrub
src/scrollReveal.js           one-shot IntersectionObserver reveal ([data-reveal])
src/style.css                 all styling + type scale (CSS variables)
public/frames_webp/           hero frames        (frame_001…120.webp)
public/flythrough_webp/       fly-through frames (frame_001…100.webp)
public/images/                "The Story" photography (placeholders, to follow)
```

### `initScrollScrub(config)`

Both sections share one engine. It owns preload, scroll→frame mapping, the
draw guard, resize, reduced-motion, and lazy-loading — and a **single shared
scroll/resize listener + rAF** ticks every instance (not one per section).

```js
initScrollScrub({
  sectionEl, canvasEl, frameCount, framePathFn,   // required
  scrollHeight, preloadThreshold, frameWidth/Height,
  lazy, lazyRootMargin,                            // IntersectionObserver preload
  onFrameLoaded, onReady, onProgress, onComplete,  // callbacks
});
```

Each instance derives its own progress from its own `getBoundingClientRect`
against its own height, so sections scrub independently. `prefers-reduced-motion`
collapses a section to one viewport and shows a single static frame (no scrub).

Hero tuning lives in `HERO` at the top of `heroScrollSequence.js` (frame count/
path, section height, preload threshold, story phase thresholds); fly-through
tuning in `FLYTHROUGH` in `main.js`. Visual tokens are the `:root` variables in
`style.css` (colours, fluid type scale, `--edge-x`).

## Extending

`initHeroScrollSequence({ onComplete })` fires `onComplete` once when the scrub
reaches the final frame — wire the planned day → evening → night light-cycle
autoplay there (see the stub in `src/main.js`).

## Deploy

Every push to `main` builds and deploys to GitHub Pages via
`.github/workflows/deploy.yml` (Vite `base: /tuscan-villa/` in production).

## Notes

- Most nav links, the brand, and the primary CTA (`#contact`) are placeholders;
  "The Story" nav link and the ghost CTA point to `#story`.
- The `/images/story-*.jpg` photos are placeholders — drop real photography
  into `public/images/` and they appear (missing images are hidden gracefully).
- Respects `prefers-reduced-motion` (static first frames, no scrub, reveals
  shown immediately). Uses no `localStorage`/`sessionStorage`.
- Only `public/` assets are needed to run or deploy; raw source media
  (`*.mp4` renders etc.) in the project root is git-ignored.
