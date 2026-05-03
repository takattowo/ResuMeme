import { randInt } from '../../rng.js';
export default {
  name: 'randomCaps',
  targets: 'word',
  density: 0.20,
  apply(el, rng) {
    const text = el.textContent;
    let out = '';
    for (const ch of text) {
      out += randInt(rng, 0, 1) ? ch.toUpperCase() : ch.toLowerCase();
    }
    el.textContent = out;
  },
};
