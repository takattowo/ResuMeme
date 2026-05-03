export default {
  name: 'sectionWobble',
  targets: 'section',
  density: 1,
  apply(el) {
    el.addEventListener('mouseenter', () => el.classList.add('fx-wobble'));
    el.addEventListener('mouseleave', () => el.classList.remove('fx-wobble'));
  },
};
