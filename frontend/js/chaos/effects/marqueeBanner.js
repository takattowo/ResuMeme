import { pick } from '../../rng.js';
const TEXTS = [
  '🔥 LIMITED TIME OFFER: HIRE THIS PERSON NOW 🔥',
  '⭐ TOP RATED ON LINKEDIN ⭐ 5/5 RECRUITERS AGREE ⭐',
  '🚨 ENHANCED CV ALERT: PROCEED WITH CAUTION 🚨',
  '🦈🥿 SIGMA GRINDSET DETECTED — GYATT FACTOR: MAXIMUM 🦈🥿',
  '🐊✈️ NO CAP THIS CANDIDATE BUSSIN — RIZZ LEVEL: GIGACHAD 🐊✈️',
  '🥁🌙 OHIO-CERTIFIED HIRE — MOGGED 47 OTHER APPLICANTS 🥁🌙',
];
export default {
  name: 'marqueeBanner',
  targets: 'page',
  density: 1,
  apply(_el, rng) {
    const div = document.createElement('div');
    div.className = 'fx-marquee';
    const inner = document.createElement('span');
    inner.textContent = pick(rng, TEXTS);
    div.appendChild(inner);
    document.body.appendChild(div);
  },
};
