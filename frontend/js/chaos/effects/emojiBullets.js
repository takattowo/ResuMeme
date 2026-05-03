import { pick } from '../../rng.js';
const BULLETS = ['🔥', '💯', '✨', '🚀'];
export default {
  name: 'emojiBullets',
  targets: 'section',
  density: 1,
  apply(el, rng) {
    if (!['experience', 'education'].includes(el.dataset.cvSection)) return;
    for (const p of el.querySelectorAll('p')) {
      const bullet = pick(rng, BULLETS);
      p.textContent = `${bullet} ${p.textContent}`;
    }
  },
};
