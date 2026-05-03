import { shuffle } from '../rng.js';
import { EFFECTS } from './registry.js';

const SELECTORS = {
  page: 'body',
  section: '[data-cv-section]',
  word: '[data-cv-word]',
  heading: '[data-cv-heading]',
  image: '[data-cv-avatar]',
};

export function applyChaos(rng, ctx) {
  for (const effect of EFFECTS) {
    try {
      const targets = collectTargets(effect.targets);
      const density = typeof effect.density === 'number' ? effect.density : 1;
      const sampled = sampleTargets(rng, targets, density);
      for (const el of sampled) {
        effect.apply(el, rng, ctx);
      }
    } catch (err) {
      console.error(`Effect "${effect.name}" failed:`, err);
    }
  }
}

function collectTargets(kind) {
  if (kind === 'page' || kind === 'body') {
    return [document.body];
  }
  const selector = SELECTORS[kind];
  if (!selector) return [];
  return Array.from(document.querySelectorAll(selector));
}

function sampleTargets(rng, targets, density) {
  if (density >= 1) return targets;
  if (density <= 0) return [];
  const shuffled = shuffle(rng, targets);
  const count = Math.max(1, Math.round(targets.length * density));
  return shuffled.slice(0, count);
}
