export default {
  name: 'letterSpread',
  targets: 'word',
  density: 0.04,
  apply(el) {
    el.style.letterSpacing = '0.4em';
    el.style.marginRight = '0.4em';
  },
};
