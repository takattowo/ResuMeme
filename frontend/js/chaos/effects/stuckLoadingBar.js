export default {
  name: 'stuckLoadingBar',
  targets: 'page',
  density: 1,
  apply() {
    const bar = document.createElement('div');
    bar.className = 'fx-loading-bar';
    document.body.appendChild(bar);
  },
};
