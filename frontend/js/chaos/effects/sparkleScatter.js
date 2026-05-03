import { randInt, pick } from '../../rng.js';
const EMOJI = ['✨', '⭐', '💫', '🌟', '🎉', '💯'];
export default {
  name: 'sparkleScatter',
  targets: 'page',
  density: 1,
  apply(_el, rng) {
    for (let i = 0; i < 30; i++) {
      const s = document.createElement('span');
      s.className = 'fx-sparkle';
      s.textContent = pick(rng, EMOJI);
      s.style.top = `${randInt(rng, 0, 100)}vh`;
      s.style.left = `${randInt(rng, 0, 100)}vw`;
      s.style.transform = `rotate(${randInt(rng, 0, 360)}deg)`;
      document.body.appendChild(s);
    }
  },
};
