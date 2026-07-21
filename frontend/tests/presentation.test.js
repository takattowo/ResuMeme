import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LAYOUTS,
  PRESENTATION_MODES,
  STYLES,
  THEMES,
  getPresentation,
  normalizePresentationMode,
  orderSections,
} from '../js/presentation.js';

test('presentation choices and section orders are deterministic, valid, and diverse', () => {
  const sections = [
    'contact',
    'actions',
    'extra',
    'portfolio',
    'stats',
    'identity',
    'testimonials',
    'hero',
    'raw',
    'experience',
  ];
  const choices = Array.from({ length: 512 }, (_, index) =>
    getPresentation(`portfolio-${index}`, sections)
  );

  for (let index = 0; index < choices.length; index++) {
    const choice = choices[index];
    assert.deepEqual(choice, getPresentation(`portfolio-${index}`, sections));
    assert.equal(choice.mode, 'chaos');
    assert.ok(THEMES.includes(choice.theme));
    assert.ok(STYLES.includes(choice.style));
    assert.ok(Object.hasOwn(LAYOUTS, choice.layout));
    assert.equal(choice.sectionOrder[0], 'identity');
    assert.equal(choice.sectionOrder.at(-1), 'actions');
    assert.deepEqual([...choice.sectionOrder].sort(), [...sections].sort());
  }

  assert.equal(new Set(choices.map(({ theme }) => theme)).size, THEMES.length);
  assert.equal(new Set(choices.map(({ style }) => style)).size, STYLES.length);
  assert.equal(new Set(choices.map(({ layout }) => layout)).size, Object.keys(LAYOUTS).length);

  const expected = {
    classic: ['identity', 'hero', 'stats', 'experience', 'portfolio', 'testimonials', 'contact', 'raw', 'extra', 'actions'],
    split: ['identity', 'hero', 'experience', 'portfolio', 'contact', 'stats', 'testimonials', 'raw', 'extra', 'actions'],
    magazine: ['identity', 'hero', 'testimonials', 'experience', 'portfolio', 'stats', 'contact', 'raw', 'extra', 'actions'],
    dashboard: ['identity', 'stats', 'experience', 'portfolio', 'hero', 'contact', 'testimonials', 'raw', 'extra', 'actions'],
  };
  for (const [layout, order] of Object.entries(expected)) {
    assert.deepEqual(orderSections(layout, sections), order);
  }

  const sparse = ['actions', 'contact', 'portfolio', 'stats', 'identity', 'hero'];
  assert.deepEqual(orderSections('classic', sparse), ['identity', 'hero', 'stats', 'portfolio', 'contact', 'actions']);
  assert.deepEqual(orderSections('split', sparse), ['identity', 'hero', 'portfolio', 'contact', 'stats', 'actions']);
  assert.deepEqual(orderSections('magazine', sparse), ['identity', 'hero', 'portfolio', 'stats', 'contact', 'actions']);
  assert.deepEqual(orderSections('dashboard', sparse), ['identity', 'stats', 'portfolio', 'hero', 'contact', 'actions']);

  assert.deepEqual(getPresentation('stable-link', sections), {
    mode: 'chaos',
    theme: 'boardroom',
    style: 'editorial',
    layout: 'classic',
    sectionOrder: expected.classic,
  });

  assert.deepEqual(getPresentation('any-link', sections, 'modern'), {
    mode: 'modern',
    theme: 'blueprint',
    style: 'polished',
    layout: 'split',
    sectionOrder: expected.split,
  });
  assert.deepEqual(getPresentation('any-link', sections, 'professional'), {
    mode: 'professional',
    theme: 'boardroom',
    style: 'editorial',
    layout: 'classic',
    sectionOrder: expected.classic,
  });
  assert.deepEqual(PRESENTATION_MODES, ['modern', 'professional', 'chaos']);
  assert.equal(normalizePresentationMode('definitely-real'), 'chaos');
});
