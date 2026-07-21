import { seededRng, pick, randFloat } from './rng.js';
import { applyChaos } from './chaos/orchestrator.js';
import { downloadAsHtml } from './download.js';
import { getPresentation, normalizePresentationMode } from './presentation.js';
import { expandSourceItems, selectPortfolioSourceItems } from './sourceSections.js';

const root = document.getElementById('cv-root');

const cvId = (window.location.pathname.match(/\/cv\/([^/]+)/) || [])[1];

if (!cvId) {
  showFatal('No portfolio id in URL.');
} else {
  load(cvId).catch((err) => showFatal(err.message));
}

async function load(id) {
  const resp = await fetch(`/api/cv/${id}`);
  if (resp.status === 404) {
    showFatal(
      'This portfolio has been so enhanced it ascended to a higher plane. (Or it expired after 30 days.)'
    );
    return;
  }
  if (!resp.ok) {
    showFatal('Backend down. Recruiters definitely noticed.');
    return;
  }
  const cv = await resp.json();
  renderBaseDom(cv);
  const presentation = applyPresentation(id, cv.presentationMode);
  const candidateName = root.querySelector('.cv-identity-name')?.textContent.trim();
  if (presentation.mode !== 'chaos') prependPortfolioNavigation(candidateName);
  const portfolioType = presentation.mode === 'chaos'
    ? 'ResuMeme'
    : `${presentation.mode[0].toUpperCase()}${presentation.mode.slice(1)} Portfolio`;
  if (candidateName) document.title = `${candidateName.slice(0, 100)} | ${portfolioType}`;
  const rng = seededRng(id);
  const ctx = { cvId: id, rng, cv, presentationMode: presentation.mode };
  if (presentation.mode === 'chaos') applyChaos(rng, ctx);
  root.removeAttribute('aria-busy');
}

function showFatal(message) {
  root.replaceChildren();
  const p = document.createElement('p');
  p.className = 'loading';
  p.textContent = message;
  root.appendChild(p);
  root.removeAttribute('aria-busy');
}

function applyPresentation(id, mode) {
  const groups = new Map();
  Array.from(root.children).forEach((node, index) => {
    const section = node.dataset.cvIdentity ? 'identity' : node.dataset.cvSection || `other:${index}`;
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push(node);
  });

  const presentation = getPresentation(id, Array.from(groups.keys()), mode);
  root.dataset.mode = presentation.mode;
  root.dataset.variant = presentation.variant;
  root.dataset.theme = presentation.theme;
  root.dataset.style = presentation.style;
  root.dataset.layout = presentation.layout;
  document.body.dataset.presentationMode = presentation.mode;
  document.body.dataset.presentationVariant = presentation.variant;

  for (const section of presentation.sectionOrder) {
    for (const node of groups.get(section)) root.appendChild(node);
  }
  return presentation;
}

