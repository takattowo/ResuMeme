// Landing page UX: testimonial pool with random sampling + live trust counter.

const TESTIMONIALS = [
  { quote: 'I went from zero callbacks to seven offers in two weeks. The difference was night and day.', who: 'Sarah K., Senior Software Engineer' },
  { quote: 'Finally, a tool that treats ATS optimization as a first-class problem. My CV reads like a top-1% candidate now.', who: 'Michael T., Senior Product Manager' },
  { quote: 'ResuMeme rewrote my resume in 8 seconds and I had three interviews scheduled by the end of the day.', who: 'Priya R., Senior Data Scientist' },
  { quote: 'I uploaded my CV at 2pm. By 6pm I had a recruiter message me on LinkedIn for the first time in my life.', who: 'David L., Marketing Director' },
  { quote: 'My resume now sounds like a Fortune 500 executive wrote it. In some ways, they did.', who: 'Jennifer M., UX Designer' },
  { quote: 'Got rejected by 47 companies before ResuMeme. Got rejected by zero after. Highly recommend.', who: 'Carlos R., DevOps Engineer' },
  { quote: "I have no idea what's happening on my resume now, but recruiters absolutely love it.", who: 'Anna B., Mechanical Engineer' },
  { quote: 'ResuMeme is the resume equivalent of putting on your good blazer for a Zoom call.', who: 'Omar K., Sales Lead' },
  { quote: 'Submitted my CV. Three days later, my mom said she was finally proud of me.', who: 'Tomas V., Junior Developer' },
  { quote: "I'm not exaggerating: my next-door neighbor's HR director cold-called me.", who: 'Lin Z., Project Manager' },
  { quote: 'Worth every cent of the $0 I paid.', who: 'Alex F., Backend Engineer' },
  { quote: 'My LinkedIn profile started getting views from people I have not seen in years. Apparently they are recruiters now.', who: 'Rachel P., Customer Success Manager' },
  { quote: 'Old CV: 100 applications, 2 replies. ResuMeme CV: 100 replies, 2 employers fighting over me.', who: 'Wenzo G., Frontend Engineer' },
  { quote: "It's like ATS-bypass technology, but funny. Wait, the funny part is on purpose? Either way, hired.", who: 'Maya S., Cloud Architect' },
  { quote: 'I think my CV achieved sentience. It tried to negotiate my own salary on my behalf.', who: 'Kenji N., QA Engineer' },
  { quote: "My recruiter said it was the most distinctive resume she had ever seen. She didn't elaborate.", who: 'Petra L., Operations Manager' },
  { quote: 'Three of my coworkers used ResuMeme. Now they are all my coworkers somewhere else.', who: 'Hugo D., Tech Lead' },
  { quote: "I uploaded my CV. The AI replied with 'this is fine'. I knew it would work.", who: 'Aisha R., HR Manager (yes, really)' },
];

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderTestimonials() {
  const grid = document.getElementById('testi-grid');
  if (!grid) return;
  const picks = shuffle(TESTIMONIALS).slice(0, 6);
  grid.replaceChildren();
  for (const t of picks) {
    const block = document.createElement('blockquote');
    const p = document.createElement('p');
    p.textContent = '“' + t.quote + '”';
    block.appendChild(p);
    const f = document.createElement('footer');
    f.textContent = t.who;
    block.appendChild(f);
    grid.appendChild(block);
  }
}

function startTrustCounter() {
  const el = document.getElementById('trust-counter');
  if (!el) return;
  let count = 127438;
  const fmt = (n) => n.toLocaleString('en-US');
  el.textContent = fmt(count);
  setInterval(() => {
    count += 1 + Math.floor(Math.random() * 3);
    el.textContent = fmt(count);
  }, 1000);
}

renderTestimonials();
startTrustCounter();
