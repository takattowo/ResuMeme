import { randInt, pick } from '../../rng.js';

// Darker palette readable on the cream/white section panels.
const COLORS = ['#a31621', '#053c5e', '#1b512d', '#7b287d', '#b75d18', '#5b2333', '#1a1a1a'];

export default {
  name: 'wordCloud',
  targets: 'section',
  density: 1,
  apply(el, rng) {
    if (el.dataset.cvSection !== 'skills') return;
    el.classList.add('fx-wordcloud');
    for (const word of el.querySelectorAll('[data-cv-word]')) {
      word.style.fontSize = `${randInt(rng, 14, 22)}px`;
      word.style.transform = `rotate(${randInt(rng, -8, 8)}deg)`;
      word.style.color = pick(rng, COLORS);
    }
  },
};
