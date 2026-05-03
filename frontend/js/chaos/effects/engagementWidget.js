import { randInt } from '../../rng.js';
export default {
  name: 'engagementWidget',
  targets: 'page',
  density: 1,
  apply(_el, rng) {
    const widget = document.createElement('div');
    widget.className = 'fx-engagement-widget';
    document.body.appendChild(widget);

    function tick() {
      const text = [
        `Recruiters viewing: ${randInt(rng, 30, 99)} ↗`,
        `Buzzword saturation: ${randInt(rng, 80, 99)}%`,
        `Hire probability: ${randInt(rng, 100, 200)}%`,
        `Synergy index: ${randInt(rng, 9000, 9999)}`,
      ].join('\n');
      widget.textContent = text;
    }
    tick();
    setInterval(tick, 1500);
  },
};
