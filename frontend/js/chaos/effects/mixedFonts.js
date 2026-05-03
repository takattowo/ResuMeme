import { pick } from '../../rng.js';
const FONTS = [
  '"Comic Sans MS", "Comic Neue", cursive',
  '"Papyrus", "Hieroglyphic", fantasy',
  '"Impact", "Charcoal", sans-serif',
  '"Brush Script MT", cursive',
  'monospace',
];
export default {
  name: 'mixedFonts',
  targets: 'section',
  density: 1,
  apply(el, rng) { el.style.fontFamily = pick(rng, FONTS); },
};
