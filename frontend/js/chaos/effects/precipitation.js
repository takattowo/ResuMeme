import { pick, randInt, randFloat } from '../../rng.js';

// Each set is a self-consistent particle theme. Rolled per-link via the
// seeded RNG so the same URL always shows the same flavour.
const SETS = [
  ['💧', '💦'],          // rain
  ['❄️', '✨', '⭐'],    // snow + sparkles
  ['🍂', '🍁'],          // autumn leaves
  ['🌸', '🌺', '🌷'],    // petals
  ['🦋', '🐝'],          // butterflies and bees
  ['💸', '💰', '🤑'],    // money rain (on-brand)
];

const COUNT_MIN = 10;
const COUNT_MAX = 16;

export default {
  name: 'precipitation',
  targets: 'page',
  density: 1,
  apply(_el, rng) {
    const set = pick(rng, SETS);
    const count = randInt(rng, COUNT_MIN, COUNT_MAX);

    const container = document.createElement('div');
    container.className = 'fx-precip-container';

    for (let i = 0; i < count; i++) {
      const drop = document.createElement('span');
      drop.className = 'fx-precip-drop';
      drop.textContent = pick(rng, set);
      drop.style.left = `${randFloat(rng, 0, 100)}vw`;
      drop.style.fontSize = `${randInt(rng, 14, 22)}px`;
      drop.style.animationDuration = `${randFloat(rng, 8, 16)}s`;
      // Negative delay so the staggered start positions look natural
      // immediately on load (no initial gap before first drop).
      drop.style.animationDelay = `-${randFloat(rng, 0, 16)}s`;
      drop.style.opacity = randFloat(rng, 0.5, 0.85).toFixed(2);
      container.appendChild(drop);
    }

    document.body.appendChild(container);
  },
};
