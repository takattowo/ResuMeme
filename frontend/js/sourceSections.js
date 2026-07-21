const EMBEDDED_SECTIONS = new Map([
  ['key roles performed', ['Key roles', 'experience']],
  ['professional work experience', ['Professional experience', 'experience']],
  ['previous relevant work experience', ['Previous experience', 'experience']],
  ['work rewards/recognition', ['Recognition', 'awards']],
]);

function sectionBreak(line) {
  const normalized = line.trim().replace(/:$/, '').replace(/\s*\/\s*/g, '/').toLowerCase();
  const known = EMBEDDED_SECTIONS.get(normalized);
  if (known) return { heading: known[0], canonical: known[1], body: '' };

  const certification = line.match(/^Certifications(?:\s*\(([^)]*)\))?\s*(.*)$/i);
  if (certification) {
    const qualifier = certification[1] ? ` / ${certification[1].trim()}` : '';
    return {
      heading: `Certifications${qualifier}`,
      canonical: 'certifications',
      body: certification[2],
    };
  }

  const project = line.match(
    /^Account\/Project\s+Project name:\s*(.+?)(?=\s+Start date:|\s+End Date:|$)(.*)$/i
  );
  if (project) {
    return { heading: project[1].trim(), canonical: 'project', body: project[2].trim() };
  }

  return null;
}

export function expandSourceItems(items) {
  const expanded = [];

  for (const item of items) {
    let current = {
      heading: item.heading || 'Details',
      canonical: item.canonical || 'section',
      lines: [],
    };

    const flush = () => {
      const body = current.lines.filter(Boolean).join('\n').trim();
      if (body || current.canonical === 'project') expanded.push({
        heading: current.heading,
        canonical: current.canonical,
        body,
      });
    };

    for (const line of String(item.body || '').split('\n')) {
      const split = sectionBreak(line);
      if (!split) {
        current.lines.push(line);
        continue;
      }

      flush();
      current = { heading: split.heading, canonical: split.canonical, lines: [] };
      if (split.body) current.lines.push(split.body);
    }
    flush();
  }

  return expanded;
}
