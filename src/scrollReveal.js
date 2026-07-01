/**
 * scrollReveal.js
 * ---------------------------------------------------------------------------
 * One-shot reveal for elements marked with [data-reveal]: they fade + rise into
 * place the first time they enter the viewport, then stop being observed. The
 * motion itself lives in CSS; this just toggles the `is-revealed` class.
 *
 * Honours prefers-reduced-motion by revealing everything immediately.
 * Vanilla ES module. No libraries.
 * ---------------------------------------------------------------------------
 */

export function initScrollReveal(opts = {}) {
  const selector = opts.selector || '[data-reveal]';
  const threshold = opts.threshold ?? 0.2;
  const els = Array.from(document.querySelectorAll(selector));
  if (els.length === 0) return { destroy() {} };

  // Reduced motion: skip the animation, show everything at once.
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    for (const el of els) el.classList.add('is-revealed');
    return { destroy() {} };
  }

  const io = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-revealed');
        obs.unobserve(entry.target); // reveal once, then forget it
      }
    },
    { threshold }
  );

  for (const el of els) io.observe(el);

  return {
    destroy() {
      io.disconnect();
    },
  };
}
