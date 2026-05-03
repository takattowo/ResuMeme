const TRIGGERS = ['leadership', 'synergy', 'leverage', 'stakeholder', 'innovative', 'transform', 'paradigm', 'spearheaded', 'visionary'];
export default {
  name: 'citationNeeded',
  targets: 'word',
  density: 1,
  apply(el) {
    const lower = el.textContent.toLowerCase();
    if (TRIGGERS.some((t) => lower.includes(t))) el.classList.add('fx-citation');
  },
};
