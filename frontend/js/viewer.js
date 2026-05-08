import { seededRng, pick, randFloat } from './rng.js';
import { applyChaos } from './chaos/orchestrator.js';
import { downloadAsHtml } from './download.js';

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
  const rng = seededRng(id);
  const ctx = { cvId: id, rng, cv };
  applyChaos(rng, ctx);
  root.removeAttribute('aria-busy');
}

function showFatal(message) {
  root.replaceChildren();
  const p = document.createElement('p');
  p.className = 'loading';
  p.textContent = message;
  root.appendChild(p);
}

function renderBaseDom(cv) {
  const sections = cv.sections || {};
  const ai = cv.aiContent || {};

  const avatarUrl = (cv.imageUrls || [])[0] || null;
  const avatarFallback = pick(seededRng(cv.id + ':emoji'), ['🤡', '👽', '💀', '🦄', '👻']);

  root.replaceChildren();

  const avatarEl = document.createElement(avatarUrl ? 'img' : 'div');
  avatarEl.dataset.cvAvatar = '1';
  avatarEl.classList.add('cv-avatar');
  if (avatarUrl) {
    avatarEl.src = avatarUrl;
    avatarEl.alt = '';
  } else {
    avatarEl.textContent = avatarFallback;
  }

  root.appendChild(makeIdentityCard(sections, ai.identity, avatarEl));

  if (ai.hero && ai.hero.bio) {
    root.appendChild(makeHeroBio(ai.hero.bio, cv.id));
  }

  if (Array.isArray(ai.stats) && ai.stats.length) {
    root.appendChild(makeStatsStrip(ai.stats));
  }

  if (Array.isArray(ai.selectedWork) && ai.selectedWork.length) {
    root.appendChild(makeSelectedWork(ai.selectedWork));
  }

  if (Array.isArray(ai.testimonials) && ai.testimonials.length) {
    root.appendChild(makeTestimonials(ai.testimonials));
  }

  if (ai.contact && (ai.contact.availability || ai.contact.rate || ai.contact.blurb)) {
    root.appendChild(makeContact(ai.contact, ai.identity));
  }

  // Fallback: if AI returned nothing, show raw text so the page isn't empty.
  if (!ai.hero && !ai.selectedWork && !ai.testimonials) {
    appendRawText(sections.raw_text || '');
  }

  appendActionBar();
}

