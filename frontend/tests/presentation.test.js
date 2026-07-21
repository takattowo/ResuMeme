import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LAYOUTS,
  STYLES,
  THEMES,
  getPresentation,
  orderSections,
} from '../js/presentation.js';

test('presentation choices and section orders are deterministic, valid, and diverse', () => {
  const sections = [
    'contact',
    'actions',
    'extra',
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
    classic: ['identity', 'hero', 'stats', 'experience', 'testimonials', 'contact', 'raw', 'extra', 'actions'],
    split: ['identity', 'hero', 'experience', 'contact', 'stats', 'testimonials', 'raw', 'extra', 'actions'],
    magazine: ['identity', 'hero', 'testimonials', 'experience', 'stats', 'contact', 'raw', 'extra', 'actions'],
    dashboard: ['identity', 'stats', 'experience', 'hero', 'contact', 'testimonials', 'raw', 'extra', 'actions'],
  };
  for (const [layout, order] of Object.entries(expected)) {
    assert.deepEqual(orderSections(layout, sections), order);
  }

  const sparse = ['actions', 'contact', 'stats', 'identity', 'hero'];
  assert.deepEqual(orderSections('classic', sparse), ['identity', 'hero', 'stats', 'contact', 'actions']);
  assert.deepEqual(orderSections('split', sparse), ['identity', 'hero', 'contact', 'stats', 'actions']);
  assert.deepEqual(orderSections('magazine', sparse), ['identity', 'hero', 'stats', 'contact', 'actions']);
  assert.deepEqual(orderSections('dashboard', sparse), ['identity', 'stats', 'hero', 'contact', 'actions']);

  assert.deepEqual(getPresentation('stable-link', sections), {
    theme: 'boardroom',
    style: 'editorial',
    layout: 'classic',
    sectionOrder: expected.classic,
  });
});
