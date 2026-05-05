import { pick, randInt } from '../../rng.js';

const LABELS = [
  'LOOKSMAXXED · MOGGED 47 RECRUITERS',
  'CERTIFIED GIGACHAD · CANINE TILT 9.2°',
  'JAW: HUNTER-EYES · BONESMASHED CV',
  'MEWING SINCE 2003 · CONFIRMED SIGMA',
];

export default {
  name: 'looksmaxxingBadge',
  targets: 'page',
  density: 0.4,
  apply(_el, rng) {
    const badge = document.createElement('div');
    badge.className = 'fx-looksmaxxing';
    badge.textContent = pick(rng, LABELS);
    badge.style.right = `${randInt(rng, 12, 80)}px`;
    document.body.appendChild(badge);
  },
};
