import { pick, randInt } from '../../rng.js';
import { ITALIAN_MASCOTS } from '../brainrot/vocab.js';

export function spawnMascot(rng, count = 1) {
  for (let i = 0; i < count; i++) {
    const mascot = pick(rng, ITALIAN_MASCOTS);
    const card = document.createElement('div');
    card.className = 'fx-mascot-card';
    card.style.left = `${randInt(rng, 2, 80)}vw`;
    card.style.top  = `${randInt(rng, 8, 80)}vh`;
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
