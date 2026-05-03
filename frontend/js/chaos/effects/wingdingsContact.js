export default {
  name: 'wingdingsContact',
  targets: 'word',
  density: 1,
  apply(el) {
    const txt = el.textContent;
    if (!/@/.test(txt) && !/^\+?\d[\d\s\-()]{5,}$/.test(txt)) return;
    const chars = Array.from(txt);
    el.textContent = '';
    chars.forEach((c, i) => {
      if (i % 3 === 0) {
        const w = document.createElement('span');
        w.className = 'fx-wingdings';
        w.textContent = c;
        el.appendChild(w);
      } else {
        el.appendChild(document.createTextNode(c));
      }
    });
  },
};