function renderBaseDom(cv) {
  const sections = cv.sections || {};
  const ai = cv.aiContent || {};
  const mode = normalizePresentationMode(cv.presentationMode);

  const avatarUrl = (cv.imageUrls || [])[0] || null;
  const avatarFallback = pick(seededRng(cv.id + ':emoji'), ['🤡', '👽', '💀', '🦄', '👻']);

  root.replaceChildren();

  let avatarEl = null;
  if (avatarUrl || mode === 'chaos') {
    avatarEl = document.createElement(avatarUrl ? 'img' : 'div');
    avatarEl.dataset.cvAvatar = '1';
    avatarEl.classList.add('cv-avatar');
    if (avatarUrl) {
      avatarEl.src = avatarUrl;
      avatarEl.alt = '';
      avatarEl.addEventListener('load', () => {
        if (avatarEl.naturalWidth / avatarEl.naturalHeight > 1.35) {
          avatarEl.dataset.imageKind = 'logo';
        }
      }, { once: true });
    } else {
      avatarEl.textContent = avatarFallback;
    }
  }

  root.appendChild(makeIdentityCard(
    sections,
    ai.identity,
    avatarEl,
    mode
  ));

  const hasAiPortfolio = Boolean(
    ai.hero?.bio
    || (Array.isArray(ai.stats) && ai.stats.length)
    || (Array.isArray(ai.selectedWork) && ai.selectedWork.length)
  );

  if (!hasAiPortfolio) {
    if (mode === 'chaos') appendRawText(sections.raw_text || '');
    else {
      appendSourcePortfolio(sections);
      appendSeriousContact(ai, sections, mode);
    }
    appendActionBar(mode);
    return;
  }

  if (ai.hero?.bio) {
    root.appendChild(makeHeroBio(ai.hero.bio, cv.id, mode));
  }

  if (Array.isArray(ai.stats) && ai.stats.length) {
    root.appendChild(makeStatsStrip(ai.stats, mode));
  }

  const hasSelectedWork = Array.isArray(ai.selectedWork) && ai.selectedWork.length;
  if (hasSelectedWork) {
    root.appendChild(makeSelectedWork(ai.selectedWork, mode));
  }

  if (mode !== 'chaos') {
    appendSourcePortfolio(sections, {
      heroBio: ai.hero?.bio || '',
    });
  }

  if (mode === 'chaos' && Array.isArray(ai.testimonials) && ai.testimonials.length) {
    root.appendChild(makeTestimonials(ai.testimonials, mode));
  }

  const sourceText = sections.raw_text || '';
  const hasVisibleContact = mode === 'chaos'
    ? ai.contact && (ai.contact.blurb || ai.contact.availability || ai.contact.rate)
    : ai.contact?.blurb || verifiedContacts(ai.identity, sourceText, mode).length;
  if (hasVisibleContact) {
    root.appendChild(makeContact(ai.contact || {}, ai.identity, mode, sourceText));
  }

  appendActionBar(mode);
}

function appendRawText(text) {
  const section = document.createElement('section');
  section.dataset.cvSection = 'raw';
  for (const line of text.split('\n')) {
    if (line.trim()) section.appendChild(makeText(line));
  }
  root.appendChild(section);
}

function appendSourcePortfolio(sections, options = {}) {
  const sourceItems = Array.isArray(sections.items) ? sections.items : [];
  const hasParsedItems = expandSourceItems(sourceItems).length > 0;
  const items = selectPortfolioSourceItems(
    sourceItems,
    options
  );
  const contacts = extractContacts(sections.raw_text || '');
  if (!items.length) {
    if (hasParsedItems) return;
    const fallbackText = withoutLeadingIdentity(
      sections.raw_text || '',
      sections.name || '',
      sections.title || ''
    );
    const fallback = makeSourceSection({
      heading: 'Profile',
      canonical: 'profile',
      body: fallbackText || 'No readable portfolio sections were found.',
    }, 0, contacts);
    if (fallback) appendAnchoredSourceSection(fallback, 'about', 0);
    return;
  }

  let rendered = 0;
  for (const item of items) {
    const omitted = item.canonical === 'profile' ? contacts : [];
    const section = makeSourceSection(item, rendered, omitted);
    if (section) {
      appendAnchoredSourceSection(section, sourceGroup(item.canonical), rendered);
      rendered += 1;
    }
  }
}

function appendAnchoredSourceSection(section, anchor, index) {
  section.id = document.getElementById(anchor) ? `${anchor}-${index + 1}` : anchor;
  root.appendChild(section);
}

function sourceGroup(canonical) {
  const kind = String(canonical || '').toLowerCase();
  if (['summary', 'profile'].includes(kind)) return 'about';
  if (['experience', 'projects', 'project', 'freelance'].includes(kind)) return 'work';
  if (['skills', 'skill', 'technologies', 'technology', 'competencies', 'expertise'].includes(kind)) {
    return 'expertise';
  }
  if ([
    'education', 'certifications', 'certificates', 'awards', 'languages',
    'publications', 'volunteer', 'volunteering',
  ].includes(kind)) {
    return 'background';
  }
  return 'details';
}

