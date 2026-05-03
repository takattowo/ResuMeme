import { pick } from '../../rng.js';
const STAMPS = ['VERIFIED ✓', 'URGENT', 'AS SEEN ON LINKEDIN', 'PROFESSIONAL', 'CERTIFIED'];
export default {
  name: 'watermark',
  targets: 'page',
  density: 1,
  apply(_el, rng) {
    const div = document.createElement('div');
    div.className = 'fx-watermark';
    div.textContent = pick(rng, STAMPS);
    document.body.appendChild(div);
  },
};
