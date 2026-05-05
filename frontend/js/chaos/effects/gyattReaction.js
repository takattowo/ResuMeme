// Density-driven; orchestrator passes one [data-cv-word] element per call.
export default {
  name: 'gyattReaction',
  targets: 'word',
  density: 0.04,
  apply(el) {
    if (el.classList.contains('fx-gyatt')) return;
    el.classList.add('fx-gyatt');
  },
};