function makeSourceSection(item, index, omittedContacts = []) {
  const section = document.createElement('section');
  section.className = 'pf-source-section';
  section.dataset.cvSection = 'portfolio';
  section.dataset.sourceKind = String(item.canonical || 'section')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  section.dataset.sourceGroup = sourceGroup(item.canonical);
  section.dataset.sourceSize = String(item.body || '').length > 900 ? 'long' : 'compact';

  const indexEl = document.createElement('span');
  indexEl.className = 'pf-source-index';
  indexEl.setAttribute('aria-hidden', 'true');
  indexEl.textContent = String(index + 1).padStart(2, '0');
  section.appendChild(indexEl);

  const heading = document.createElement('h2');
  heading.className = 'pf-source-heading';
  heading.textContent = item.heading || 'Details';
  section.appendChild(heading);

  const body = document.createElement('div');
  body.className = 'pf-source-body';
  if (appendSourceBody(body, item.body || '', omittedContacts)) {
    section.appendChild(body);
  } else if (item.canonical !== 'project') {
    return null;
  }
  return section;
}

function appendSourceBody(container, text, omittedContacts = []) {
  let list = null;
  for (const rawLine of text.split('\n')) {
    const line = withoutRenderedContacts(rawLine, omittedContacts);
    if (!line) {
      list = null;
      continue;
    }

    const bullet = line.match(/^[-*•▪◦‣⋅▸]\s+(.*)$/);
    if (bullet) {
      if (!list) {
        list = document.createElement('ul');
        container.appendChild(list);
      }
      const item = document.createElement('li');
      item.textContent = bullet[1];
      list.appendChild(item);
      continue;
    }

    list = null;
    const subheading = line.match(/^(.{2,48}):$/);
    if (subheading) {
      const heading = document.createElement('h3');
      heading.className = 'pf-source-subheading';
      heading.textContent = subheading[1];
      container.appendChild(heading);
      continue;
    }

    const detail = line.match(/^([A-Za-z][A-Za-z /+&-]{1,30}):\s+(.+)$/);
    if (detail) {
      const row = document.createElement('p');
      row.className = 'pf-source-detail';
      const label = document.createElement('strong');
      label.textContent = `${detail[1]}:`;
      row.append(label, document.createTextNode(` ${detail[2]}`));
      container.appendChild(row);
      continue;
    }

    const paragraph = document.createElement('p');
    paragraph.textContent = line;
    container.appendChild(paragraph);
  }
  return container.childElementCount > 0;
}

function withoutRenderedContacts(rawLine, contacts) {
  let line = rawLine.trim();
  for (const contact of contacts) {
    line = line.split(contact).join('');
  }
  line = line.replace(/^[\s|•·,;:/-]+|[\s|•·,;:/-]+$/g, '').trim();
  const remainder = line
    .replace(/\b(?:email|phone|mobile|tel|linkedin|github)\s*:?/gi, '')
    .replace(/[\s|•·,;:/-]/g, '');
  return remainder ? line : '';
}

function withoutLeadingIdentity(text, name, title) {
  const identity = [name, title].filter(Boolean);
  let inspected = 0;
  return text.split('\n').map((line) => {
    if (!line.trim() || inspected++ >= 3) return line;
    return withoutRenderedContacts(line, identity);
  }).join('\n');
}

function makeHeading(text, key) {
  const h = document.createElement('h2');
  h.dataset.cvHeading = key;
  h.appendChild(splitWords(text));
  return h;
}

function makeText(text, tag = 'p') {
  const el = document.createElement(tag);
  el.appendChild(splitWords(text));
  return el;
}

