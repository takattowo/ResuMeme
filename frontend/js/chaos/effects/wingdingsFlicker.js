import { randInt } from '../../rng.js';
export default {
  name: 'wingdingsFlicker',
  targets: 'word',
  density: 0.015,
  apply(el, rng) {
    const intervalMs = randInt(rng, 2000, 8000);
    setInterval(() => {
      el.classList.add('fx-wingdings');
      setTimeout(() => el.classList.remove('fx-wingdings'), 200);
    }, intervalMs);
  },
};
