import { randInt, pick } from '../../rng.js';
const COLORS = ['#f0f', '#0ff', '#ff0', '#0f0', '#f00', '#00f', '#fa0'];
export default {
  name: 'wordCloud',
  targets: 'section',
  density: 1,
  apply(el, rng) {
    if (el.dataset.cvSection !== 'skills') return;
    el.classList.add('fx-wordcloud');
    for (const word of el.querySelectorAll('[data-cv-word]')) {
      word.style.fontSize = `${randInt(rng, 18, 32)}px`;
      word.style.transform = `rotate(${randInt(rng, -25, 25)}deg)`;
      word.style.color = pick(rng, COLORS);
    }
  },
};