function splitWords(text) {
  const frag = document.createDocumentFragment();
  const parts = text.split(/(\s+)/);
  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      frag.appendChild(document.createTextNode(part));
    } else if (part) {
      const span = document.createElement('span');
      span.dataset.cvWord = '1';
      span.textContent = part;
      frag.appendChild(span);
    }
  }
  return frag;
}

const HERO_FONTS = [
  '"Georgia", "Times New Roman", serif',
  '"Comic Sans MS", "Comic Neue", cursive',
  '"Courier New", monospace',
  '"Trebuchet MS", "Lucida Sans", sans-serif',
];

function makeHeroBio(bio, seedKey, mode) {
  const card = document.createElement('section');
  card.className = 'pf-hero-bio';
  card.dataset.cvSection = 'hero';
  card.id = 'about';

  if (mode === 'chaos') {
    const localRng = seededRng((seedKey || '') + ':hero');
    const font = pick(localRng, HERO_FONTS);
    const tilt = randFloat(localRng, -1.5, 1.5);
    card.style.transform = `rotate(${tilt}deg)`;
    card.style.setProperty('--hero-font', font);
  }

  const badge = document.createElement('h2');
  badge.className = 'pf-hero-badge';
  badge.textContent = mode === 'chaos'
    ? '✨ About the Founder'
    : mode === 'modern' ? 'Profile / 01' : 'Executive profile';
  card.appendChild(badge);

  const body = document.createElement('p');
  body.className = 'pf-hero-body';
  if (mode === 'chaos') body.style.fontFamily = 'var(--hero-font)';
  body.appendChild(splitWords(bio));
  card.appendChild(body);

  return card;
}

function makeStatsStrip(stats, mode = 'chaos') {
  const section = document.createElement('section');
  section.className = 'pf-stats';
  section.dataset.cvSection = 'stats';
  section.id = 'highlights';

  section.appendChild(makeHeading(mode === 'chaos' ? 'BY THE NUMBERS' : 'CAREER HIGHLIGHTS', 'stats'));

  const grid = document.createElement('div');
  grid.className = 'pf-stats-grid';
  for (const stat of stats) {
    const chip = document.createElement('div');
    chip.className = 'pf-stat';
    chip.appendChild(splitWords(stat));
    grid.appendChild(chip);
  }
  section.appendChild(grid);
  return section;
}

function makeSelectedWork(items, mode = 'chaos') {
  const section = document.createElement('section');
  section.className = 'pf-work';
  section.dataset.cvSection = 'experience';
  section.id = 'work';

  section.appendChild(makeHeading(mode === 'chaos' ? 'SELECTED WORK' : 'SELECTED EXPERIENCE', 'experience'));

  const grid = document.createElement('div');
  grid.className = 'pf-work-grid';
  for (const item of items) {
    grid.appendChild(makeWorkCard(item));
  }
  section.appendChild(grid);
  return section;
}

function makeWorkCard(item) {
  const card = document.createElement('article');
  card.className = 'pf-work-card';

  const head = document.createElement('div');
  head.className = 'pf-work-head';
  if (item.year) {
    const year = document.createElement('span');
    year.className = 'pf-work-year';
    year.textContent = item.year;
    head.appendChild(year);
  }
  if (item.client) {
    const client = document.createElement('span');
    client.className = 'pf-work-client';
    client.textContent = item.client;
    head.appendChild(client);
  }
  card.appendChild(head);

  if (item.title) {
    const h3 = document.createElement('h3');
    h3.className = 'pf-work-title';
    h3.appendChild(splitWords(item.title));
    card.appendChild(h3);
  }

  if (item.role) {
    const role = document.createElement('div');
    role.className = 'pf-work-role';
    role.appendChild(splitWords(item.role));
    card.appendChild(role);
  }

  if (item.summary) {
    const p = document.createElement('p');
    p.className = 'pf-work-summary';
    p.appendChild(splitWords(item.summary));
    card.appendChild(p);
  }

  if (Array.isArray(item.metrics) && item.metrics.length) {
    const metrics = document.createElement('ul');
    metrics.className = 'pf-work-metrics';
    for (const m of item.metrics) {
      const li = document.createElement('li');
      li.appendChild(splitWords(m));
      metrics.appendChild(li);
    }
    card.appendChild(metrics);
  }

  if (Array.isArray(item.tags) && item.tags.length) {
    const tags = document.createElement('div');
    tags.className = 'pf-work-tags';
    for (const t of item.tags) {
      const tag = document.createElement('span');
      tag.className = 'pf-tag';
      tag.textContent = t;
      tags.appendChild(tag);
    }
    card.appendChild(tags);
  }

  return card;
}

