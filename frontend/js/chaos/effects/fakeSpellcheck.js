const BUZZWORDS = ['synergy', 'leverage', 'stakeholder', 'paradigm', 'holistic', 'pivot', 'bandwidth'];
export default {
  name: 'fakeSpellcheck',
  targets: 'word',
  density: 1,
  apply(el) {
    const lower = el.textContent.toLowerCase();
    if (BUZZWORDS.some((b) => lower.includes(b))) el.classList.add('fx-spellcheck');
  },
};
