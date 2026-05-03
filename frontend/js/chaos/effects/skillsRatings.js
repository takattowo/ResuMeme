import { randInt } from '../../rng.js';
export default {
  name: 'skillsRatings',
  targets: 'section',
  density: 1,
  apply(el, rng) {
    if (el.dataset.cvSection !== 'skills') return;
    for (const word of el.querySelectorAll('[data-cv-word]')) {
      const stars = randInt(rng, 1, 5);
      const span = document.createElement('span');
      span.className = 'fx-rating';
      span.textContent = '⭐'.repeat(stars);
      word.appendChild(span);
    }
  },
};
