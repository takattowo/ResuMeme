// Convert some bullet-style sections into numbered lists. Marks the
// section with .fx-numbered-section; the CSS uses counter-increment to
// number paragraphs. Mutually exclusive with emojiBullets, since emojiBullets
// checks for this class and skips.

const BULLET_SECTIONS = [
  'experience', 'education', 'projects', 'certifications', 'awards', 'volunteer', 'freelance',
];

export default {
  name: 'numberedList',
  targets: 'section',
  density: 0.3,
  apply(el) {
    if (!BULLET_SECTIONS.includes(el.dataset.cvSection)) return;
    el.classList.add('fx-numbered-section');
  },
};
