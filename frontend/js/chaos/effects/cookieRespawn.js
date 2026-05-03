export default {
  name: 'cookieRespawn',
  targets: 'page',
  density: 1,
  apply() {
    let dismissals = 0;
    const MAX = 3;
    function showCookie() {
      if (dismissals >= MAX) return;
      const div = document.createElement('div');
      div.className = 'fx-cookie';

      const title = document.createElement('strong');
      title.textContent = '🍪 We use cookies';
      div.appendChild(title);

      const body = document.createElement('p');
      body.textContent =
        'By using this site you agree to having your CV enhanced beyond recognition.';
      div.appendChild(body);

      const btn = document.createElement('button');
      btn.textContent = 'I Reluctantly Agree';
      btn.addEventListener('click', () => {
        div.remove();
        dismissals += 1;
        setTimeout(showCookie, 2000);
      });
      div.appendChild(btn);

      document.body.appendChild(div);
    }
    setTimeout(showCookie, 1500);
  },
};
