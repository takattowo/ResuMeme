import { randInt, pick } from '../../rng.js';
const BADGES = [
  '✓ Verified by ChatGPT',
  '✓ Top 1% LinkedIn',
  '✓ FAANG-Adjacent™',
  '✓ Recruiter Approved',
  '✓ ATS-Compatible*',
  '✓ Big Brain Certified',
  '✓ GIGACHAD CERTIFIED',
  '✓ OHIO PROFESSIONAL',
  '✓ MEWING CERTIFIED',
  '✓ SIGMA GRINDSET™',
  '✓ NO CAP VERIFIED',
];
export default {
  name: 'fakeBadges',
  targets: 'section',
  density: 0.2,
  apply(el, rng) {
    const badge = document.createElement('span');
    badge.className = 'fx-badge';
    badge.textContent = pick(rng, BADGES);
    badge.style.top = `${randInt(rng, -10, 5)}px`;
    badge.style.right = `${randInt(rng, -10, 30)}px`;
    if (!el.style.position) el.style.position = 'relative';
    el.appendChild(badge);
  },
};
