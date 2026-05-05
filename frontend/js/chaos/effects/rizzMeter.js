import { pick, randInt } from '../../rng.js';
import { RIZZ_TIERS } from '../brainrot/vocab.js';

export default {
  name: 'rizzMeter',
  targets: 'page',
  density: 0.5,
  apply(_el, rng) {
    const score = randInt(rng, 70, 100) / 10;       // 7.0 - 10.0
    const tier  = pick(rng, RIZZ_TIERS);
    const fill  = Math.round((score / 10) * 100);   // 70-100%

    const wrap = document.createElement('div');
    wrap.className = 'fx-rizz-meter';

    const label = document.createElement('div');
    label.className = 'fx-rizz-label';
    label.textContent = `RIZZ LEVEL: ${score.toFixed(1)}/10 · ${tier}`;

    const barWrap = document.createElement('div');
    barWrap.className = 'fx-rizz-bar';
    const barFill = document.createElement('div');
    barFill.className = 'fx-rizz-fill';
    barFill.style.width = `${fill}%`;
    barWrap.appendChild(barFill);

    wrap.append(label, barWrap);
    document.body.appendChild(wrap);
  },
};
