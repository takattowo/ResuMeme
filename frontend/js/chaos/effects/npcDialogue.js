import { pick, randInt } from '../../rng.js';
import { NPC_LINES } from '../brainrot/vocab.js';

function makeBubble(rng, fixedPosition = null) {
  const bubble = document.createElement('div');
  bubble.className = 'fx-npc-bubble';
  bubble.textContent = pick(rng, NPC_LINES);

  if (fixedPosition) {
    bubble.style.left = `${fixedPosition.x}vw`;
    bubble.style.top  = `${fixedPosition.y}vh`;
  } else {
    bubble.style.left = '1rem';
    bubble.style.bottom = '5.5rem';
  }
  document.body.appendChild(bubble);
  setTimeout(() => bubble.remove(), 4500);
}

export function spawnNpcBurst(rng, count = 5) {
  for (let i = 0; i < count; i++) {
    makeBubble(rng, { x: randInt(rng, 5, 80), y: randInt(rng, 10, 80) });
  }
}

export default {
  name: 'npcDialogue',
  targets: 'page',
  density: 0.5,
  apply(_el, rng) {
    let cycles = 0;
    const tick = () => {
      makeBubble(rng);
      cycles++;
      if (cycles < 3) setTimeout(tick, randInt(rng, 4000, 6000));
    };
    setTimeout(tick, randInt(rng, 1000, 3000));
  },
};
