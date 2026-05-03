import { pick } from '../../rng.js';

// Each STYLE is applied wholesale (Object.assign) to a section. Mix of
// pastel tints with accent borders, plus a few "off-template" looks
// (dashed border, italic body, drop shadow). Some null entries so a
// fraction of sections keep the default white-card look.
const STYLES = [
  { backgroundColor: '#fef3c7', borderLeft: '6px solid #f59e0b' },
  { backgroundColor: '#dbeafe', borderLeft: '6px solid #3b82f6' },
  { backgroundColor: '#fee2e2', borderLeft: '6px solid #ef4444' },
  { backgroundColor: '#dcfce7', borderLeft: '6px solid #22c55e' },
  { backgroundColor: '#f3e8ff', borderLeft: '6px solid #a855f7' },
  { backgroundColor: '#fff7ed', borderLeft: '6px solid #c2410c' },
  { backgroundColor: '#fef9c3', border: '3px double #ca8a04' },
  { border: '3px dashed #000', backgroundColor: 'rgba(255, 255, 255, 0.7)' },
  { fontStyle: 'italic', backgroundColor: 'rgba(255, 240, 245, 0.85)' },
  { boxShadow: '8px 8px 0 #000', backgroundColor: 'rgba(255, 253, 240, 0.92)' },
  null, null,
];

export default {
  name: 'sectionVariety',
  targets: 'section',
  density: 1,
  apply(el, rng) {
    const style = pick(rng, STYLES);
    if (!style) return;
    Object.assign(el.style, style);
  },
};
