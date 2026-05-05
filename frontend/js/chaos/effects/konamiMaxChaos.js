import { pick, randInt } from '../../rng.js';
import { spawnMascot } from './italianMascotInvasion.js';
import { spawnNpcBurst } from './npcDialogue.js';

const SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export default {
  name: 'konamiMaxChaos',
  targets: 'page',
  density: 1,
  apply(_el, rng) {
    let buf = [];
    document.addEventListener('keydown', (e) => {
      buf.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      buf = buf.slice(-SEQUENCE.length);
      if (buf.join(',') === SEQUENCE.join(',')) trigger(rng);
    });
  },
};

function trigger(rng) {
  document.documentElement.style.setProperty('--chaos-speed', '2');
  document.documentElement.dataset.brainrotMax = '1';
  fireConfetti(rng);
  playDialup();
  escalateBrainrot(rng);
}

function escalateBrainrot(rng) {
  spawnMascot(rng, 12);
  spawnNpcBurst(rng, 5);
}

function fireConfetti(rng) {
  const colors = ['#f0f', '#0ff', '#ff0', '#f00', '#0f0'];
  for (let i = 0; i < 80; i++) {
    const c = document.createElement('div');
    c.className = 'fx-confetti';
    c.style.background = pick(rng, colors);
    c.style.left = `${randInt(rng, 0, 100)}vw`;
    c.style.top = '-10vh';
    c.style.animation = `confetti-fall ${randInt(rng, 2000, 4000)}ms linear forwards`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4500);
  }
}

function playDialup() {
  // Konami keypress counts as a user interaction, so audio is permitted.
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(900, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(2400, ctx.currentTime + 1.5);
  gain.gain.setValueAtTime(0.03, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 1.5);
}
