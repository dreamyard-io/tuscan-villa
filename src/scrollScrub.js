/**
 * scrollScrub.js
 * ---------------------------------------------------------------------------
 * Reusable scroll-scrubbed frame sequence painted onto a <canvas>. A tall
 * section provides the scroll track; a sticky canvas stays pinned to the
 * viewport while scroll position drives which frame is drawn (0 → first frame,
 * 1 → last frame, mapped linearly, fully bidirectional).
 *
 * A single shared driver (one scroll listener + one resize listener + one
 * requestAnimationFrame loop) ticks every instance, so N sections cost one set
 * of listeners rather than N.
 *
 * Vanilla ES module. No frameworks, no libraries.
 *
 *   import { initScrollScrub } from './scrollScrub.js';
 *   const scrub = initScrollScrub({ sectionEl, canvasEl, frameCount, framePathFn });
 *   // scrub.destroy();
 * ---------------------------------------------------------------------------
 */

/* =========================================================================
 * SHARED DRIVER — one scroll/resize listener + one rAF for ALL instances.
 * ========================================================================= */

const instances = new Set();
let rafId = 0;
let listening = false;

function tick() {
  rafId = 0;
  for (const inst of instances) inst._render();
}

/** Coalesce work into a single animation frame across all instances. */
function schedule() {
  if (rafId === 0) rafId = requestAnimationFrame(tick);
}

function onScroll() {
  schedule();
}

function onResize() {
  // Progress depends on innerHeight; force each instance to repaint.
  for (const inst of instances) inst._invalidate();
  schedule();
}

function startDriver() {
  if (listening) return;
  listening = true;
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
}

function stopDriverIfIdle() {
  if (instances.size > 0 || !listening) return;
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onResize);
  if (rafId !== 0) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  listening = false;
}

function registerInstance(inst) {
  instances.add(inst);
  startDriver();
  schedule(); // paint the newly active instance right away
}

function unregisterInstance(inst) {
  instances.delete(inst);
  stopDriverIfIdle();
}

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

/* =========================================================================
 * PER-INSTANCE
 * ========================================================================= */

/**
 * @typedef {Object} ScrollScrubConfig
 * @property {HTMLElement}          sectionEl        Tall scroll-track section.
 * @property {HTMLCanvasElement}    canvasEl         Sticky canvas to paint on.
 * @property {number}               frameCount       Number of frames.
 * @property {(i:number)=>string}   framePathFn      1-based index → frame URL.
 * @property {string}   [scrollHeight='500vh']       Section scroll-track height.
 * @property {number}   [preloadThreshold=1]         Frames to buffer before ready.
 * @property {boolean}  [lazy=false]                 Defer preload until near view.
 * @property {string}   [lazyRootMargin='100% 0px']  IO margin (~1 viewport early).
 * @property {number}   [frameWidth=0]               Native width (else derived).
 * @property {number}   [frameHeight=0]              Native height (else derived).
 * @property {(loaded:number,total:number)=>void} [onFrameLoaded]
 * @property {()=>void}                            [onReady]
 * @property {(progress:number,index:number)=>void} [onProgress]
 * @property {()=>void}                            [onComplete]  Fires once at last frame.
 * @returns {{ destroy: () => void }}
 */
