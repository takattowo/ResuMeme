import { pick } from '../../rng.js';

const BRAINROT_TEXTS = [
  '🦈🥿 SKIBIDI SIGMA RIZZ ALERT — ONLY IN OHIO BEHAVIOR DETECTED — FANUM TAX APPLIED 🐊✈️',
  '⚠️ TRALALERO TRALALA APPROVED — MEWING SINCE 2003 — GYATT FACTOR: MAX ⚠️',
  '🥁🌙 TUNG TUNG TUNG SAHUR — LOOKSMAXXED CANDIDATE — MOGGED 47 RECRUITERS 🥁🌙',
  '✨ NO CAP FR FR — CERTIFIED GIGACHAD — BUSSIN BUSSIN — GOATED ENERGY ✨',
];

export default {
  name: 'brainrotMarquee',
  targets: 'page',
  density: 0.3,
  apply(_el, rng) {
    const div = document.createElement('div');
    div.className = 'fx-marquee fx-marquee-brainrot';
    const inner = document.createElement('span');
    inner.textContent = pick(rng, BRAINROT_TEXTS);
    div.appendChild(inner);
    document.body.appendChild(div);
  },
};
