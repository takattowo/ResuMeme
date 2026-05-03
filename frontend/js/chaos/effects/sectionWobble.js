import { shuffle } from '../../rng.js';

export default {
  name: 'sectionWobble',
  targets: 'section',
  density: 1,
  apply(el, rng) {
    const words = Array.from(el.querySelectorAll('[data-cv-word]'));
    if (words.length === 0) return;
    const chosen = shuffle(rng, words).slice(0, Math.min(3, words.length));

    el.addEventListener('mouseenter', () => {
      for (const w of chosen) w.classList.add('fx-wobble');
    });
    el.addEventListener('mouseleave', () => {
      for (const w of chosen) w.classList.remove('fx-wobble');
    });
  },
};
