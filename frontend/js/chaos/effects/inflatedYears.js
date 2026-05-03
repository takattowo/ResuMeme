import { randInt } from '../../rng.js';
export default {
  name: 'inflatedYears',
  targets: 'word',
  density: 1,
  apply(el, rng) {
    const txt = el.textContent;
    const match = txt.match(/^(\d{1,2})$/);
    if (match && parseInt(match[1], 10) <= 50) {
      el.textContent = randInt(rng, 0, 1) ? '999+' : String(parseInt(match[1], 10) * randInt(rng, 2, 10));
    }
  },
};
