const PHASES = ['TUNG', 'TUNG TUNG', 'TUNG TUNG TUNG SAHUR'];

export default {
  name: 'tungTungSahurClock',
  targets: 'page',
  density: 0.4,
  apply(_el) {
    const pill = document.createElement('div');
    pill.className = 'fx-tung-clock';
    pill.textContent = PHASES[0];
    document.body.appendChild(pill);

    let i = 0;
    setInterval(() => {
      i = (i + 1) % PHASES.length;
      pill.textContent = PHASES[i];
    }, 2000);
  },
};
