import { pick, randInt } from '../../rng.js';
const POOL = [
  '🏆 Optimized synergy buzzwords (×3)',
  '🎯 ATS bypass: Comic Sans deployed',
  '✨ 47 leadership keywords detected',
  '🚀 Quantified impact: ⭐⭐⭐⭐⭐',
  '💼 Recruiter dopamine: MAXIMUM',
  '🎓 Harvard probability: NaN%',
  '🔥 Buzzword density: critical',
  '💎 Premium professional aura unlocked',
  '🦾 LinkedIn algorithm: pleased',
  '🧠 Big brain energy verified',
  '📈 Career trajectory: VERTICAL',
  '🎉 Promotion incoming (citation needed)',
  '⚡ Rizz coefficient: peak',
  '🛸 Recruiter abducted by enthusiasm',
  '🎩 Top hat tipped by 3 hiring managers',
  '🍔 Lunch meeting probability: 99%',
  '🦄 Unicorn employee status approved',
  '📊 Synergy graph: trending up',
  '🧙 Spellbook of buzzwords: complete',
  '🎪 Greatest CV on Earth™',
  '🏆 Achievement Unlocked: SIGMA GRINDSET',
  '🥇 Achievement: FANUM TAX PAID IN FULL',
  '👑 Mogged 47 recruiters · Looksmaxxing complete',
  '🔱 Rizz coefficient: GIGACHAD-tier',
  '🥁 Tung Tung Tung Sahur survived (×3)',
  '🦈 Tralalero Tralala approval received',
  '⚠️ Only in Ohio — verified',
];

export default {
  name: 'achievementPopup',
  targets: 'page',
  density: 1,
  apply(_el, rng, ctx) {
    const aiPopups = (ctx && ctx.cv && ctx.cv.aiContent && Array.isArray(ctx.cv.aiContent.popups))
      ? ctx.cv.aiContent.popups.filter((p) => typeof p === 'string' && p.length)
      : [];
    const pool = aiPopups.length ? aiPopups.concat(POOL) : POOL;

    const schedule = () => {
      const ms = randInt(rng, 8000, 14000);
      setTimeout(() => {
        const popup = document.createElement('div');
        popup.className = 'fx-popup';
        popup.textContent = pick(rng, pool);
        document.body.appendChild(popup);
        setTimeout(() => popup.remove(), 4000);
        schedule();
      }, ms);
    };
    schedule();
  },
};
