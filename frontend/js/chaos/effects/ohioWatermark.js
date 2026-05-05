import { pick } from '../../rng.js';
import { OHIO_PHRASES } from '../brainrot/vocab.js';

export default {
  name: 'ohioWatermark',
  targets: 'page',
  density: 0.3,
  apply(_el, rng) {
    const layer = document.createElement('div');
    layer.className = 'fx-ohio-watermark';
    const phrase = pick(rng, OHIO_PHRASES);
    // Repeat the phrase several times so the diagonal tiling reads everywhere.
    layer.textContent = `${phrase}   `.repeat(40);
    document.body.appendChild(layer);
  },
};