export function initScrollScrub(config) {
  const {
    sectionEl,
    canvasEl,
    frameCount,
    framePathFn,
    scrollHeight = '500vh',
    preloadThreshold = 1,
    lazy = false,
    lazyRootMargin = '100% 0px',
    frameWidth = 0,
    frameHeight = 0,
    onFrameLoaded = null,
    onReady = null,
    onProgress = null,
    onComplete = null,
  } = config || {};

  if (!sectionEl || !canvasEl) {
    throw new Error('[scrollScrub] sectionEl and canvasEl are required.');
  }
  if (typeof framePathFn !== 'function' || !frameCount) {
    throw new Error('[scrollScrub] frameCount and framePathFn are required.');
  }

  const ctx = canvasEl.getContext('2d', { alpha: false });
  const reduced = prefersReducedMotion();

  // Section owns its scroll-track height here (the tunable knob). In reduced
  // motion collapse to one viewport — no point scrolling through a frozen frame.
  sectionEl.style.height = reduced ? '100vh' : scrollHeight;

  // Reduced motion only needs 1 frame; otherwise honour the caller's threshold.
  const threshold = reduced ? 1 : preloadThreshold;

  /* ---- State ---------------------------------------------------------- */
  const images = new Array(frameCount); // Image objects, 0-based
  let sized = Boolean(frameWidth && frameHeight);
  let loadedCount = 0;
  let ready = false;
  let completed = false;
  let currentIndex = -1; // last frame index drawn (guard)
  let registered = false;
  let preloadStarted = false;
  let destroyed = false;
  let observer = null;

  if (sized) {
    canvasEl.width = frameWidth;
    canvasEl.height = frameHeight;
  }

  /* ---- Drawing -------------------------------------------------------- */

  // Canvas internal resolution == native frame size (set from config or the
  // first decoded frame). CSS then stretches it with object-fit: cover.
  function sizeCanvasFrom(img) {
    canvasEl.width = img.naturalWidth;
    canvasEl.height = img.naturalHeight;
    sized = true;
  }

  function drawFrame(index) {
    const img = images[index];
    if (!img || !img.complete || img.naturalWidth === 0) return false;
    if (!sized) sizeCanvasFrom(img);
    ctx.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);
    return true;
  }

  /* ---- Scroll → frame index ------------------------------------------- */

  // Each instance derives its own progress from its own box vs. its own height.
  function progress() {
    const rect = sectionEl.getBoundingClientRect();
    const scrollable = sectionEl.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return 0;
    return clamp(-rect.top / scrollable, 0, 1); // -rect.top = distance scrolled in
  }

  function progressToIndex(p) {
    return Math.round(p * (frameCount - 1));
  }

  /* ---- Render (called by the shared driver) --------------------------- */

  function _render() {
    if (destroyed || !ready) return;

    const p = progress();
    const index = progressToIndex(p);

    // Progress hook fires every tick (phase thresholds can fall between two
    // rounded indices), so it must run before the frame guard.
    if (onProgress) onProgress(p, index);

    if (index === currentIndex) return; // GUARD: nothing to redraw
    if (!drawFrame(index)) return; // not decoded yet — keep the previous frame

    currentIndex = index;

    if (!completed && index === frameCount - 1) {
      completed = true;
      if (onComplete) onComplete();
    }
  }

  // Force a repaint of the current frame on the next tick (used on resize).
  function _invalidate() {
    currentIndex = -1;
  }

  /* ---- Readiness ------------------------------------------------------ */

  function markReady() {
    if (ready) return;
    ready = true;
    if (onReady) onReady();
    // Reduced motion shows a single static frame and never scrubs.
    if (!reduced && !registered) {
      currentIndex = -1;
      registerInstance(api);
      registered = true;
    }
  }

  /* ---- Preload -------------------------------------------------------- */

  function onImageLoaded(i) {
    if (destroyed) return;
    loadedCount += 1;
    if (onFrameLoaded) onFrameLoaded(loadedCount, frameCount);

    // Paint the first frame the moment it arrives (also the static reduced
    // -motion frame), so the canvas is never blank when reached.
    if (i === 0) drawFrame(0);

    if (!ready && loadedCount >= threshold) markReady();

    // If we're currently parked on a frame that just decoded, repaint it.
    if (ready && !reduced && i === progressToIndex(progress())) {
      currentIndex = -1;
      schedule();
    }
  }

  function onImageError(i) {
    if (destroyed) return;
    // Count errors toward progress so one missing frame can't stall readiness;
    // drawFrame() simply skips frames that never decoded.
    loadedCount += 1;
    if (onFrameLoaded) onFrameLoaded(loadedCount, frameCount);
    if (!ready && loadedCount >= threshold) markReady();
  }

  function startPreload() {
    if (preloadStarted || destroyed) return;
    preloadStarted = true;
    const count = reduced ? 1 : frameCount; // reduced motion: only the first frame
    for (let i = 0; i < count; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.addEventListener('load', () => onImageLoaded(i), { once: true });
      img.addEventListener('error', () => onImageError(i), { once: true });
      img.src = framePathFn(i + 1);
      images[i] = img;
    }
  }

  /* ---- Public instance handle (given to the shared driver) ------------ */

  const api = { _render, _invalidate, destroy };

  /* ---- Wire up -------------------------------------------------------- */

  if (lazy) {
    // Start loading ~1 viewport before the section scrolls into view.
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          startPreload();
          if (observer) {
            observer.disconnect();
            observer = null;
          }
        }
      },
      { root: null, rootMargin: lazyRootMargin, threshold: 0 }
    );
    observer.observe(sectionEl);
  } else {
    startPreload();
  }

  /* ---- Teardown (prevents leaks on re-init / HMR) --------------------- */

  function destroy() {
    if (destroyed) return;
    destroyed = true;

    if (registered) {
      unregisterInstance(api);
      registered = false;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Clearing src aborts in-flight decodes; { once: true } listeners are
    // freed with the image once we drop the reference.
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (img) img.src = '';
      images[i] = null;
    }
  }

  return { destroy };
}
