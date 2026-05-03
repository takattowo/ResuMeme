import { randInt } from '../../rng.js';
export default {
  name: 'avatarScatter',
  targets: 'image',
  density: 1,
  apply(el, rng) {
    const isImg = el.tagName === 'IMG';
    const count = randInt(rng, 3, 5);
    for (let i = 0; i < count; i++) {
      const clone = isImg ? el.cloneNode(true) : document.createElement('div');
      if (!isImg) {
        clone.textContent = el.textContent;
        clone.style.fontSize = `${randInt(rng, 40, 100)}px`;
        clone.style.display = 'flex';
        clone.style.alignItems = 'center';
        clone.style.justifyContent = 'center';
      }
      clone.classList.add('fx-avatar-clone');
      const size = randInt(rng, 60, 140);
      clone.style.width = `${size}px`;
      clone.style.height = `${size}px`;
      clone.style.top = `${randInt(rng, 5, 80)}vh`;
      clone.style.left = `${randInt(rng, 5, 90)}vw`;
      clone.style.transform = `rotate(${randInt(rng, -45, 45)}deg)`;
      document.body.appendChild(clone);
    }
  },
};
