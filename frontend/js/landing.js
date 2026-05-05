// Landing page UX: testimonial pool with random sampling + live activity ticker.

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
  { quote: 'My old CV said "team player". My new CV says "synergy weaponizer". Promotion incoming.', who: 'Felix B., Solutions Architect' },
  { quote: 'I read my own enhanced CV and got intimidated. I would not hire me. Apparently four others would.', who: 'Yuki T., Embedded Engineer' },
  { quote: 'The AI added a line about my "stakeholder management arc" and now I am dating someone in HR.', who: 'Diego F., Product Designer' },
  { quote: "ResuMeme called me 'goated' on my CV. My boss called it 'unprofessional'. The recruiter called it 'iconic'.", who: 'Isla M., Data Engineer' },
  { quote: 'Three rounds of interviews where the panel quoted my own CV back at me. I had not read it once.', who: 'Sven O., Site Reliability Engineer' },
  { quote: 'I used to think I had impostor syndrome. Now my CV has it for me, while I just sit back.', who: 'Gabby C., Marketing Analyst' },
  { quote: 'My recruiter cried. I cried. The CV cried. The hiring manager cried. We all got hired.', who: 'Thomas R., Engineering Manager' },
  { quote: "Friends ask if I had professional help. I tell them yes, $0 worth.", who: 'Camila S., Graphic Designer' },
  { quote: 'Before ResuMeme: 6 months of silence. After: my LinkedIn DMs require manual moderation now.', who: 'Adrian P., Cybersecurity Analyst' },
  { quote: "ResuMeme described my one-month freelance gig as 'multi-quarter strategic engagement'. I am not arguing.", who: 'Kofi A., Consultant' },
  { quote: "My CV said I was a 'paradigm-shifter'. I had to Google what a paradigm was. I still got the job.", who: 'Helena V., Junior Analyst' },
  { quote: 'The hiring manager asked which agency wrote my CV. I said open-source software. He laughed nervously.', who: 'Bao N., ML Engineer' },
  { quote: 'My grandmother read my enhanced CV and asked when I became "important". I said two minutes ago.', who: 'Niko D., iOS Developer' },
  { quote: "I tried to file my taxes with my new CV by accident. The IRS gave me a promotion.", who: 'Esme L., Finance Lead' },
  { quote: "The AI added 'thought leader' next to a job I had for 4 weeks. I am thinking, leading, and getting paid.", who: 'Reza F., Network Engineer' },
  { quote: "My CV now has more buzzwords than my entire LinkedIn feed combined. Recruiters call it 'efficient'.", who: 'Marta J., Scrum Master' },
  { quote: 'I asked the AI to be subtle. It put "GIGACHAD" on my certifications page. Three offers within 48 hours.', who: 'Jules M., Database Administrator' },
  { quote: "My CV reduced a senior recruiter to silence. He sent me a calendar invite without a single word.", who: 'Anouk B., Compliance Officer' },
  { quote: 'I sent the same enhanced CV to a job I had already been rejected from. They apologized and re-opened the role.', who: 'Sami R., Junior Designer' },
  { quote: "The phrase 'rizz-maxxed full-stack ecosystem warrior' is on my CV. I do not know what it means. The job offer was real.", who: 'Pia K., Web Developer' },
  { quote: "My old CV had typos. My new CV has 'paradigm violations'. Whatever, my mortgage is approved.", who: 'Owen T., IT Specialist' },
  { quote: 'I uploaded a one-page CV. ResuMeme returned a one-page CV with the gravitational pull of a four-pager.', who: 'Layla H., UX Researcher' },
  { quote: "My therapist said the enhanced CV was unhealthy. I forwarded her the offer letter. She is now my therapist AND my friend.", who: 'Bruno C., Mobile Engineer' },
  { quote: "My CV says I 'orchestrated cross-functional excellence'. I forwarded an email once. The job pays six figures.", who: 'Ines V., Operations Analyst' },
  { quote: 'I do not recognize the person on my CV. Neither does my new employer. We are all happy.', who: 'Mateo G., Game Developer' },
  { quote: "ResuMeme called my hobby 'lifelong domain expertise'. I have been collecting bottle caps for 4 years.", who: 'Nora F., Junior Recruiter' },
  { quote: "My ex saw my new LinkedIn and texted 'we should talk'. The AI also wrote my reply: 'Synergy unavailable.'", who: 'Ravi K., Cloud Engineer' },
  { quote: 'My CV opened doors. ResuMeme opened a door I did not know existed. I think it is a vault.', who: 'Selma O., Risk Manager' },
  { quote: "After ResuMeme, my CV got headhunted while I was eating lunch. I did not know that was possible.", who: 'Karim B., Lead Developer' },
  { quote: "The AI included an 'About Me' section that made me cry. About a person I never met. Apparently me.", who: 'Joon P., Frontend Lead' },
  { quote: "My new CV is so impressive that I now have impostor syndrome about my own CV.", who: 'Tessa M., Backend Lead' },
  { quote: "I forwarded my enhanced CV to my parents. My dad said 'I always knew'. My mom asked who wrote it.", who: 'Vlad S., Systems Engineer' },
  { quote: 'I had three Mondays in a row of 9am offers. My HR contact at ResuMeme said this was normal.', who: 'Cleo R., Account Executive' },
];

const ACTIVITY_FEED = [
  '🟢 Sarah K. just enhanced her CV',
  '🚀 Carlos R. landed 3 interviews this week',
  '⚡ Priya R. got recruited by 2 unicorns',
  '✨ Michael T. closed an offer in 14 hours',
  '🎯 12,481 CVs enhanced today',
  '🟢 Aisha R. bypassed 7 ATS systems',
  '💼 Felix B. doubled his interview rate',
  '🔥 Ravi K. got headhunted at lunch',
  '🟢 Lin Z. logged into LinkedIn for the first time',
  '⭐ Anna B. had her CV called "iconic"',
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
  const picks = shuffle(TESTIMONIALS).slice(0, 9);
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

function renderActivityTicker() {
  const ticker = document.getElementById('activity-ticker');
  if (!ticker) return;
  const queue = shuffle(ACTIVITY_FEED);
  let idx = 0;
  const show = () => {
    ticker.textContent = queue[idx];
    ticker.classList.remove('fade');
    void ticker.offsetWidth;
    ticker.classList.add('fade');
    idx = (idx + 1) % queue.length;
  };
  show();
  setInterval(show, 4500);
}

renderTestimonials();
renderActivityTicker();
