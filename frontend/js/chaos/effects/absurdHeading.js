import { pick } from '../../rng.js';
import { BRAINROT_HEADINGS } from '../brainrot/vocab.js';

const ABSURD = [
  'DEFINITELY REAL EXPERIENCE',
  'HUMBLE ACCOLADES',
  'BUZZWORDS I HOLD STRONG OPINIONS ABOUT',
  'VERIFIED LEADERSHIP MOMENTS',
  'PROJECTS THAT EXISTED',
  'SKILLS (DEFINITELY)',
  'LITERATURE I HAVE PRETENDED TO READ',
  'MEETINGS I HAVE BEEN IN',
  'EMAILS I HAVE SENT (WITH ENERGY)',
  'PEOPLE WHO HAVE NOT SUED ME',
  'CERTIFIED HUMAN ACCOMPLISHMENTS',
  'POST-LINKEDIN ENLIGHTENMENT',
  'TIMES I LEFT A MEETING EARLY',
  'STAKEHOLDERS I HAVE SURVIVED',
  'SYNERGY FOOTNOTES',
];

export default {
  name: 'absurdHeading',
  targets: 'page',
  density: 1,
  apply(_el, rng) {
    const headings = Array.from(document.querySelectorAll('[data-cv-heading]'));
    if (headings.length === 0) return;
    const target = headings[Math.floor(rng() * headings.length)];
    const replacement = pick(rng, ABSURD.concat(BRAINROT_HEADINGS));

    target.replaceChildren();
    const parts = replacement.split(/(\s+)/);
    for (const part of parts) {
      if (/^\s+$/.test(part)) {
        target.appendChild(document.createTextNode(part));
      } else if (part) {
        const span = document.createElement('span');
        span.dataset.cvWord = '1';
        span.textContent = part;
        target.appendChild(span);
      }
    }
  },
};