function makeTestimonials(items, mode = 'chaos') {
  const section = document.createElement('section');
  section.className = 'pf-testimonials';
  section.dataset.cvSection = 'testimonials';
  section.id = 'recommendations';

  section.appendChild(makeHeading(mode === 'chaos' ? 'WHAT THEY SAY' : 'RECOMMENDATIONS', 'testimonials'));

  const grid = document.createElement('div');
  grid.className = 'pf-testimonials-grid';
  for (const t of items) {
    const card = document.createElement('blockquote');
    card.className = 'pf-testimonial';

    const q = document.createElement('p');
    q.className = 'pf-testimonial-quote';
    q.appendChild(splitWords(`"${t.quote}"`));
    card.appendChild(q);

    const cite = document.createElement('footer');
    cite.className = 'pf-testimonial-cite';
    const parts = [t.author, t.role, t.company].filter(Boolean).join(' · ');
    if (parts) cite.appendChild(splitWords(parts));
    card.appendChild(cite);

    grid.appendChild(card);
  }
  section.appendChild(grid);
  return section;
}

function makeContact(contact, identity, mode = 'chaos', sourceText = '') {
  const section = document.createElement('section');
  section.className = 'pf-contact';
  section.dataset.cvSection = 'contact';
  section.id = 'contact';

  section.appendChild(makeHeading(mode === 'chaos' ? 'LET’S COLLABORATE' : 'GET IN TOUCH', 'contact'));

  if (mode === 'chaos' && contact.availability) {
    const avail = document.createElement('div');
    avail.className = 'pf-contact-availability';
    avail.appendChild(splitWords(contact.availability));
    section.appendChild(avail);
  }

  if (mode === 'chaos' && contact.rate) {
    const rate = document.createElement('div');
    rate.className = 'pf-contact-rate';
    rate.appendChild(splitWords(contact.rate));
    section.appendChild(rate);
  }

  if (contact.blurb) {
    const blurb = document.createElement('p');
    blurb.className = 'pf-contact-blurb';
    blurb.appendChild(splitWords(contact.blurb));
    section.appendChild(blurb);
  }

  const contacts = verifiedContacts(identity, sourceText, mode);
  if (contacts.length) {
    const strip = document.createElement('div');
    strip.className = 'pf-contact-links';
    for (const value of contacts) {
      const href = contactHref(value);
      if (!href) continue;
      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'cv-contact-chip';
      a.dataset.cvSpecial = 'contact';
      a.textContent = value;
      strip.appendChild(a);
    }
    if (strip.childElementCount) section.appendChild(strip);
  }

  return section;
}

