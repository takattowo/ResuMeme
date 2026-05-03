import { randFloat } from '../../rng.js';
export default {
  name: 'randomRotation',
  targets: 'section',
  density: 1,
  apply(el, rng) {
    el.style.transform = `rotate(${randFloat(rng, -8, 8)}deg)`;
  },
};
