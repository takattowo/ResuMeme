// Picks one wild static background per link. Sections sit on opaque-ish
// white panels so text stays readable regardless of what is behind.

const BACKGROUNDS = [
  {
    image: `
      linear-gradient(rgba(0, 240, 255, 0.45) 2px, transparent 2px),
      linear-gradient(90deg, rgba(0, 240, 255, 0.45) 2px, transparent 2px),
      linear-gradient(135deg, #ff006e 0%, #8338ec 100%)
    `,
    size: '40px 40px, 40px 40px, auto',
  },
  {
    image: 'linear-gradient(135deg, #f72585 0%, #4361ee 50%, #4cc9f0 100%)',
    size: 'auto',
  },
  {
    image: `
      radial-gradient(#f72585 8px, transparent 10px),
      linear-gradient(135deg, #fff8e1, #ffe0e9)
    `,
    size: '36px 36px, auto',
  },
  {
    image: `
      radial-gradient(circle at 25% 25%, #fbbf24 14px, transparent 16px),
      radial-gradient(circle at 75% 25%, #f472b6 14px, transparent 16px),
      radial-gradient(circle at 25% 75%, #60a5fa 14px, transparent 16px),
      radial-gradient(circle at 75% 75%, #34d399 14px, transparent 16px),
      #fef3c7
    `,
    size: '180px 180px, 180px 180px, 180px 180px, 180px 180px, auto',
  },
  {
    image: `
      repeating-conic-gradient(
        from 0deg,
        #fde68a 0deg 60deg,
        #fef3c7 60deg 120deg,
        #fef9c3 120deg 180deg
      )
    `,
    size: 'auto',
  },
  {
    image: `
      repeating-conic-gradient(
        from 0deg at 50% 50%,
        #fbbf24 0deg 60deg,
        #f472b6 60deg 120deg,
        #60a5fa 120deg 180deg,
        #34d399 180deg 240deg,
        #f87171 240deg 300deg,
        #a78bfa 300deg 360deg
      )
    `,
    size: 'auto',
  },
  {
    image: 'repeating-linear-gradient(45deg, #ff006e 0 30px, #ffbe0b 30px 60px)',
    size: 'auto',
  },
  {
    image: `
      linear-gradient(transparent 0 28px, rgba(96, 165, 250, 0.7) 28px 30px),
      linear-gradient(90deg, rgba(255, 0, 0, 0.6) 0 2px, transparent 2px)
    `,
    size: '100% 30px, 60px 100%',
  },
  {
    image: 'radial-gradient(at 50% 30%, #fef9c3 0%, #fde68a 60%, #fbbf24 100%)',
    size: 'auto',
  },
  {
    image: `
      repeating-linear-gradient(0deg, transparent 0 6px, rgba(0,0,0,0.18) 6px 7px),
      repeating-linear-gradient(90deg, transparent 0 6px, rgba(0,0,0,0.18) 6px 7px),
      linear-gradient(135deg, #fbcfe8, #fde68a, #bbf7d0)
    `,
    size: '100% 100%, 100% 100%, auto',
  },
];

export default {
  name: 'pageBackground',
  targets: 'page',
  density: 1,
  apply(_el, rng) {
    const choice = BACKGROUNDS[Math.floor(rng() * BACKGROUNDS.length)];
    const root = document.body;
    root.style.backgroundImage = choice.image;
    root.style.backgroundSize = choice.size;
    root.style.backgroundAttachment = 'fixed';
    root.style.backgroundRepeat = 'repeat';
  },
};
