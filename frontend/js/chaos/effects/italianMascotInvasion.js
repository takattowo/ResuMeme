import { pick, randInt } from '../../rng.js';
import { ITALIAN_MASCOTS } from '../brainrot/vocab.js';

// Corners-only positioning. CV content lives in the centered #cv-root
// (max-width 800px), so dropping mascots near the viewport edges keeps
// the reading column clear at any width.
const CORNERS = [
  { hSide: 'left',  vSide: 'top'    },
  { hSide: 'right', vSide: 'top'    },
  { hSide: 'left',  vSide: 'bottom' },
  { hSide: 'right', vSide: 'bottom' },
];

export function spawnMascot(rng, count = 1) {
  for (let i = 0; i < count; i++) {
    const mascot = pick(rng, ITALIAN_MASCOTS);
    const corner = pick(rng, CORNERS);
    const card = document.createElement('div');
    card.className = 'fx-mascot-card';
    card.style[corner.hSide] = `${randInt(rng, 1, 4)}vw`;
    card.style[corner.vSide] = `${randInt(rng, 6, 18)}vh`;
    card.style.animationDelay = `${randInt(rng, 0, 4000)}ms`;

    const emoji = document.createElement('span');
    emoji.className = 'fx-mascot-emoji';
    emoji.textContent = mascot.emoji;

    const name = document.createElement('span');
    name.className = 'fx-mascot-name';
    name.textContent = mascot.name;

    const tag = document.createElement('span');
    tag.className = 'fx-mascot-tag';
    tag.textContent = mascot.tag;

    card.append(emoji, name, tag);
    document.body.appendChild(card);
  }
}

export default {
  name: 'italianMascotInvasion',
  targets: 'page',
  density: 1,
  apply(_el, rng) {
    spawnMascot(rng, randInt(rng, 1, 3));
  },
};
