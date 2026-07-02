import './style.css';
import { initHeroScrollSequence } from './heroScrollSequence.js';
import { initScrollScrub } from './scrollScrub.js';
import { initScrollReveal } from './scrollReveal.js';

/* ── Hero ──────────────────────────────────────────────────────────────
 * 120-frame ruin → villa scrub with its story text layer. */
const hero = initHeroScrollSequence({
  onComplete() {
    // Fired once when the scrub reaches the final frame (finished villa).
    // Later: kick off the day → evening → night light-cycle autoplay here.
    // e.g. startLightCycle();
    console.debug('[hero] reached final frame — light-cycle hook');
  },
});

/* ── Fly-through ───────────────────────────────────────────────────────
 * A separate scrubbed section (camera flies through the house into the
 * garden). Shares the hero's scroll driver via initScrollScrub. Frames are
 * lazy-loaded ~1 viewport before the section, and are expected at
 * /flythrough_webp/frame_001.webp … frame_100.webp (public/flythrough_webp/). */
const FLYTHROUGH = {
  FRAME_COUNT: 100,
  // Base-aware so it resolves under a subpath (e.g. GitHub Pages /repo/).
  FRAMES_PATH: `${import.meta.env.BASE_URL}flythrough_webp/`,
  SECTION_HEIGHT: '300vh', // shorter track than the hero — simpler motion
};

const flyPath = (i) =>
  `${FLYTHROUGH.FRAMES_PATH}frame_${String(i).padStart(3, '0')}.webp`;

const flySection = document.getElementById('flythrough');
const flyCanvas = document.getElementById('flythrough-canvas');

const flythrough =
  flySection && flyCanvas
    ? initScrollScrub({
        sectionEl: flySection,
        canvasEl: flyCanvas,
        frameCount: FLYTHROUGH.FRAME_COUNT,
        framePathFn: flyPath,
        scrollHeight: FLYTHROUGH.SECTION_HEIGHT,
        lazy: true, // don't fetch frames until the user nears the section
        lazyRootMargin: '100% 0px', // start ~1 viewport early
      })
    : null;

/* ── The Story ─────────────────────────────────────────────────────────
 * Quiet reading section between hero and fly-through. Elements fade + rise in
 * once as they enter the viewport. */
const storyReveal = initScrollReveal({ threshold: 0.2 });

/* The /images/ story placeholders 404 until real photography lands — hide a
 * failed <img> so the figure shows its clean stone-tone block instead of the
 * browser's broken-image icon. */
for (const img of document.querySelectorAll('.story-block__media img')) {
  const markMissing = () => img.classList.add('img-missing');
  if (img.complete && img.naturalWidth === 0) markMissing();
  else img.addEventListener('error', markMissing, { once: true });
}

/* ── Vite HMR: dispose instances before the module re-evaluates ──────── */
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    hero.destroy();
    if (flythrough) flythrough.destroy();
    storyReveal.destroy();
  });
}
