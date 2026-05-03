export default {
  name: 'refsRoast',
  targets: 'word',
  density: 1,
  apply(el) {
    const txt = el.textContent.toLowerCase();
    if (txt.includes('references')) {
      el.textContent = 'References: 🤷';
    }
  },
};
