import { seededRng, pick } from './rng.js';
import { applyChaos } from './chaos/orchestrator.js';
import { downloadAsHtml } from './download.js';

const root = document.getElementById('cv-root');

const cvId = (window.location.pathname.match(/\/cv\/([^/]+)/) || [])[1];

if (!cvId) {
  showFatal('No CV id in URL.');
} else {
  load(cvId).catch((err) => showFatal(err.message));
}

async function load(id) {
  const resp = await fetch(`/api/cv/${id}`);
  if (resp.status === 404) {
    showFatal(
      'This CV has been so enhanced it ascended to a higher plane. (Or it expired after 30 days.)'
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
  const hasStructured =
    sections.summary || sections.experience || sections.skills || sections.education;

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
  root.appendChild(avatarEl);

  root.appendChild(makeIdentityCard(sections, cv.aiContent && cv.aiContent.identity));

  if (cv.aiContent && cv.aiContent.review) {
    root.appendChild(makeAiReview(cv.aiContent.review));
  }

  if (hasStructured) {
    appendSection('summary', sections.summary);
    appendSection('experience', sections.experience);
    appendSection('skills', sections.skills);
    appendSection('education', sections.education);
  } else {
    appendRawText(sections.raw_text || '');
  }

  appendActionBar();
}

function appendSection(name, body) {
  if (!body) return;
  const section = document.createElement('section');
  section.dataset.cvSection = name;
  section.appendChild(makeHeading(name.toUpperCase(), name));
  for (const line of body.split('\n')) {
    if (line.trim()) section.appendChild(makeText(line));
  }
  root.appendChild(section);
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

function makeAiReview(reviewText) {
  const card = document.createElement('div');
  card.className = 'cv-ai-review';
  card.dataset.cvAiReview = '1';

  const badge = document.createElement('div');
  badge.className = 'cv-ai-review-badge';
  badge.textContent = '🤖 AI Career Counselor Review™';
  card.appendChild(badge);

  const body = document.createElement('p');
  body.className = 'cv-ai-review-body';
  body.textContent = reviewText;
  card.appendChild(body);

  return card;
}

function makeIdentityCard(sections, aiIdentity) {
  const card = document.createElement('div');
  card.className = 'cv-identity';
  card.dataset.cvIdentity = '1';

  const ai = aiIdentity || {};
  const looksLikePara = (s) => !s || s.length > 80 || /\s\w+\s\w+\s\w+\s\w+/.test(s);

  // Prefer AI-extracted name; fall back to heuristic (and reject if it
  // looks like a paragraph rather than a name).
  const heuristicName = looksLikePara(sections.name) ? '' : sections.name;
  const name = (ai.name && ai.name.trim()) || heuristicName || '';
  const title = (ai.title && ai.title.trim()) || (looksLikePara(sections.title) ? '' : sections.title) || '';

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
  dl.textContent = '✨ Download Enhanced CV ✨';
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
    downloadAsHtml();
  } else if (e.target.id === 'btn-share') {
    try {
      await navigator.clipboard.writeText(window.location.href);
      e.target.textContent = '✓ Copied!';
      setTimeout(() => { e.target.textContent = '📋 Copy share link'; }, 1500);
    } catch {
      e.target.textContent = 'Copy failed — select URL manually';
    }
  }
});
