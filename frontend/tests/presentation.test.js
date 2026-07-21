import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LAYOUTS,
  MODE_VARIANTS,
  PRESENTATION_MODES,
  STYLES,
  THEMES,
  getPresentation,
  normalizePresentationMode,
  orderSections,
} from '../js/presentation.js';
import { expandSourceItems, selectPortfolioSourceItems } from '../js/sourceSections.js';

test('presentation choices and section orders are deterministic, valid, and diverse', () => {
  assert.deepEqual(MODE_VARIANTS, {
    modern: [
      { variant: 'neon-grid', theme: 'blueprint', style: 'polished', layout: 'split' },
      { variant: 'creative-studio', theme: 'bubblegum', style: 'polished', layout: 'magazine' },
      { variant: 'mono-tech', theme: 'terminal', style: 'retro', layout: 'dashboard' },
      { variant: 'bold-poster', theme: 'tabloid', style: 'brutal', layout: 'magazine' },
    ],
    professional: [
      { variant: 'executive', theme: 'boardroom', style: 'editorial', layout: 'classic' },
      { variant: 'consulting', theme: 'boardroom', style: 'polished', layout: 'split' },
      { variant: 'editorial', theme: 'tabloid', style: 'editorial', layout: 'magazine' },
      { variant: 'technical', theme: 'boardroom', style: 'polished', layout: 'dashboard' },
    ],
  });

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
    assert.equal(choice.variant, 'chaos');
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
    variant: 'chaos',
    theme: 'boardroom',
    style: 'editorial',
    layout: 'classic',
    sectionOrder: expected.classic,
  });

  for (const mode of ['modern', 'professional']) {
    const modeChoices = Array.from({ length: 512 }, (_, index) =>
      getPresentation(`${mode}-${index}`, sections, mode)
    );
    assert.equal(
      new Set(modeChoices.map(({ variant }) => variant)).size,
      MODE_VARIANTS[mode].length
    );
    for (let index = 0; index < modeChoices.length; index++) {
      const choice = modeChoices[index];
      assert.equal(choice.mode, mode);
      assert.ok(MODE_VARIANTS[mode].some(({ variant }) => variant === choice.variant));
      assert.deepEqual(choice, getPresentation(`${mode}-${index}`, sections, mode));
      assert.equal(choice.sectionOrder[0], 'identity');
      assert.equal(choice.sectionOrder.at(-1), 'actions');
    }
  }
  assert.deepEqual(PRESENTATION_MODES, ['modern', 'professional', 'chaos']);
  assert.equal(normalizePresentationMode('definitely-real'), 'chaos');
});

test('legacy source sections expand into readable portfolio cards without losing facts', () => {
  const items = expandSourceItems([{
    heading: 'Skills',
    canonical: 'skills',
    body: [
      'Java (8 years)',
      'Certifications (Professional Activities) Microsoft Azure AI Fundamentals',
      'Professional Work Experience',
      'DXC Technology',
      'Account/Project Project name: FirstDoc 9.0 Start date: Jun 2019 End Date: Jun 2023',
      'Role: Developer',
      'Previous Relevant Work Experience',
      'SutrixSolution 2017-2019',
      'Account/Project Project name: Apollo',
    ].join('\n'),
  }]);

  assert.deepEqual(items.map(({ heading, canonical }) => [heading, canonical]), [
    ['Skills', 'skills'],
    ['Certifications / Professional Activities', 'certifications'],
    ['Professional experience', 'experience'],
    ['FirstDoc 9.0', 'project'],
    ['Previous experience', 'experience'],
    ['Apollo', 'project'],
  ]);
  assert.match(items[1].body, /Microsoft Azure AI Fundamentals/);
  assert.match(items[2].body, /DXC Technology/);
  assert.match(items[3].body, /Start date: Jun 2019/);
  assert.match(items[3].body, /Role: Developer/);
  assert.match(items[4].body, /SutrixSolution 2017-2019/);
  assert.equal(items[5].body, '');
});

test('AI hero consumes only an exact duplicate source summary', () => {
  const source = [
    { heading: 'Summary', canonical: 'summary', body: 'Product engineer.' },
    { heading: 'Experience', canonical: 'experience', body: 'Built accessible products.' },
    { heading: 'Design system', canonical: 'project', body: 'Role: Lead\nCreated reusable components.' },
    { heading: 'Developer tools', canonical: 'project', body: 'Improved local workflows.' },
    { heading: 'C++ platform', canonical: 'project', body: 'Built compiler tooling.' },
    { heading: 'Skills', canonical: 'skills', body: 'JavaScript, CSS' },
    { heading: 'Education', canonical: 'education', body: 'BSc Computer Science' },
    { heading: 'Certifications', canonical: 'certifications', body: 'Azure Fundamentals' },
    { heading: 'Community', canonical: 'volunteer', body: 'Mentored developers.' },
  ];
  const headings = (options) => selectPortfolioSourceItems(source, options)
    .map(({ heading }) => heading);

  assert.deepEqual(headings(), source.map(({ heading }) => heading));
  assert.deepEqual(headings({ heroBio: 'A rewritten product engineering profile.' }),
    source.map(({ heading }) => heading));
  assert.deepEqual(headings({
    heroBio: 'Product engineer.',
    selectedWork: [{ title: 'Design system', role: 'Lead', summary: 'Created reusable components.' }],
  }), [
    'Experience', 'Design system', 'Developer tools', 'C++ platform', 'Skills', 'Education',
    'Certifications', 'Community',
  ]);
  assert.ok(headings({
    selectedWork: [{ title: 'C# platform', summary: 'Built compiler tooling.' }],
  }).includes('C++ platform'));
  assert.equal(selectPortfolioSourceItems([
    { heading: 'Summary', canonical: 'summary', body: 'Revenue changed -10%.' },
  ], { heroBio: 'Revenue changed 10%.' }).length, 1);
});
