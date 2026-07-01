/**
 * heroScrollSequence.js
 * ---------------------------------------------------------------------------
 * The hero: a scroll-scrubbed 120-frame WebP sequence (ruin → finished villa)
 * plus the hero-specific chrome — a loading indicator and a scroll-synced story
 * text layer. The scrubbing itself is delegated to the generic initScrollScrub;
 * this module just wires the hero's UX to its callbacks.
 *
 *   import { initHeroScrollSequence } from './heroScrollSequence.js';
 *   const hero = initHeroScrollSequence({ onComplete: () => {} });
 *   // hero.destroy();
 * ---------------------------------------------------------------------------
 */

import { initScrollScrub } from './scrollScrub.js';

/* =========================================================================
 * CONFIGURATION
 * ========================================================================= */

const HERO = {
  FRAME_COUNT: 120,
  // Base-aware so it resolves under a subpath (e.g. GitHub Pages /repo/).
  FRAMES_PATH: `${import.meta.env.BASE_URL}frames_webp/`,
  FRAME_PREFIX: 'frame_',
  FRAME_EXT: '.webp',
  FRAME_INDEX_PAD: 3, // frame_001 → 3 digits

  // Native pixel size of a frame == canvas internal resolution.
  FRAME_WIDTH: 1280,
  FRAME_HEIGHT: 714,

  SECTION_HEIGHT: '500vh', // scroll-track length

  // Frames to buffer before revealing the hero and enabling scrubbing.
  PRELOAD_THRESHOLD: 30,

  // ── Scroll-synced text layer (all thresholds in progress space [0, 1]) ──
  STORY: {
    // Static header (eyebrow + H1 + sub) stays up until scroll passes this,
    // then fades out so the story text can take the scene.
    HEADER_HIDE_ABOVE: 0.1,

    // No story line appears until scroll passes this — sits just above
    // HEADER_HIDE_ABOVE so the header has finished fading before the first
    // beat arrives (otherwise the H1 and story text clash at the start).
    STORY_START_ABOVE: 0.14,

    // Story phases distributed across [STORY_START_ABOVE, 1]. One line visible
    // at a time; order must match the [data-hero-story-item] DOM order.
    PHASES: [
      { until: 0.36 }, // "For decades, it stood silent."
      { until: 0.62 }, // "Then, careful hands began."
      { until: 0.9 }, // "Stone by stone, light by light."
      { until: 1.01 }, // "Welcome home."
    ],

    // Final block (CTA + micro-details) fades in from this progress onward.
    FINAL_FROM: 0.9,
  },
};

/** Build the URL for frame `i` (1-based). */
function heroFramePath(i) {
  const n = String(i).padStart(HERO.FRAME_INDEX_PAD, '0');
  return `${HERO.FRAMES_PATH}${HERO.FRAME_PREFIX}${n}${HERO.FRAME_EXT}`;
}

/* =========================================================================
 * MAIN
 * ========================================================================= */

/**
 * Initialise the hero scroll sequence.
 *
 * @param {Object}      [opts]
 * @param {HTMLElement} [opts.section]   Scroll-track section (default #hero-sequence).
 * @param {Function}    [opts.onComplete] Fired once when scrubbing first reaches
 *                                        the final frame — wire the day→evening→
 *                                        night light-cycle autoplay here.
 * @returns {{ destroy: () => void }}
 */
export function initHeroScrollSequence(opts = {}) {
  const section = opts.section || document.getElementById('hero-sequence');
  if (!section) {
    throw new Error(
      '[heroScrollSequence] No scroll section found (#hero-sequence).'
    );
  }

  const onComplete =
    typeof opts.onComplete === 'function' ? opts.onComplete : () => {};

  /* ---- DOM lookups ---------------------------------------------------- */
  const canvas = section.querySelector('[data-hero-canvas]');
  const loaderBar = section.querySelector('[data-hero-loader-bar]');
  const loaderText = section.querySelector('[data-hero-loader-text]');
  const storyHeader = section.querySelector('[data-hero-header]');
  const storyItems = Array.from(
    section.querySelectorAll('[data-hero-story-item]')
  );
  const storyFinal = section.querySelector('[data-hero-final]');

  if (!canvas) {
    throw new Error('[heroScrollSequence] Missing [data-hero-canvas].');
  }

  /* ---- Loader --------------------------------------------------------- */

  function updateLoader(loaded, total) {
    const pct = Math.round((loaded / total) * 100);
    if (loaderBar) loaderBar.style.width = `${pct}%`;
    if (loaderText) loaderText.textContent = `${pct}%`;
  }

  function revealAndEnable() {
    section.classList.add('is-ready'); // CSS: fade the loader out
    document.documentElement.classList.remove('hero-locked'); // allow scrolling
  }

  /* ---- Story text layer (driven by scrub progress) -------------------- */

  let currentPhase = -1; // active story-line index (-1 = none)
  let headerHidden = false;
  let finalShown = false;

  // Which story phase is active for a given progress, or -1 while the header
  // is still on screen (nothing shown until STORY_START_ABOVE).
  function phaseForProgress(p) {
    if (p < HERO.STORY.STORY_START_ABOVE) return -1;
    const phases = HERO.STORY.PHASES;
    for (let i = 0; i < phases.length; i++) {
      if (p < phases[i].until) return i;
    }
    return phases.length - 1;
  }

  // Sync the overlay to progress. Each branch is guarded so we only touch the
  // DOM when state actually changes — CSS transitions do the fades.
  function updateStory(p) {
    const hideHeader = p > HERO.STORY.HEADER_HIDE_ABOVE;
    if (hideHeader !== headerHidden) {
      headerHidden = hideHeader;
      if (storyHeader) storyHeader.classList.toggle('is-hidden', hideHeader);
    }

    const phase = phaseForProgress(p);
    if (phase !== currentPhase) {
      currentPhase = phase;
      for (let i = 0; i < storyItems.length; i++) {
        storyItems[i].classList.toggle('is-active', i === phase);
      }
    }

    const showFinal = p >= HERO.STORY.FINAL_FROM;
    if (showFinal !== finalShown) {
      finalShown = showFinal;
      if (storyFinal) storyFinal.classList.toggle('is-visible', showFinal);
    }
  }

  /* ---- Wire up -------------------------------------------------------- */

  // Block scrolling until enough frames are buffered (removed in onReady).
  document.documentElement.classList.add('hero-locked');
  updateLoader(0, HERO.FRAME_COUNT);

  const scrub = initScrollScrub({
    sectionEl: section,
    canvasEl: canvas,
    frameCount: HERO.FRAME_COUNT,
    framePathFn: heroFramePath,
    scrollHeight: HERO.SECTION_HEIGHT,
    preloadThreshold: HERO.PRELOAD_THRESHOLD,
    frameWidth: HERO.FRAME_WIDTH,
    frameHeight: HERO.FRAME_HEIGHT,
    onFrameLoaded: updateLoader,
    onReady: revealAndEnable,
    onProgress: (p) => updateStory(p),
    onComplete,
  });

  function destroy() {
    scrub.destroy();
    document.documentElement.classList.remove('hero-locked');
  }

  return { destroy };
}
