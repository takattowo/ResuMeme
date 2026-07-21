import { pick, seededRng } from './rng.js';

export const THEMES = Object.freeze([
  'boardroom',
  'terminal',
  'tabloid',
  'luxury',
  'bubblegum',
  'blueprint',
]);

export const STYLES = Object.freeze(['polished', 'brutal', 'editorial', 'retro']);

export const PRESENTATION_MODES = Object.freeze(['modern', 'professional', 'chaos']);

export const LAYOUTS = Object.freeze({
  classic: Object.freeze(['hero', 'stats', 'experience', 'portfolio', 'testimonials', 'contact', 'raw']),
  split: Object.freeze(['hero', 'experience', 'portfolio', 'contact', 'stats', 'testimonials', 'raw']),
  magazine: Object.freeze(['hero', 'testimonials', 'experience', 'portfolio', 'stats', 'contact', 'raw']),
  dashboard: Object.freeze(['stats', 'experience', 'portfolio', 'hero', 'contact', 'testimonials', 'raw']),
});

const LAYOUT_NAMES = Object.freeze(Object.keys(LAYOUTS));

const PRESETS = Object.freeze({
  modern: Object.freeze({ theme: 'blueprint', style: 'polished', layout: 'split' }),
  professional: Object.freeze({ theme: 'boardroom', style: 'editorial', layout: 'classic' }),
});

export function normalizePresentationMode(mode) {
  return PRESENTATION_MODES.includes(mode) ? mode : 'chaos';
}

export function getPresentation(id, sections = [], requestedMode = 'chaos') {
  const seed = String(id ?? '');
  const mode = normalizePresentationMode(requestedMode);
  const preset = PRESETS[mode];
  const layout = preset?.layout || pick(seededRng(`${seed}:layout:v1`), LAYOUT_NAMES);

  return {
    mode,
    theme: preset?.theme || pick(seededRng(`${seed}:theme:v1`), THEMES),
    style: preset?.style || pick(seededRng(`${seed}:style:v1`), STYLES),
    layout,
    sectionOrder: orderSections(layout, sections),
  };
}

export function orderSections(layout, sections) {
  const preferred = LAYOUTS[layout] || LAYOUTS.classic;
  const ranks = new Map(preferred.map((section, index) => [section, index]));

  const rank = (section) => {
    if (section === 'identity') return -1;
    if (section === 'actions') return Number.MAX_SAFE_INTEGER;
    return ranks.get(section) ?? preferred.length;
  };

  return sections
    .map((section, index) => ({ section, index }))
    .sort((a, b) => rank(a.section) - rank(b.section) || a.index - b.index)
    .map(({ section }) => section);
}
