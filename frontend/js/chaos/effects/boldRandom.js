export default {
  name: 'boldRandom',
  targets: 'word',
  density: 0.06,
  apply(el) {
    el.style.fontWeight = '900';
    el.style.fontSize = '1.15em';
  },
};
