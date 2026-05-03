import { pick } from '../../rng.js';
const BULLETS = ['🔥', '💯', '✨', '🚀'];
export default {
  name: 'emojiBullets',
  targets: 'section',
  density: 1,
  apply(el, rng) {
    const BULLET_SECTIONS = ['experience', 'education', 'projects', 'certifications', 'awards', 'volunteer', 'freelance'];
    if (!BULLET_SECTIONS.includes(el.dataset.cvSection)) return;
    if (el.classList.contains('fx-numbered-section')) return;
    for (const p of el.querySelectorAll('p')) {
      const bullet = pick(rng, BULLETS);
      p.textContent = `${bullet} ${p.textContent}`;
    }
  },
};
