import { randInt, pick } from '../../rng.js';
import { RIZZ_TIERS } from '../brainrot/vocab.js';

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
        `Rizz tier: ${pick(rng, RIZZ_TIERS)}`,
        `Skibidi-rate: ${randInt(rng, 70, 99)}%`,
        `Mogged today: ${randInt(rng, 5, 47)}`,
      ].join('\n');
      widget.textContent = text;
    }
    tick();
    setInterval(tick, 1500);
  },
};