function appendRawText(text) {
  const section = document.createElement('section');
  section.dataset.cvSection = 'raw';
  for (const line of text.split('\n')) {
    if (line.trim()) section.appendChild(makeText(line));
  }
  root.appendChild(section);
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

function makeHeroBio(bio, seedKey) {
  const card = document.createElement('section');
  card.className = 'pf-hero-bio';
  card.dataset.cvSection = 'hero';

  const localRng = seededRng((seedKey || '') + ':hero');
  const font = pick(localRng, HERO_FONTS);
  const tilt = randFloat(localRng, -1.5, 1.5);
  card.style.transform = `rotate(${tilt}deg)`;

  const badge = document.createElement('div');
  badge.className = 'pf-hero-badge';
  badge.textContent = '✨ About the Founder';
  card.appendChild(badge);

  const body = document.createElement('p');
  body.className = 'pf-hero-body';
  body.style.fontFamily = font;
  body.appendChild(splitWords(bio));
  card.appendChild(body);

  return card;
}

function makeStatsStrip(stats) {
  const section = document.createElement('section');
  section.className = 'pf-stats';
  section.dataset.cvSection = 'stats';

  section.appendChild(makeHeading('BY THE NUMBERS', 'stats'));

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

function makeSelectedWork(items) {
  const section = document.createElement('section');
  section.className = 'pf-work';
  section.dataset.cvSection = 'experience';

  section.appendChild(makeHeading('SELECTED WORK', 'experience'));

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

function makeTestimonials(items) {
  const section = document.createElement('section');
  section.className = 'pf-testimonials';
  section.dataset.cvSection = 'testimonials';

  section.appendChild(makeHeading('WHAT THEY SAY', 'testimonials'));

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

function makeContact(contact, identity) {
  const section = document.createElement('section');
  section.className = 'pf-contact';
  section.dataset.cvSection = 'contact';

  section.appendChild(makeHeading('LET’S COLLABORATE', 'contact'));

  if (contact.availability) {
    const avail = document.createElement('div');
    avail.className = 'pf-contact-availability';
    avail.appendChild(splitWords(contact.availability));
    section.appendChild(avail);
  }

  if (contact.rate) {
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

  const links = [
    identity && identity.email && `mailto:${identity.email}`,
    identity && identity.linkedin,
    identity && identity.github,
  ].filter(Boolean);
  if (links.length) {
    const strip = document.createElement('div');
    strip.className = 'pf-contact-links';
    for (const href of links) {
      const a = document.createElement('a');
      a.href = href.startsWith('http') || href.startsWith('mailto:') ? href : `https://${href}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'cv-contact-chip';
      a.dataset.cvSpecial = 'contact';
      a.textContent = href.replace(/^mailto:/, '');
      strip.appendChild(a);
    }
    section.appendChild(strip);
  }

  return section;
}

function makeIdentityCard(sections, aiIdentity, avatarEl) {
  const card = document.createElement('div');
  card.className = 'cv-identity';
  card.dataset.cvIdentity = '1';

  if (avatarEl) {
    const frame = document.createElement('div');
    frame.className = 'cv-avatar-frame';
    frame.appendChild(avatarEl);
    card.appendChild(frame);
  }

  const ai = aiIdentity || {};
  const looksLikePara = (s) => !s || s.length > 80 || /\s\w+\s\w+\s\w+\s\w+/.test(s);
  const looksLikeTitle = (s) =>
    !!s && /^(?:founder|co-?founder|ceo|cto|cfo|coo|cmo|chief|vp|svp|evp|head\s+of|lead|director|principal|architect\s+of|president|managing|partner)\b/i.test(s.trim());

  const heuristicName = looksLikePara(sections.name) ? '' : sections.name;
  const aiName = (ai.name && ai.name.trim()) || '';
  // Reject AI name if it slipped a sigma founder title into the field.
  const safeAiName = looksLikeTitle(aiName) ? '' : aiName;
  const name = safeAiName || heuristicName || '';
  const title = (ai.title && ai.title.trim()) || (looksLikePara(sections.title) ? '' : sections.title) || '';
  const tagline = (ai.tagline && ai.tagline.trim()) || '';

  if (name) {
    const el = document.createElement('div');
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

  const aiContacts = [ai.email, ai.phone, ai.linkedin, ai.github]
    .filter((s) => s && String(s).trim());
  const contacts = aiContacts.length ? aiContacts : extractContacts(sections.raw_text || '');
  if (contacts.length) {
    const strip = document.createElement('div');
    strip.className = 'cv-identity-contacts';
    for (const item of contacts) {
      const chip = document.createElement('span');
      chip.className = 'cv-contact-chip';
      chip.dataset.cvSpecial = 'contact';
      chip.textContent = item;
      strip.appendChild(chip);
    }
    card.appendChild(strip);
  }

  return card;
}

function extractContacts(text) {
  const hits = [];
  const seen = new Set();
  const patterns = [
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    /(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g,
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+/gi,
    /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9-]+/gi,
  ];
  for (const pat of patterns) {
    const matches = text.match(pat) || [];
    for (const m of matches) {
      const trimmed = m.trim();
      if (trimmed.length >= 7 && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        hits.push(trimmed);
      }
    }
  }
  return hits.slice(0, 6);
}

function appendActionBar() {
  const bar = document.createElement('div');
  bar.className = 'cv-actions';
  bar.dataset.cvSection = 'actions';

  const dl = document.createElement('button');
  dl.id = 'btn-download';
  dl.textContent = '✨ Download Portfolio ✨';
  bar.appendChild(dl);

  const sh = document.createElement('button');
  sh.id = 'btn-share';
  sh.textContent = '📋 Copy share link';
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
      setTimeout(() => { e.target.textContent = '📋 Copy share link'; }, 1500);
    } catch {
      e.target.textContent = 'Copy failed, select URL manually';
    }
  }
});
