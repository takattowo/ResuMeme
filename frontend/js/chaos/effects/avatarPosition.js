import { pick } from '../../rng.js';

// Six deterministic positions. Top-right was the only previous spot.
const POSITIONS = [
  { top: '1.5rem', right: '1.5rem', left: 'auto', bottom: 'auto' },
  { top: '1.5rem', left: '1.5rem', right: 'auto', bottom: 'auto' },
  { bottom: '1.5rem', right: '1.5rem', top: 'auto', left: 'auto' },
  { bottom: '1.5rem', left: '1.5rem', top: 'auto', right: 'auto' },
  { top: '40%', right: '1rem', left: 'auto', bottom: 'auto' },
  { top: '40%', left: '1rem', right: 'auto', bottom: 'auto' },
];

export default {
  name: 'avatarPosition',
  targets: 'image',
  density: 1,
  apply(el, rng) {
    Object.assign(el.style, pick(rng, POSITIONS));
  },
};
