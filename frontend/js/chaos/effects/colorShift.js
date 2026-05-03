import { pick } from '../../rng.js';

const COLORS = [
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2',
  '#2563eb', '#7c3aed', '#db2777', '#0d9488', '#65a30d',
  '#9333ea', '#0284c7', '#be185d',
];

export default {
  name: 'colorShift',
  targets: 'word',
  density: 0.07,
  apply(el, rng) {
    el.style.color = pick(rng, COLORS);
    el.style.fontWeight = '700';
  },
};
