import { randFloat } from '../../rng.js';
export default {
  name: 'randomRotation',
  targets: 'section',
  density: 0.3,
  apply(el, rng) {
    el.style.transform = `rotate(${randFloat(rng, -2, 2)}deg)`;
  },
};