function makeIdentityCard(sections, aiIdentity, avatarEl, mode = 'chaos') {
  const card = document.createElement('div');
  card.className = 'cv-identity';
  card.dataset.cvIdentity = '1';
  card.id = 'top';

  if (avatarEl) {
    card.dataset.hasAvatar = '1';
    const frame = document.createElement('div');
    frame.className = 'cv-avatar-frame';
    frame.appendChild(avatarEl);
    card.appendChild(frame);
  }

  const ai = aiIdentity || {};
  const looksLikePara = (s) => !s || s.length > 80 || /\s\w+\s\w+\s\w+\s\w+/.test(s);
  const looksLikeTitle = (s) =>
    !!s && /^(?:founder|co-?founder|ceo|cto|cfo|coo|cmo|chief|vp|svp|evp|head\s+of|lead|director|principal|architect\s+of|president|managing|partner)\b/i.test(s.trim());

  const sourceName = String(sections.name || '').trim();
  const sourceTitle = String(sections.title || '').trim();
  const heuristicName = looksLikePara(sourceName) ? '' : sourceName;
  const sourceTitleLooksLikeLocation = /^(?:viet\s*nam|vietnam|(?:[\p{L}.'-]+\s+){1,4}city\s*,?\s*(?:viet\s*nam|vietnam))$/iu.test(sourceTitle);
  const aiName = (ai.name && ai.name.trim()) || '';
  // Reject AI name if it slipped a sigma founder title into the field.
  const safeAiName = looksLikeTitle(aiName) ? '' : aiName;
  const name = safeAiName || (mode === 'chaos' ? heuristicName : sourceName);
  const title = (ai.title && ai.title.trim())
    || ((mode === 'chaos' && looksLikePara(sourceTitle)) || sourceTitleLooksLikeLocation
      ? ''
      : sourceTitle);
  const tagline = (ai.tagline && ai.tagline.trim()) || '';

  if (mode !== 'chaos') {
    const kicker = document.createElement('div');
    kicker.className = 'cv-identity-kicker';
    kicker.textContent = mode === 'modern' ? 'Selected profile' : 'Professional profile';
    card.appendChild(kicker);
  }

  if (name) {
    const el = document.createElement('h1');
    el.className = 'cv-identity-name';
    el.dataset.cvSpecial = 'name';
    el.textContent = name;
    card.appendChild(el);
  }

  if (title) {
    const el = document.createElement('div');
    el.className = 'cv-identity-title';
    el.textContent = title;
    card.appendChild(el);
  }

  if (tagline) {
    const el = document.createElement('div');
    el.className = 'cv-identity-tagline';
    el.textContent = tagline;
    card.appendChild(el);
  }

  const contacts = verifiedContacts(ai, sections.raw_text || '', mode);
  if (contacts.length) {
    const strip = document.createElement('div');
    strip.className = 'cv-identity-contacts';
    for (const item of contacts) {
      const href = mode === 'chaos' ? '' : contactHref(item);
      const chip = document.createElement(href ? 'a' : 'span');
      chip.className = 'cv-contact-chip';
      chip.dataset.cvSpecial = 'contact';
      chip.textContent = item;
      if (href) chip.href = href;
      strip.appendChild(chip);
    }
    card.appendChild(strip);
  }

  return card;
}

function appendSeriousContact(ai, sections, mode) {
  const sourceText = sections.raw_text || '';
  if (verifiedContacts(ai.identity, sourceText, mode).length) {
    root.appendChild(makeContact({}, ai.identity, mode, sourceText));
  }
}

function prependPortfolioNavigation(candidateName) {
  const labels = new Map([
    ['about', 'About'],
    ['work', 'Work'],
    ['expertise', 'Expertise'],
    ['background', 'Background'],
    ['contact', 'Contact'],
  ]);
  const targets = Array.from(root.querySelectorAll('#about, #work, #expertise, #background, #contact'))
    .map(({ id }) => [id, labels.get(id)]);

  const nav = document.createElement('nav');
  nav.className = 'pf-site-nav';
  nav.setAttribute('aria-label', 'Portfolio navigation');

  const brand = document.createElement('a');
  brand.className = 'pf-site-brand';
  brand.href = '#top';
  brand.textContent = candidateName || 'Portfolio';
  nav.appendChild(brand);

  if (targets.length) {
    const links = document.createElement('div');
    links.className = 'pf-site-links';
    for (const [id, label] of targets) {
      const link = document.createElement('a');
      link.href = `#${id}`;
      link.textContent = label;
      links.appendChild(link);
    }
    nav.appendChild(links);
  }

  root.prepend(nav);
}

function contactHref(value) {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  if (/^(?:https?:\/\/|www\.|(?:linkedin\.com|github\.com)\/)[^\s]+$/i.test(value)) {
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 ? `tel:${value.replace(/[^+\d]/g, '')}` : '';
}

function contactKey(value) {
  const href = contactHref(value);
  if (href.startsWith('mailto:')) return href.toLowerCase();
  if (href.startsWith('tel:')) return `tel:${href.replace(/\D/g, '')}`;
  if (href.startsWith('http')) {
    return href.toLowerCase().replace(/^https?:\/\/(?:www\.)?/, '').replace(/\/$/, '');
  }
  return '';
}

function verifiedContacts(aiIdentity, sourceText, mode) {
  const ai = aiIdentity || {};
  const aiContacts = [ai.email, ai.phone, ai.linkedin, ai.github]
    .filter((value) => value && String(value).trim())
    .map(String);
  const sourceContacts = extractContacts(sourceText);
  if (mode === 'chaos') return aiContacts.length ? aiContacts : sourceContacts;

  const sourceKeys = new Set(sourceContacts.map(contactKey).filter(Boolean));
  const merged = [
    ...aiContacts.filter((value) => sourceKeys.has(contactKey(value))),
    ...sourceContacts,
  ];
  const seen = new Set();
  return merged.filter((value) => {
    const key = contactKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractContacts(text) {
  const hits = [];
  const seen = new Set();
  const add = (value) => {
    const trimmed = value.trim().replace(/[.,;:]+$/, '');
    const key = trimmed.toLowerCase();
    if (trimmed.length >= 7 && !seen.has(key)) {
      seen.add(key);
      hits.push(trimmed);
    }
  };

  for (const email of text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []) {
    add(email);
  }

  const withoutUrlsOrEmails = text.replace(
    /(?:https?:\/\/|www\.|(?:linkedin\.com|github\.com)\/)[^\s|<>()]+/gi,
    ' '
  ).replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ' ');
  for (const candidate of withoutUrlsOrEmails.match(/(?:\+?\d|\(\d)[\d \t().-]{5,}\d/g) || []) {
    const digits = candidate.replace(/\D/g, '');
    const isYearRange = /(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}/.test(candidate);
    if (!isYearRange && digits.length <= 15 && (
      digits.length >= 9 || (digits.length >= 7 && candidate.trim().startsWith('+'))
    )) add(candidate);
  }

  for (const url of text.match(
    /(?:https?:\/\/|www\.|(?:linkedin\.com|github\.com)\/)[^\s|<>()]+/gi
  ) || []) {
    add(url);
  }
  return hits.slice(0, 6);
}

function appendActionBar(mode) {
  const bar = document.createElement('div');
  bar.className = 'cv-actions';
  bar.dataset.cvSection = 'actions';

  const dl = document.createElement('button');
  dl.id = 'btn-download';
  dl.textContent = mode === 'chaos' ? '✨ Download Portfolio ✨' : 'Download portfolio';
  bar.appendChild(dl);

  const sh = document.createElement('button');
  sh.id = 'btn-share';
  sh.dataset.defaultLabel = mode === 'chaos' ? '📋 Copy share link' : 'Copy share link';
  sh.textContent = sh.dataset.defaultLabel;
  bar.appendChild(sh);

  root.appendChild(bar);
}

document.addEventListener('click', async (e) => {
  if (!e.target) return;
  if (e.target.id === 'btn-download') {
    e.preventDefault();
    downloadAsHtml('enhanced-portfolio.html');
  } else if (e.target.id === 'btn-share') {
    try {
      await navigator.clipboard.writeText(window.location.href);
      e.target.textContent = '✓ Copied!';
      setTimeout(() => { e.target.textContent = e.target.dataset.defaultLabel; }, 1500);
    } catch {
      e.target.textContent = 'Copy failed, select URL manually';
    }
  }
});
