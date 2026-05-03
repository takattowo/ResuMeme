import { randInt, shuffle } from '../../rng.js';

const MAX_STARRED = 4;

export default {
  name: 'skillsRatings',
  targets: 'section',
  density: 1,
  apply(el, rng) {
    if (el.dataset.cvSection !== 'skills') return;
    const words = Array.from(el.querySelectorAll('[data-cv-word]'));
    const sampled = shuffle(rng, words).slice(0, Math.min(MAX_STARRED, words.length));
    for (const word of sampled) {
      const stars = randInt(rng, 1, 5);
      const span = document.createElement('span');
      span.className = 'fx-rating';
      span.textContent = '⭐'.repeat(stars);
      word.appendChild(span);
    }
  },
};
